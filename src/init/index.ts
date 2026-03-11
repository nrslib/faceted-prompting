import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureConfigFile, getFacetedRoot } from '../config/index.js';

const REQUIRED_FACET_DIRS = ['persona', 'knowledge', 'policies', 'output-contracts'] as const;

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
];

const DEFAULT_TEMPLATES: ReadonlyArray<{ relativePath: string; content: string }> = [
  {
    relativePath: 'facets/persona/coder.md',
    content: 'You are a helpful coding assistant.\n',
  },
  {
    relativePath: 'facets/knowledge/architecture.md',
    content: 'Add shared architecture context here.\n',
  },
  {
    relativePath: 'facets/knowledge/frontend.md',
    content: 'Add frontend-specific context here.\n',
  },
  {
    relativePath: 'facets/knowledge/backend.md',
    content: 'Add backend-specific context here.\n',
  },
  {
    relativePath: 'facets/policies/coding.md',
    content: 'Follow project coding standards.\n',
  },
  {
    relativePath: 'facets/policies/ai-antipattern.md',
    content: 'Avoid common AI antipatterns.\n',
  },
  ...DEFAULT_COMPOSITIONS,
];

export async function initializeFacetedHome(options: { homeDir: string }): Promise<void> {
  const facetedRoot = getFacetedRoot(options.homeDir);
  ensureConfigFile(options.homeDir);

  const facetsRoot = join(facetedRoot, 'facets');
  const compositionsRoot = join(facetedRoot, 'compositions');
  const templatesRoot = join(facetedRoot, 'templates');
  mkdirSync(facetsRoot, { recursive: true });
  mkdirSync(compositionsRoot, { recursive: true });
  mkdirSync(templatesRoot, { recursive: true });

  for (const dirName of REQUIRED_FACET_DIRS) {
    mkdirSync(join(facetsRoot, dirName), { recursive: true });
  }

  for (const template of DEFAULT_TEMPLATES) {
    const targetPath = join(facetedRoot, template.relativePath);
    if (!existsSync(targetPath)) {
      writeFileSync(targetPath, template.content, 'utf-8');
    }
  }
}
