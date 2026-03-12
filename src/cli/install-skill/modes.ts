import { existsSync, lstatSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { ensurePathWithinHome } from '../path-guard.js';
import { renderSkillDocument } from '../skill-renderer.js';
import { writeSkillFile } from '../skill-file-ops.js';
import type { FacetCliOptions, FacetCliResult } from '../types.js';
import { applyFacetTokensToPath, buildSectionsWithCopiedPaths, copyFacetFiles, parseScanDepth } from './facets.js';
import {
  copyDirectoryTree,
  defaultOutputPath,
  ensureDirectoryExists,
  ensureRegenerationTargetDir,
  ensureSkillModeFromLabel,
  INLINE_MODE_LABEL,
  REFERENCE_MODE_LABEL,
  ensureTemplateDirectory,
  resolveInstallTarget,
} from './flow.js';
import type { SkillSections } from './facets.js';
import type { ComposeDefinition } from '../../types.js';

export async function runFilePlacementInstall(params: {
  options: FacetCliOptions;
  safeSkillName: string;
  sections: SkillSections;
}): Promise<FacetCliResult> {
  const requestedDir = await params.options.input('Output directory', params.options.cwd);
  const targetDir = resolve(requestedDir);

  await ensureRegenerationTargetDir({
    targetDir,
    options: params.options,
    promptLabel: 'Output directory',
  });

  copyFacetFiles({
    targetDir,
    safeSkillName: params.safeSkillName,
    sections: params.sections,
  });

  return {
    kind: 'path',
    path: targetDir,
  };
}

export async function runTemplateApplyInstall(params: {
  options: FacetCliOptions;
  safeSkillName: string;
  sections: SkillSections;
}): Promise<FacetCliResult> {
  const requestedDir = await params.options.input('Output directory', params.options.cwd);
  const targetDir = resolve(requestedDir);
  ensureDirectoryExists(targetDir, 'Output directory');

  const scanDepth = parseScanDepth(await params.options.input('Scan depth', '1'));

  const facetsDir = join(targetDir, 'facets');
  await ensureRegenerationTargetDir({
    targetDir: facetsDir,
    options: params.options,
    promptLabel: 'Facets directory',
  });

  const facetPaths = copyFacetFiles({
    targetDir,
    safeSkillName: params.safeSkillName,
    sections: params.sections,
  });

  applyFacetTokensToPath({
    rootDir: targetDir,
    maxDepth: scanDepth,
    facets: facetPaths,
    excludeDirs: ['facets'],
  });

  return {
    kind: 'path',
    path: targetDir,
  };
}

export async function runSkillDeployInstall(params: {
  options: FacetCliOptions;
  facetedRoot: string;
  safeSkillName: string;
  definition: ComposeDefinition;
  sections: SkillSections;
}): Promise<{ result: FacetCliResult; mode: 'inline' | 'reference'; outputPath: string; target: 'cc' }> {
  const targetLabel = await params.options.select(
    ['Claude Code'],
    'Choose install target with Up/Down and Enter:',
  );
  const target = resolveInstallTarget(targetLabel);
  const mode = ensureSkillModeFromLabel(
    await params.options.select(
      [INLINE_MODE_LABEL, REFERENCE_MODE_LABEL],
      'Choose skill mode with Up/Down and Enter:',
    ),
  );
  const defaultPath = defaultOutputPath(params.options.homeDir, params.safeSkillName);
  const outputPath = resolve(await params.options.input('Output path', defaultPath));
  const { resolvedPath: boundedOutputPath } = ensurePathWithinHome(
    outputPath,
    params.options.homeDir,
    'Skill output path',
  );

  if (existsSync(boundedOutputPath) && lstatSync(boundedOutputPath).isSymbolicLink()) {
    throw new Error(`Symbolic links are not allowed for skill output file: ${boundedOutputPath}`);
  }

  const templateDir = params.definition.template
    ? ensureTemplateDirectory(params.facetedRoot, params.definition.template)
    : undefined;
  const targetDir = dirname(boundedOutputPath);

  await ensureRegenerationTargetDir({
    targetDir,
    options: params.options,
    promptLabel: 'Target directory',
    homeDir: params.options.homeDir,
  });

  if (templateDir) {
    copyDirectoryTree(templateDir, targetDir);

    const facetPaths = copyFacetFiles({
      targetDir,
      safeSkillName: params.safeSkillName,
      sections: params.sections,
    });

    applyFacetTokensToPath({
      rootDir: targetDir,
      maxDepth: Number.MAX_SAFE_INTEGER,
      facets: facetPaths,
      excludeDirs: ['facets'],
    });

    if (!existsSync(boundedOutputPath)) {
      const fallbackContent = renderSkillDocument({
        ...buildSectionsWithCopiedPaths(params.sections, facetPaths),
        mode,
      });
      writeSkillFile(boundedOutputPath, fallbackContent, params.options.homeDir);
    }
  } else {
    const copiedFacetPaths = copyFacetFiles({
      targetDir,
      safeSkillName: params.safeSkillName,
      sections: params.sections,
    });

    const renderSections =
      mode === 'reference' ? buildSectionsWithCopiedPaths(params.sections, copiedFacetPaths) : params.sections;

    const content = renderSkillDocument({
      ...renderSections,
      mode,
    });

    writeSkillFile(boundedOutputPath, content, params.options.homeDir);
  }

  return {
    result: {
      kind: 'path',
      path: boundedOutputPath,
    },
    mode,
    outputPath: boundedOutputPath,
    target,
  };
}
