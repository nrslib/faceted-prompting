import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type Version = readonly [number, number, number];

const FIXED_YAML_VERSION: Version = [2, 8, 3];

function readJsonObject(filePath: string): Record<string, unknown> {
  const parsed = JSON.parse(readFileSync(filePath, 'utf-8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${filePath} must contain a JSON object`);
  }
  return parsed as Record<string, unknown>;
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function parseVersion(value: string): Version {
  const match = value.match(/^[~^]?(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Unsupported version specifier: ${value}`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function isAtLeast(version: Version, minimum: Version): boolean {
  for (let index = 0; index < version.length; index += 1) {
    if (version[index] > minimum[index]) return true;
    if (version[index] < minimum[index]) return false;
  }
  return true;
}

describe('runtime dependency contract', () => {
  it('keeps the direct yaml dependency outside the vulnerable range', () => {
    const rootPackage = readJsonObject(resolve('package.json'));
    const rootDependencies = requireObject(rootPackage.dependencies, 'package.json dependencies');
    const yamlSpecifier = requireString(rootDependencies.yaml, 'package.json dependencies.yaml');

    const packageLock = readJsonObject(resolve('package-lock.json'));
    const lockPackages = requireObject(packageLock.packages, 'package-lock packages');
    const lockedYamlPackage = requireObject(lockPackages['node_modules/yaml'], 'package-lock node_modules/yaml');
    const lockedYamlVersion = requireString(lockedYamlPackage.version, 'package-lock node_modules/yaml.version');

    expect(isAtLeast(parseVersion(yamlSpecifier), FIXED_YAML_VERSION)).toBe(true);
    expect(isAtLeast(parseVersion(lockedYamlVersion), FIXED_YAML_VERSION)).toBe(true);
  });
});
