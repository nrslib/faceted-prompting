import { basename, dirname, join } from 'node:path';
import { loadComposeDefinition } from '../compose-definition.js';
import { getFacetedRoot } from '../config/index.js';
import {
  buildSkillSections,
  ensureSafeDefinitionName,
  listCompositionDefinitions,
  renderSkillDocument,
  resolveDefinitionPathFromSource,
} from './skill-renderer.js';
import { buildInstalledSkillLabels, readSkillsRegistry, writeSkillsRegistry } from './skill-registry.js';
import { writeSkillFile } from './skill-file-ops.js';
import type { SkillEntry, SkillMode, SkillsRegistry } from './skill-types.js';
import type { FacetCliOptions, FacetCliResult } from './types.js';
import { runFilePlacementInstall, runSkillDeployInstall, runTemplateApplyInstall } from './install-skill/modes.js';
import {
  dispatchInstallFlow,
  ensureInstallFlowSelection,
  SWITCH_TO_INLINE_LABEL,
  SWITCH_TO_REFERENCE_LABEL,
} from './install-skill/flow.js';

function resolveTargetModeFromDecision(modeDecision: string): SkillMode | undefined {
  if (modeDecision === 'Keep current') {
    return undefined;
  }
  if (modeDecision === SWITCH_TO_REFERENCE_LABEL) {
    return 'reference';
  }
  if (modeDecision === SWITCH_TO_INLINE_LABEL) {
    return 'inline';
  }
  throw new Error(`Unsupported skill mode decision: ${modeDecision}`);
}

export function getSkillPaths(homeDir: string): {
  readonly facetedRoot: string;
  readonly facetsRoot: string;
  readonly compositionsDir: string;
  readonly skillsPath: string;
} {
  const facetedRoot = getFacetedRoot(homeDir);
  const facetsRoot = join(facetedRoot, 'facets');
  return {
    facetedRoot,
    facetsRoot,
    compositionsDir: join(facetedRoot, 'compositions'),
    skillsPath: join(facetedRoot, 'skills.yaml'),
  };
}

async function generateAndWriteSkill(params: {
  entry: { source: string; mode: SkillMode; outputPath: string };
  compositionsDir: string;
  facetsRoot: string;
  homeDir: string;
}): Promise<void> {
  const definitionPath = resolveDefinitionPathFromSource(params.entry.source, params.compositionsDir);
  const definition = await loadComposeDefinition(definitionPath);
  const definitionDir = dirname(definitionPath);

  const sections = buildSkillSections({
    definition,
    definitionDir,
    facetsRoot: params.facetsRoot,
  });

  const content = renderSkillDocument({
    ...sections,
    mode: params.entry.mode,
  });

  writeSkillFile(params.entry.outputPath, content, params.homeDir);
}

export async function runInstallSkillCommand(options: FacetCliOptions): Promise<FacetCliResult> {
  const { facetedRoot, facetsRoot, compositionsDir, skillsPath } = getSkillPaths(options.homeDir);
  const registry = readSkillsRegistry(skillsPath);

  const definitionMap = listCompositionDefinitions(compositionsDir);
  const compositionCandidates = Object.keys(definitionMap).sort();
  if (compositionCandidates.length === 0) {
    throw new Error(`No compose definitions found in ${compositionsDir}`);
  }

  const selectedComposition = await options.select(
    compositionCandidates,
    'Choose composition with Up/Down and Enter:',
  );
  const definitionPath = definitionMap[selectedComposition];
  if (!definitionPath) {
    throw new Error(`Unknown compose definition selected: ${selectedComposition}`);
  }

  const installSelection = ensureInstallFlowSelection(
    await options.select(
      ['Skill deploy', 'File placement', 'Template apply'],
      'Choose install flow with Up/Down and Enter:',
    ),
  );

  const definition = await loadComposeDefinition(definitionPath);
  const source = basename(definitionPath);
  const safeSkillName = ensureSafeDefinitionName(definition.name);
  const definitionDir = dirname(definitionPath);
  const sections = buildSkillSections({
    definition,
    definitionDir,
    facetsRoot,
  });
  return dispatchInstallFlow<FacetCliResult>({
    selection: installSelection,
    onFilePlacement: () => {
      return runFilePlacementInstall({
        options,
        safeSkillName,
        sections,
      });
    },
    onTemplateApply: () => {
      return runTemplateApplyInstall({
        options,
        safeSkillName,
        sections,
      });
    },
    onSkillDeploy: async () => {
      const deploy = await runSkillDeployInstall({
        options,
        facetedRoot,
        safeSkillName,
        definition,
        sections,
      });

      const targetEntries = registry[deploy.target] ?? {};
      const updatedTargetEntries = {
        ...targetEntries,
        [safeSkillName]: {
          source,
          mode: deploy.mode,
          output: deploy.outputPath,
          cc: { 'user-invocable': true },
        },
      };
      const updatedRegistry = {
        ...registry,
        [deploy.target]: updatedTargetEntries,
      };
      writeSkillsRegistry(skillsPath, updatedRegistry, options.homeDir);
      return deploy.result;
    },
  });
}

