import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ensureConfigFile, getFacetedRoot } from '../config/index.js';

const REQUIRED_FACET_DIRS = ['persona', 'knowledge', 'policies', 'output-contracts'] as const;
const TAKT_BOOTSTRAP_BASE_URL = 'https://raw.githubusercontent.com/nrslib/takt/main/builtins/ja/facets';

function makeComposition(name: string, description: string, knowledge: readonly string[]): string {
  const lines = [
    `name: ${name}`,
    `description: ${description}`,
    'persona: coder',
    'policies:',
    '  - coding',
    '  - ai-antipattern',
    'knowledge:',
    ...knowledge.map(k => `  - ${k}`),
  ];
  return lines.join('\n') + '\n';
}

const DEFAULT_COMPOSITIONS: ReadonlyArray<{ relativePath: string; content: string }> = [
  {
    relativePath: 'compositions/coding.yaml',
    content: makeComposition('coding', 'General coding with architecture knowledge', ['architecture']),
  },
  {
    relativePath: 'compositions/frontend.yaml',
    content: makeComposition('frontend', 'Frontend coding with architecture + frontend knowledge', ['architecture', 'frontend']),
  },
  {
    relativePath: 'compositions/backend.yaml',
    content: makeComposition('backend', 'Backend coding with architecture + backend knowledge', ['architecture', 'backend']),
  },
  {
    relativePath: 'compositions/issue-worktree.yaml',
    content: [
      'name: issue-worktree',
      'description: Issue-oriented coding skill deployed from a multi-file template',
      'persona: coder',
      'policies:',
      '  - coding',
      '  - ai-antipattern',
      'knowledge:',
      '  - architecture',
      'instruction: |',
      '  Confirm the issue scope before editing, keep the change minimal, and report build/test results.',
      'template: issue-worktree',
      '',
    ].join('\n'),
  },
];

const DEFAULT_TEMPLATES: ReadonlyArray<{ relativePath: string; content: string }> = [
  {
    relativePath: 'templates/issue-worktree/SKILL.md',
    content: [
      '# Issue Worker',
      '',
      '## Persona',
      '{{facet:persona}}',
      '',
      '## Policies',
      '{{facet:policies}}',
      '',
      '## Knowledge',
      '{{facet:knowledges}}',
      '',
      '## Instructions',
      '{{facet:instructions}}',
      '',
      '## Workflow',
      '- Confirm the issue scope before editing.',
      '- Keep changes minimal and explicit.',
      '- Run build/test and report the outcome.',
      '',
    ].join('\n'),
  },
  {
    relativePath: 'templates/issue-worktree/README.md',
    content: [
      '# Issue Worker Template',
      '',
      'This sample template shows how a multi-file skill workspace can be structured for issue-oriented coding tasks.',
      '',
      'Included files:',
      '- `SKILL.md`',
      '- `templates/instructions/fix.md`',
      '- `templates/instructions/review.md`',
      '',
      'Facet placeholders in `SKILL.md` are replaced during `facet install skill`.',
      '',
    ].join('\n'),
  },
  {
    relativePath: 'templates/issue-worktree/templates/instructions/fix.md',
    content: [
      '# Fix Checklist',
      '',
      '- Reproduce the issue first.',
      '- Verify the smallest safe fix.',
      '- Record build/test evidence after the change.',
      '',
    ].join('\n'),
  },
  {
    relativePath: 'templates/issue-worktree/templates/instructions/review.md',
    content: [
      '# Review Checklist',
      '',
      '- Check for scope creep.',
      '- Check for missing tests or validation.',
      '- Check for hidden fallback logic.',
      '',
    ].join('\n'),
  },
  ...DEFAULT_COMPOSITIONS,
];

