import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('module boundary', () => {
  it('should keep compose definition loading out of resolve module', async () => {
    const resolveModulePath = pathToFileURL(resolve('src/resolve.ts')).href;
    const composeDefinitionPath = pathToFileURL(resolve('src/compose-definition.ts')).href;

    const resolveModule = await import(resolveModulePath);
    const composeDefinitionModule = await import(composeDefinitionPath);

    expect('loadComposeDefinition' in resolveModule).toBe(false);
    expect(typeof composeDefinitionModule.loadComposeDefinition).toBe('function');
  });

  it('should not export unused install helpers', async () => {
    const flowModulePath = pathToFileURL(resolve('src/cli/install-skill/flow.ts')).href;
    const modesModulePath = pathToFileURL(resolve('src/cli/install-skill/modes.ts')).href;
    const flowModule = await import(flowModulePath);
    const modesModule = await import(modesModulePath);

    expect('ensureTemplateDirectory' in flowModule).toBe(false);
    expect('ensureDirectoryExists' in flowModule).toBe(false);
    expect('runTemplateApplyInstall' in modesModule).toBe(false);
  });

  it('should keep composition source helpers internal to skill commands', async () => {
    const skillCommandsModulePath = pathToFileURL(resolve('src/cli/skill-commands.ts')).href;
    const skillCommandsModule = await import(skillCommandsModulePath);

    expect('resolveCompositionSource' in skillCommandsModule).toBe(false);
    expect('hasGlobalCompositionShadow' in skillCommandsModule).toBe(false);
  });

  it('should expose only compose definition resolution entrypoint', async () => {
    const resolutionModulePath = pathToFileURL(resolve('src/cli/compose-definition-resolution.ts')).href;
    const resolutionModule = await import(resolutionModulePath);

    expect(typeof resolutionModule.resolveComposeDefinition).toBe('function');
    expect('validateNonInteractiveComposeOptions' in resolutionModule).toBe(false);
  });

  it('should require explicit compose options in compose execution entrypoints', () => {
    const composeCommandSource = readFileSync(resolve('src/cli/compose-command.ts'), 'utf-8');
    const composeExecutionSource = readFileSync(resolve('src/cli/compose-execution.ts'), 'utf-8');

    expect(composeCommandSource).not.toContain('composeOptions: ComposeCliOptions = {}');
    expect(composeExecutionSource).not.toContain('composeOptions?: ComposeCliOptions');
    expect(composeExecutionSource).not.toContain('params.composeOptions ?? {}');
  });

  it('should keep install facets orchestration file within size boundary', () => {
    const facetsModulePath = resolve('src/cli/install-skill/facets.ts');
    const lineCount = readFileSync(facetsModulePath, 'utf-8').split('\n').length;

    expect(lineCount).toBeLessThanOrEqual(300);
  });
});