export async function runUpdateSkillCommand(options: FacetCliOptions): Promise<FacetCliResult> {
  const { facetsRoot, compositionsDir, skillsPath } = getSkillPaths(options.homeDir);
  const registry = readSkillsRegistry(skillsPath);
  const installed = buildInstalledSkillLabels(registry);
  if (installed.length === 0) {
    throw new Error('No installed skills to update');
  }

  const selection = await options.select(
    ['All', ...installed.map(item => item.label)],
    'Choose skills to update with Up/Down and Enter:',
  );

  const selectedEntries =
    selection === 'All' ? installed : installed.filter(item => item.label === selection);

  if (selectedEntries.length === 0) {
    throw new Error(`Unknown installed skill selected: ${selection}`);
  }

  const modeDecision = await options.select(
    [
      'Keep current',
      selectedEntries.some(item => item.entry.mode === 'inline')
        ? SWITCH_TO_REFERENCE_LABEL
        : SWITCH_TO_INLINE_LABEL,
    ],
    'Choose mode update with Up/Down and Enter:',
  );

  const targetMode = resolveTargetModeFromDecision(modeDecision);

  let updatedRegistry: SkillsRegistry = { ...registry };

  for (const selected of selectedEntries) {
    const nextMode = targetMode ?? selected.entry.mode;

    await generateAndWriteSkill({
      entry: {
        source: selected.entry.source,
        mode: nextMode,
        outputPath: selected.entry.output,
      },
      compositionsDir,
      facetsRoot,
      homeDir: options.homeDir,
    });

    const targetEntries = updatedRegistry[selected.target];
    if (!targetEntries) {
      throw new Error(`Invalid skills registry target: ${selected.target}`);
    }

    const current = targetEntries[selected.skillName];
    if (!current) {
      throw new Error(`Invalid skills registry entry: ${selected.target}.${selected.skillName}`);
    }

    const updatedTargetEntries = {
      ...targetEntries,
      [selected.skillName]: {
        ...current,
        mode: nextMode,
      },
    };
    updatedRegistry = {
      ...updatedRegistry,
      [selected.target]: updatedTargetEntries,
    };
  }

  writeSkillsRegistry(skillsPath, updatedRegistry, options.homeDir);
  return {
    kind: 'text',
    text: 'Updated skill(s)',
  };
}

export async function runListSkillCommand(options: FacetCliOptions): Promise<FacetCliResult> {
  const { skillsPath } = getSkillPaths(options.homeDir);
  const registry = readSkillsRegistry(skillsPath);

  const lines: string[] = [];
  for (const target of Object.keys(registry).sort()) {
    const entries = registry[target];
    if (!entries || Object.keys(entries).length === 0) {
      continue;
    }

    lines.push(target);
    for (const skillName of Object.keys(entries).sort()) {
      const entry: SkillEntry | undefined = entries[skillName];
      if (!entry) {
        continue;
      }

      lines.push(
        `- ${skillName} (mode: ${entry.mode}, source: ${entry.source}, output: ${entry.output})`,
      );
    }
  }

  return {
    kind: 'text',
    text: lines.join('\n'),
  };
}