const BOOTSTRAP_TARGETS: ReadonlyArray<{
  localRelativePath: string;
  remoteRelativePath: string;
}> = [
  {
    localRelativePath: 'facets/persona/coder.md',
    remoteRelativePath: 'personas/coder.md',
  },
  {
    localRelativePath: 'facets/knowledge/architecture.md',
    remoteRelativePath: 'knowledge/architecture.md',
  },
  {
    localRelativePath: 'facets/knowledge/frontend.md',
    remoteRelativePath: 'knowledge/frontend.md',
  },
  {
    localRelativePath: 'facets/knowledge/backend.md',
    remoteRelativePath: 'knowledge/backend.md',
  },
  {
    localRelativePath: 'facets/policies/coding.md',
    remoteRelativePath: 'policies/coding.md',
  },
  {
    localRelativePath: 'facets/policies/ai-antipattern.md',
    remoteRelativePath: 'policies/ai-antipattern.md',
  },
];

type FetchResponseLike = {
  ok: boolean;
  status: number;
  text(): Promise<string>;
};

type FetchLike = (input: string) => Promise<FetchResponseLike>;

function resolveFetchImpl(fetchImpl?: FetchLike): FetchLike {
  if (fetchImpl) {
    return fetchImpl;
  }

  if (typeof globalThis.fetch !== 'function') {
    throw new Error('Global fetch is not available');
  }

  return globalThis.fetch.bind(globalThis) as FetchLike;
}

async function fetchBootstrapContent(remoteRelativePath: string, fetchImpl: FetchLike): Promise<string> {
  const response = await fetchImpl(`${TAKT_BOOTSTRAP_BASE_URL}/${remoteRelativePath}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch bootstrap facet: ${remoteRelativePath} (status: ${response.status})`);
  }

  return response.text();
}

export function listPullSampleTargetPaths(homeDir: string): string[] {
  const facetedRoot = getFacetedRoot(homeDir);
  return [
    ...BOOTSTRAP_TARGETS.map(target => join(facetedRoot, target.localRelativePath)),
    ...DEFAULT_TEMPLATES.map(template => join(facetedRoot, template.relativePath)),
  ];
}

function initializeFacetedDir(baseDir: string): string {
  const facetedRoot = getFacetedRoot(baseDir);
  ensureConfigFile(baseDir);

  const facetsRoot = join(facetedRoot, 'facets');
  const compositionsRoot = join(facetedRoot, 'compositions');
  const templatesRoot = join(facetedRoot, 'templates');
  mkdirSync(facetsRoot, { recursive: true });
  mkdirSync(compositionsRoot, { recursive: true });
  mkdirSync(templatesRoot, { recursive: true });

  for (const dirName of REQUIRED_FACET_DIRS) {
    mkdirSync(join(facetsRoot, dirName), { recursive: true });
  }

  return facetedRoot;
}

async function bootstrapDefaultFacets(facetedRoot: string, fetchImpl: FetchLike, overwrite: boolean): Promise<void> {
  for (const target of BOOTSTRAP_TARGETS) {
    const targetPath = join(facetedRoot, target.localRelativePath);
    if (existsSync(targetPath) && !overwrite) {
      continue;
    }
    const content = await fetchBootstrapContent(target.remoteRelativePath, fetchImpl);
    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, content, 'utf-8');
  }
}

function writeDefaultSampleFiles(facetedRoot: string, overwrite: boolean): void {
  for (const template of DEFAULT_TEMPLATES) {
    const targetPath = join(facetedRoot, template.relativePath);
    if (existsSync(targetPath) && !overwrite) {
      continue;
    }

    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, template.content, 'utf-8');
  }
}

export async function initializeLocalFaceted(options: { cwd: string }): Promise<void> {
  initializeFacetedDir(options.cwd);
}

export async function initializeGlobalFaceted(options: { homeDir: string; fetchImpl?: FetchLike }): Promise<void> {
  await pullSampleFacets({
    homeDir: options.homeDir,
    fetchImpl: options.fetchImpl,
  });
}

export async function pullSampleFacets(options: { homeDir: string; fetchImpl?: FetchLike; overwrite?: boolean }): Promise<void> {
  const facetedRoot = initializeFacetedDir(options.homeDir);
  const overwrite = options.overwrite ?? false;
  writeDefaultSampleFiles(facetedRoot, overwrite);
  await bootstrapDefaultFacets(facetedRoot, resolveFetchImpl(options.fetchImpl), overwrite);
}
