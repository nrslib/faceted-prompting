import { join } from 'node:path';
import type { InstallTarget } from '../skill-types.js';

export interface InstallTargetDefinition {
  readonly key: InstallTarget;
  readonly label: string;
  readonly relativeOutputPath: readonly string[];
}

const INSTALL_TARGETS: readonly InstallTargetDefinition[] = [
  {
    key: 'cc',
    label: 'Claude Code',
    relativeOutputPath: ['.claude', 'skills'],
  },
  {
    key: 'codex',
    label: 'Codex',
    relativeOutputPath: ['.codex', 'skills'],
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

export function defaultOutputPath(
  homeDir: string,
  skillName: string,
  target: InstallTargetDefinition,
): string {
  return join(homeDir, ...target.relativeOutputPath, skillName, 'SKILL.md');
}
