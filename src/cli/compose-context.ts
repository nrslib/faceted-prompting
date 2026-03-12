import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, relative, resolve, sep } from 'node:path';
import { renderConflictNotice, trimContextContent } from '../truncation.js';

const CONTEXT_MAX_CHARS = 2000;
const MAX_FALLBACK_FILES = 12;

const FRONTEND_EXTENSIONS = new Set([
  '.tsx',
  '.jsx',
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.html',
  '.vue',
  '.svelte',
]);

const SOURCE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.html',
  '.vue',
  '.svelte',
  '.java',
  '.kt',
  '.kts',
  '.go',
  '.py',
  '.rb',
  '.rs',
  '.php',
  '.cs',
  '.swift',
  '.sql',
  '.yml',
  '.yaml',
  '.md',
]);

const FRONTEND_PATH_PARTS = ['frontend', 'web', 'ui', 'client', 'components', 'pages', 'styles'];
const BACKEND_PATH_PARTS = ['backend', 'server', 'api', 'db', 'database', 'prisma', 'migrations'];
const IGNORED_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.next']);

export interface ComposeContext {
  readonly name: 'coding' | 'frontend' | 'backend';
  readonly knowledgeRefs: readonly string[];
  readonly relatedFiles: readonly string[];
  readonly relatedInstruction?: string;
}

function normalizeRelativePath(cwd: string, filePath: string): string {
  const resolvedPath = resolve(cwd, filePath);
  const relativePath = relative(cwd, resolvedPath);
  if (relativePath.startsWith(`..${sep}`) || relativePath === '..') {
    throw new Error(`Related file escapes working directory: ${filePath}`);
  }
  return relativePath.length > 0 ? relativePath : filePath;
}

function isSourceFile(filePath: string): boolean {
  return SOURCE_EXTENSIONS.has(extname(filePath).toLowerCase());
}

function collectFallbackFiles(cwd: string, currentDir = cwd, acc: string[] = []): string[] {
  const entries = readdirSync(currentDir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    if (acc.length >= MAX_FALLBACK_FILES) {
      return acc;
    }

    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        collectFallbackFiles(cwd, resolve(currentDir, entry.name), acc);
      }
      continue;
    }

    const fullPath = resolve(currentDir, entry.name);
    const relativePath = relative(cwd, fullPath);
    if (isSourceFile(relativePath)) {
      acc.push(relativePath);
    }
  }

  return acc;
}

function detectGitRelatedFiles(cwd: string): string[] {
  try {
    execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd,
      encoding: 'utf-8',
      stdio: 'pipe',
    }).trim();
  } catch {
    return [];
  }

  const collected = new Set<string>();
  const commands: string[][] = [
    ['diff', '--name-only', '--diff-filter=ACMR'],
    ['diff', '--name-only', '--cached', '--diff-filter=ACMR'],
    ['ls-files', '--others', '--exclude-standard'],
  ];

  for (const args of commands) {
    const output = execFileSync('git', args, {
      cwd,
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    for (const line of output.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (isSourceFile(trimmed)) {
        collected.add(trimmed);
      }
    }
  }

  return Array.from(collected).sort();
}

function isFrontendFile(filePath: string): boolean {
  const normalized = filePath.toLowerCase();
  if (FRONTEND_EXTENSIONS.has(extname(normalized))) {
    return true;
  }
  return FRONTEND_PATH_PARTS.some(part => normalized.includes(`/${part}/`) || normalized.startsWith(`${part}/`));
}

function isBackendFile(filePath: string): boolean {
  const normalized = filePath.toLowerCase();
  return BACKEND_PATH_PARTS.some(part => normalized.includes(`/${part}/`) || normalized.startsWith(`${part}/`));
}

function inferPromptName(relatedFiles: readonly string[]): 'coding' | 'frontend' | 'backend' {
  const hasFrontend = relatedFiles.some(isFrontendFile);
  const hasBackend = relatedFiles.some(isBackendFile);

  if (hasFrontend && !hasBackend) {
    return 'frontend';
  }
  if (hasBackend && !hasFrontend) {
    return 'backend';
  }
  return 'coding';
}

function inferKnowledgeRefs(relatedFiles: readonly string[]): string[] {
  const refs = ['architecture'];
  if (relatedFiles.some(isFrontendFile)) {
    refs.push('frontend');
  }
  if (relatedFiles.some(isBackendFile)) {
    refs.push('backend');
  }
  return refs;
}

function renderRelatedFileBlock(cwd: string, relativePath: string): string | undefined {
  const absolutePath = resolve(cwd, relativePath);
  if (!existsSync(absolutePath)) {
    return undefined;
  }

  const stats = statSync(absolutePath);
  if (!stats.isFile()) {
    return undefined;
  }

  const content = readFileSync(absolutePath, 'utf-8');
  const prepared = trimContextContent(content, CONTEXT_MAX_CHARS);
  const lines = [
    `## ${relativePath}`,
    '',
    prepared.content,
    '',
    `Source: ${relativePath}`,
    '',
    renderConflictNotice(),
  ];
  return lines.join('\n');
}

function buildRelatedInstruction(cwd: string, relatedFiles: readonly string[]): string | undefined {
  if (relatedFiles.length === 0) {
    return undefined;
  }

  const blocks = relatedFiles
    .map(filePath => renderRelatedFileBlock(cwd, filePath))
    .filter((block): block is string => block !== undefined);

  if (blocks.length === 0) {
    return undefined;
  }

  return ['# Related Files', '', ...blocks].join('\n\n');
}

export function resolveComposeContext(cwd: string): ComposeContext {
  const relatedFiles = detectGitRelatedFiles(cwd);
  const normalizedFiles = (relatedFiles.length > 0 ? relatedFiles : collectFallbackFiles(cwd))
    .map(filePath => normalizeRelativePath(cwd, filePath));

  return {
    name: inferPromptName(normalizedFiles),
    knowledgeRefs: inferKnowledgeRefs(normalizedFiles),
    relatedFiles: normalizedFiles,
    relatedInstruction: buildRelatedInstruction(cwd, normalizedFiles),
  };
}
