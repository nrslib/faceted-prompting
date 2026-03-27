import { join } from 'node:path';
import type { FacetedConfig } from '../../config/index.js';
import {
  getBuiltInInstallRootTemplates,
  readInstallRootTemplatesFromConfigValue,
  resolveInstallRootTemplates,
} from '../../config/install-targets.js';
import type { InstallTarget } from '../../install-targets.js';

export interface InstallTargetDefinition {
  readonly key: InstallTarget;
  readonly label: string;
}

const INSTALL_TARGETS: readonly InstallTargetDefinition[] = [
  {
    key: 'cc',
    label: 'Claude Code',
  },
  {
    key: 'codex',
    label: 'Codex',
  },
];

export function listInstallTargets(): readonly InstallTargetDefinition[] {
  return INSTALL_TARGETS;
}

export function resolveInstallTarget(targetLabel: string): InstallTargetDefinition {
  const definition = INSTALL_TARGETS.find(candidate => candidate.label === targetLabel);
  if (!definition) {
    throw new Error(`Unsupported skill target: ${targetLabel}`);
  }
  return definition;
}

function resolveCodexInstallRoots(homeDir: string, config?: FacetedConfig): readonly string[] {
  const rootTemplates = readInstallRootTemplatesFromConfigValue('codex', config);
  return resolveInstallRootTemplates(homeDir, rootTemplates);
}

export function resolveInstallTargetRoots(
  homeDir: string,
  target: InstallTargetDefinition,
  config?: FacetedConfig,
): readonly string[] {
  if (target.key === 'codex') {
    return resolveCodexInstallRoots(homeDir, config);
  }
  return resolveInstallRootTemplates(homeDir, getBuiltInInstallRootTemplates(target.key));
}

export function defaultOutputPath(
  homeDir: string,
  skillName: string,
  target: InstallTargetDefinition,
  config?: FacetedConfig,
): string {
  const roots = resolveInstallTargetRoots(homeDir, target, config);
  const primaryRoot = roots[0];
  if (!primaryRoot) {
    throw new Error(`Install target roots are required: ${target.key}`);
  }
  return join(primaryRoot, skillName, 'SKILL.md');
}
