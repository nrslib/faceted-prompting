import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { isWithinRoot } from '../path-guard.js';
import { hasYamlFrontmatter, renderSkillDocument, renderSkillFrontmatter } from '../skill-renderer.js';
import { writeSkillFile } from '../skill-file-ops.js';
import type { FacetCliOptions, FacetCliResult } from '../types.js';
import {
  applyFacetTokensToPath,
  buildInlineFacetTokenValues,
  copyFacetFiles,
} from './facets.js';
import {
  copyDirectoryTree,
  defaultOutputPath,
  ensureRegenerationTargetDir,
  listInstallTargets,
  ensureTemplateDirectoryFromRoots,
  resolveInstallTarget,
  resolveInstallTargetRoots,
} from './flow.js';
import type { SkillSections } from './facets.js';
import type { ComposeDefinition } from '../../types.js';
import type { InstallTarget } from '../../install-targets.js';
import { composePromptPayload } from '../../prompt-payload.js';
import type { FacetedConfig } from '../../config/index.js';

function ensureTemplateBackedSkillFrontmatter(params: {
  outputPath: string;
  definition: ComposeDefinition;
  targetRoots: readonly string[];
}): void {
  if (!existsSync(params.outputPath)) {
    return;
  }

  const currentContent = readFileSync(params.outputPath, 'utf-8');
  if (hasYamlFrontmatter(currentContent)) {
    return;
  }

  const contentWithFrontmatter = `${renderSkillFrontmatter(params.definition)}\n${currentContent.trimStart()}`;
  writeSkillFile(params.outputPath, contentWithFrontmatter, params.targetRoots);
}

export async function runSkillDeployInstall(params: {
  options: FacetCliOptions;
  facetedRoots: readonly string[];
  definitionDir: string;
  facetsRoots: readonly string[];
  config: FacetedConfig;
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
  const targetRoots = resolveInstallTargetRoots(params.options.homeDir, target, params.config);
  const defaultPath = defaultOutputPath(params.options.homeDir, params.safeSkillName, target, params.config);
  const outputPath = resolve(await params.options.input('Output path', defaultPath));
  const boundedOutputPath = outputPath;
  if (!targetRoots.some(targetRoot => isWithinRoot(boundedOutputPath, targetRoot))) {
    const allowedRoots = targetRoots.join(', ');
    throw new Error(`Skill output path must be inside target directory: ${allowedRoots}`);
  }
  if (basename(boundedOutputPath) !== 'SKILL.md') {
    throw new Error(`Skill output path must point to SKILL.md: ${boundedOutputPath}`);
  }

  if (existsSync(boundedOutputPath) && lstatSync(boundedOutputPath).isSymbolicLink()) {
    throw new Error(`Symbolic links are not allowed for skill output file: ${boundedOutputPath}`);
  }

  const templateDir = params.definition.template
    ? ensureTemplateDirectoryFromRoots(params.facetedRoots, params.definition.template, params.definitionDir)
    : undefined;
  const payload = composePromptPayload({
    definition: params.definition,
    definitionDir: params.definitionDir,
    facetsRoots: params.facetsRoots,
    composeOptions: { contextMaxChars: 8000 },
  });
  const targetDir = dirname(boundedOutputPath);
  if (targetRoots.some(targetRoot => resolve(targetDir) === targetRoot)) {
    throw new Error(`Skill output path must include a skill directory under target directory: ${targetRoots.join(', ')}`);
  }

  await ensureRegenerationTargetDir({
    targetDir,
    options: params.options,
    promptLabel: 'Target directory',
    allowedRoots: targetRoots,
  });

  if (templateDir) {
    copyDirectoryTree(templateDir, targetDir);

    copyFacetFiles({
      targetDir,
      safeSkillName: params.safeSkillName,
      copyFiles: payload.copyFiles,
      literalInstructionBodies:
        params.sections.instructions
          .filter(instruction => !('path' in instruction))
          .map(instruction => instruction.body),
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
      targetRoots,
    });
  } else {
    copyFacetFiles({
      targetDir,
      safeSkillName: params.safeSkillName,
      copyFiles: payload.copyFiles,
      literalInstructionBodies:
        params.sections.instructions
          .filter(instruction => !('path' in instruction))
          .map(instruction => instruction.body),
    });

    const content = renderSkillDocument({
      ...params.sections,
      mode,
    });

    writeSkillFile(boundedOutputPath, content, targetRoots);
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
