import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isScopeRef, parseScopeRef, resolveScopeRef } from '../scope.js';
import { ensurePathWithinRoots } from './path-guard.js';

const INCLUDE_TOKEN_PATTERN = /\{\{\s*include\s*:\s*([^}]*)\}\}/gu;
const INSTRUCTION_INCLUDE_REF_PATTERN = /^instructions\/([A-Za-z0-9._-]+)$/u;
const INSTRUCTION_INCLUDE_SCOPE_REF_PATTERN = /^instructions\/(@[^/]+\/[^/]+\/[^/]+)$/u;

interface IncludeFrame {
  readonly ref: string;
  readonly path: string;
}

interface ResolvedInstructionPartial {
  readonly ref: string;
  readonly body: string;
  readonly path: string;
}

interface IncludeToken {
  readonly token: string;
  readonly rawRef: string;
  readonly index: number;
}

export interface ExpandedInstructionIncludes {
  readonly body: string;
  readonly sourcePaths: readonly string[];
}

function parseInstructionIncludeRef(rawRef: string): { ref: string; name: string } {
  const ref = rawRef.trim();
  if (ref.length === 0) {
    throw new Error('Invalid instruction include: missing include name');
  }

  const scopeMatch = INSTRUCTION_INCLUDE_SCOPE_REF_PATTERN.exec(ref);
  if (scopeMatch) {
    const scopeRef = scopeMatch[1];
    if (scopeRef === undefined) {
      throw new Error(`Invalid instruction include "${ref}": missing scope reference`);
    }
    return { ref, name: scopeRef };
  }

  const match = INSTRUCTION_INCLUDE_REF_PATTERN.exec(ref);
  if (!match) {
    throw new Error(`Invalid instruction include "${ref}": expected {{include:instructions/<name>}}`);
  }

  const name = match[1];
  if (name === undefined) {
    throw new Error(`Invalid instruction include "${ref}": missing include name`);
  }
  return { ref, name };
}

function resolveScopedInstructionPartial(params: {
  ref: string;
  scopeRef: string;
  repertoireDirs: readonly string[];
  allowedRoots: readonly string[];
}): ResolvedInstructionPartial {
  const parsed = parseScopeRef(params.scopeRef);
  const candidatePaths = params.repertoireDirs.map(repertoireDir =>
    resolveScopeRef(parsed, 'instruction-partials', repertoireDir),
  );

  const candidatePath = candidatePaths.find(path => existsSync(path));
  if (!candidatePath) {
    throw new Error(`Missing instruction include "${params.ref}": ${candidatePaths.join(', ')}`);
  }

  const boundedPath = ensurePathWithinRoots(candidatePath, params.allowedRoots, `instruction include "${params.ref}"`);
  return {
    ref: params.ref,
    body: readFileSync(boundedPath, 'utf-8'),
    path: boundedPath,
  };
}

function resolveInstructionPartial(params: {
  ref: string;
  name: string;
  partialDirs: readonly string[];
  repertoireDirs: readonly string[];
  allowedRoots: readonly string[];
}): ResolvedInstructionPartial {
  if (isScopeRef(params.name)) {
    return resolveScopedInstructionPartial({
      ref: params.ref,
      scopeRef: params.name,
      repertoireDirs: params.repertoireDirs,
      allowedRoots: params.allowedRoots,
    });
  }

  const candidatePaths = params.partialDirs.map(partialDir => join(partialDir, `${params.name}.md`));

  for (const candidatePath of candidatePaths) {
    if (!existsSync(candidatePath)) {
      continue;
    }
    const boundedPath = ensurePathWithinRoots(candidatePath, params.allowedRoots, `instruction include "${params.ref}"`);
    return {
      ref: params.ref,
      body: readFileSync(boundedPath, 'utf-8'),
      path: boundedPath,
    };
  }

  throw new Error(`Missing instruction include "${params.ref}": ${candidatePaths.join(', ')}`);
}

function collectIncludeTokens(body: string): readonly IncludeToken[] {
  return Array.from(body.matchAll(INCLUDE_TOKEN_PATTERN), match => {
    const token = match[0];
    const rawRef = match[1];
    const index = match.index;
    if (rawRef === undefined || index === undefined) {
      throw new Error(`Invalid instruction include token: ${token}`);
    }
    return { token, rawRef, index };
  });
}

function requireNonCyclicInclude(partial: ResolvedInstructionPartial, stack: readonly IncludeFrame[]): void {
  const cycleStart = stack.findIndex(frame => frame.path === partial.path);
  if (cycleStart < 0) {
    return;
  }

  const chain = stack
    .slice(cycleStart)
    .map(frame => frame.ref)
    .concat(partial.ref);
  throw new Error(`Cyclic instruction include: ${chain.join(' -> ')}`);
}

function expandBody(params: {
  body: string;
  partialDirs: readonly string[];
  repertoireDirs: readonly string[];
  allowedRoots: readonly string[];
  stack: readonly IncludeFrame[];
}): ExpandedInstructionIncludes {
  const initial = { body: '', sourcePaths: [] as readonly string[], cursor: 0 };
  const expanded = collectIncludeTokens(params.body).reduce((accumulator, includeToken) => {
    const { ref, name } = parseInstructionIncludeRef(includeToken.rawRef);
    const partial = resolveInstructionPartial({
      ref,
      name,
      partialDirs: params.partialDirs,
      repertoireDirs: params.repertoireDirs,
      allowedRoots: params.allowedRoots,
    });
    requireNonCyclicInclude(partial, params.stack);

    const nested = expandBody({
      body: partial.body,
      partialDirs: params.partialDirs,
      repertoireDirs: params.repertoireDirs,
      allowedRoots: params.allowedRoots,
      stack: params.stack.concat({ ref: partial.ref, path: partial.path }),
    });

    return {
      body: `${accumulator.body}${params.body.slice(accumulator.cursor, includeToken.index)}${nested.body}`,
      sourcePaths: [...accumulator.sourcePaths, partial.path, ...nested.sourcePaths],
      cursor: includeToken.index + includeToken.token.length,
    };
  }, initial);

  return {
    body: expanded.body + params.body.slice(expanded.cursor),
    sourcePaths: expanded.sourcePaths,
  };
}

export function expandInstructionIncludes(params: {
  body: string;
  partialDirs: readonly string[];
  repertoireDirs?: readonly string[];
  allowedRoots: readonly string[];
}): ExpandedInstructionIncludes {
  return expandBody({
    body: params.body,
    partialDirs: params.partialDirs,
    repertoireDirs: params.repertoireDirs ?? [],
    allowedRoots: params.allowedRoots,
    stack: [],
  });
}
