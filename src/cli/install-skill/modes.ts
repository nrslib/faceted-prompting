import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { ensurePathWithinHome } from '../path-guard.js';
import { hasYamlFrontmatter, renderSkillDocument, renderSkillFrontmatter } from '../skill-renderer.js';
import { writeSkillFile } from '../skill-file-ops.js';
import type { FacetCliOptions, FacetCliResult } from '../types.js';
import {
  applyFacetTokensToPath,
  buildInlineFacetTokenValues,
  buildSectionsWithCopiedPaths,
  copyFacetFiles,
  parseScanDepth,
} from './facets.js';
import {
  copyDirectoryTree,
  defaultOutputPath,
  ensureDirectoryExists,
  ensureRegenerationTargetDir,
  listInstallTargets,
  ensureTemplateDirectory,
  resolveInstallTarget,
} from './flow.js';
import type { SkillSections } from './facets.js';
import type { ComposeDefinition } from '../../types.js';
import type { InstallTarget } from '../skill-types.js';

function ensureTemplateBackedSkillFrontmatter(params: {
  outputPath: string;
  definition: ComposeDefinition;
  homeDir: string;
}): void {
  if (!existsSync(params.outputPath)) {
    return;
  }

  const currentContent = readFileSync(params.outputPath, 'utf-8');
  if (hasYamlFrontmatter(currentContent)) {
    return;
  }

  const contentWithFrontmatter = `${renderSkillFrontmatter(params.definition)}\n${currentContent.trimStart()}`;
  writeSkillFile(params.outputPath, contentWithFrontmatter, params.homeDir);
}

export async function runTemplateApplyInstall(params: {
  options: FacetCliOptions;
  safeSkillName: string;
  sections: SkillSections;
  templateDir: string;
}): Promise<FacetCliResult> {
  const requestedDir = await params.options.input('Output directory', params.options.cwd);
  const targetDir = resolve(requestedDir);
  ensureDirectoryExists(targetDir, 'Output directory');

  const scanDepth = parseScanDepth(await params.options.input('Scan depth', '1'));

  copyDirectoryTree(params.templateDir, targetDir);

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
    tokenValues: buildInlineFacetTokenValues(params.sections),
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
}): Promise<{ result: FacetCliResult; mode: 'inline'; outputPath: string; target: InstallTarget }> {
  const targetLabel = await params.options.select(
    listInstallTargets().map(target => target.label),
    'Choose install target with Up/Down and Enter:',
  );
  const target = resolveInstallTarget(targetLabel);
  const mode = 'inline' as const;
  const defaultPath = defaultOutputPath(params.options.homeDir, params.safeSkillName, target);
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
      tokenValues: buildInlineFacetTokenValues(params.sections),
      excludeDirs: ['facets'],
    });

    ensureTemplateBackedSkillFrontmatter({
      outputPath: boundedOutputPath,
      definition: params.definition,
      homeDir: params.options.homeDir,
    });
  } else {
    const copiedFacetPaths = copyFacetFiles({
      targetDir,
      safeSkillName: params.safeSkillName,
      sections: params.sections,
    });

    const content = renderSkillDocument({
      ...params.sections,
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
    target: target.key,
  };
}
