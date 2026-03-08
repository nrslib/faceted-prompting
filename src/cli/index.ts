import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { compose } from '../compose.js';
import { loadComposeDefinition } from '../compose-definition.js';
import { getFacetedRoot, readFacetedConfig } from '../config/index.js';
import { initializeFacetedHome } from '../init/index.js';
import { isResourcePath, resolveResourcePath } from '../resolve.js';
import { formatComposedOutput, resolveOutputDirectory, writeComposeOutput } from '../output/index.js';
import type { FacetSet } from '../types.js';

export interface FacetCliOptions {
  readonly cwd: string;
  readonly homeDir: string;
  readonly select: (candidates: string[]) => Promise<string>;
  readonly input: (prompt: string, defaultValue: string) => Promise<string>;
}

function requireFile(path: string, label: string): string {
  if (!existsSync(path)) {
    throw new Error(`Missing ${label}: ${path}`);
  }
  return readFileSync(path, 'utf-8');
}

function isWithinRoot(path: string, root: string): boolean {
  return path === root || path.startsWith(`${root}${sep}`);
}

function ensurePathWithinRoots(path: string, roots: readonly string[], label: string): string {
  const resolvedPath = resolve(path);
  if (!existsSync(resolvedPath)) {
    throw new Error(`Missing ${label}: ${resolvedPath}`);
  }

  const pathStat = lstatSync(resolvedPath);
  if (pathStat.isSymbolicLink()) {
    throw new Error(`Symbolic links are not allowed for ${label}: ${resolvedPath}`);
  }

  const realPath = realpathSync(resolvedPath);
  for (const root of roots) {
    const resolvedRoot = resolve(root);
    const realRoot = existsSync(resolvedRoot) ? realpathSync(resolvedRoot) : resolvedRoot;
    if (isWithinRoot(realPath, realRoot)) {
      return realPath;
    }
  }
  throw new Error(`${label} must be inside allowed facets directory: ${realPath}`);
}

function ensureSafeDefinitionName(name: string): string {
  if (!/^[A-Za-z0-9._-]+$/u.test(name)) {
    throw new Error(`Invalid compose definition name: ${name}`);
  }
  return name;
}

function shouldOverwrite(answer: string): boolean {
  const normalized = answer.trim().toLowerCase();
  return normalized === 'y' || normalized === 'yes';
}

function resolveFacetRef(options: {
  ref: string;
  label: string;
  baseDir: string;
  facetDir: string;
  allowedRoots: readonly string[];
}): string {
  const { ref, label, baseDir, facetDir, allowedRoots } = options;
  if (isResourcePath(ref)) {
    const resourcePath = resolveResourcePath(ref, baseDir);
    const boundedPath = ensurePathWithinRoots(resourcePath, allowedRoots, label);
    return requireFile(boundedPath, label);
  }
  const facetPath = join(facetDir, `${ref}.md`);
  const boundedPath = ensurePathWithinRoots(facetPath, allowedRoots, label);
  return requireFile(boundedPath, label);
}

function listCompositionDefinitions(compositionsDir: string): Record<string, string> {
  if (!existsSync(compositionsDir)) {
    throw new Error(`Compose definition directory does not exist: ${compositionsDir}`);
  }

  const entries = readdirSync(compositionsDir, { withFileTypes: true })
    .filter(entry => !entry.isDirectory() && (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml')))
    .map(entry => entry.name);

  const definitions: Record<string, string> = {};
  for (const entry of entries) {
    const name = entry.replace(/\.(yaml|yml)$/u, '');
    const definitionPath = join(compositionsDir, entry);
    definitions[name] = ensurePathWithinRoots(
      definitionPath,
      [compositionsDir],
      `compose definition "${entry}"`,
    );
  }

  return definitions;
}

function buildFacetSet(params: {
  definitionDir: string;
  facetsRoot: string;
  definition: Awaited<ReturnType<typeof loadComposeDefinition>>;
}): FacetSet {
  const { definitionDir, facetsRoot, definition } = params;
  const allowedRoots = [facetsRoot];

  const personaBody = resolveFacetRef({
    ref: definition.persona,
    label: `persona facet "${definition.persona}"`,
    baseDir: definitionDir,
    facetDir: join(facetsRoot, 'persona'),
    allowedRoots,
  });

  const policies = definition.policies?.map(ref => ({
    body: resolveFacetRef({
      ref,
      label: `policy facet "${ref}"`,
      baseDir: definitionDir,
      facetDir: join(facetsRoot, 'policies'),
      allowedRoots,
    }),
  }));

  const knowledge = definition.knowledge?.map(ref => ({
    body: resolveFacetRef({
      ref,
      label: `knowledge facet "${ref}"`,
      baseDir: definitionDir,
      facetDir: join(facetsRoot, 'knowledge'),
      allowedRoots,
    }),
  }));

  let instructionBody: string | undefined;
  if (definition.instruction) {
    if (isResourcePath(definition.instruction)) {
      const instructionPath = resolveResourcePath(definition.instruction, definitionDir);
      const boundedPath = ensurePathWithinRoots(instructionPath, allowedRoots, 'instruction file');
      instructionBody = requireFile(boundedPath, 'instruction file');
    } else {
      instructionBody = definition.instruction;
    }
  }

  return {
    persona: { body: personaBody },
    policies,
    knowledge,
    instruction: instructionBody ? { body: instructionBody } : undefined,
  };
}

export async function runFacetCli(args: string[], options: FacetCliOptions): Promise<{ outputPath: string }> {
  const [command] = args;
  if (command !== 'compose') {
    throw new Error(`Unsupported command: ${command ?? '(none)'}`);
  }

  await initializeFacetedHome({ homeDir: options.homeDir });
  readFacetedConfig(options.homeDir);

  const facetedRoot = getFacetedRoot(options.homeDir);
  const facetsRoot = join(facetedRoot, 'facets');
  const compositionsDir = join(facetsRoot, 'compositions');

  const definitionMap = listCompositionDefinitions(compositionsDir);
  const candidates = Object.keys(definitionMap).sort();
  if (candidates.length === 0) {
    throw new Error(`No compose definitions found in ${compositionsDir}`);
  }

  const selected = await options.select(candidates);
  const definitionPath = definitionMap[selected];
  if (!definitionPath) {
    throw new Error(`Unknown compose definition selected: ${selected}`);
  }

  const definition = await loadComposeDefinition(definitionPath);
  const definitionDir = dirname(definitionPath);

  const facetSet = buildFacetSet({
    definitionDir,
    facetsRoot,
    definition,
  });

  const composed = compose(facetSet, {
    contextMaxChars: 8000,
    userMessageOrder: definition.order,
  });

  const outputInput = await options.input('Output directory', options.cwd);
  const outputDir = resolveOutputDirectory(outputInput, options.cwd);
  const outputFileName = `${ensureSafeDefinitionName(definition.name)}.prompt.md`;
  const outputCandidatePath = resolve(outputDir, outputFileName);
  let overwrite = false;

  if (existsSync(outputCandidatePath)) {
    const overwriteAnswer = await options.input(
      `Output file exists. Overwrite? (${outputCandidatePath})`,
      'n',
    );

    if (!shouldOverwrite(overwriteAnswer)) {
      throw new Error(`Output file exists and overwrite was cancelled: ${outputCandidatePath}`);
    }
    overwrite = true;
  }

  const outputPath = await writeComposeOutput({
    outputDir,
    fileName: outputFileName,
    content: formatComposedOutput(composed),
    overwrite,
  });

  return { outputPath };
}
