import { describe, expect, it } from 'vitest';
import {
  defaultOutputPath,
  listInstallTargets,
  resolveInstallTarget,
  resolveInstallTargetRoots,
} from '../cli/install-skill/flow.js';
import { getBuiltInInstallRootTemplates } from '../config/install-targets.js';
import type { FacetedConfig } from '../config/index.js';

describe('install skill targets', () => {
  it('should expose Codex as an install target without hard-coded output path metadata', () => {
    const codex = listInstallTargets().find(target => target.key === 'codex');

    expect(codex).toBeDefined();
    expect(codex).toEqual({ key: 'codex', label: 'Codex' });
  });

  it('should build the default Codex output path from the first configured root', () => {
    const codex = resolveInstallTarget('Codex');

    expect(defaultOutputPath('/home/tester', 'coding', codex)).toBe(
      '/home/tester/.agents/skills/coding/SKILL.md',
    );
  });

  it('should resolve Codex roots from the shared built-in install target contract', () => {
    const codex = resolveInstallTarget('Codex');

    expect(resolveInstallTargetRoots('/home/tester', codex)).toEqual(
      ['/home/tester/.agents/skills'],
    );
    expect(getBuiltInInstallRootTemplates('codex')).toEqual(['{homeDir}/.agents/skills']);
  });

  it('should prefer the first configured Codex root for the default output path', () => {
    const codex = resolveInstallTarget('Codex');
    const config = {
      version: 1,
      skillPaths: [],
      install: {
        targets: {
          codex: {
            roots: ['/opt/company/skills', '/home/tester/.agents/skills'],
          },
        },
      },
    } satisfies FacetedConfig;

    expect(defaultOutputPath('/home/tester', 'coding', codex, config)).toBe(
      '/opt/company/skills/coding/SKILL.md',
    );
  });

  it('should use only configured Codex roots when resolving allowed install targets', () => {
    const codex = resolveInstallTarget('Codex');
    const config = {
      version: 1,
      skillPaths: [],
      install: {
        targets: {
          codex: {
            roots: ['/opt/company/skills', '/srv/shared/skills'],
          },
        },
      },
    } satisfies FacetedConfig;

    expect(resolveInstallTargetRoots('/home/tester', codex, config)).toEqual([
      '/opt/company/skills',
      '/srv/shared/skills',
    ]);
  });

  it('should reject blank configured Codex roots during target resolution', () => {
    const codex = resolveInstallTarget('Codex');
    const config = {
      version: 1,
      skillPaths: [],
      install: {
        targets: {
          codex: {
            roots: ['   '],
          },
        },
      },
    } satisfies FacetedConfig;

    expect(() => resolveInstallTargetRoots('/home/tester', codex, config)).toThrow(
      'Install root template must not be empty',
    );
  });
});
