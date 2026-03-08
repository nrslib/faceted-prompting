import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureConfigFile, getFacetedRoot } from '../config/index.js';

const REQUIRED_FACET_DIRS = ['persona', 'knowledge', 'policies', 'compositions'] as const;

const DEFAULT_TEMPLATES: ReadonlyArray<{ relativePath: string; content: string }> = [
  {
    relativePath: 'facets/persona/default.md',
    content: 'You are a helpful assistant.\n',
  },
  {
    relativePath: 'facets/knowledge/default.md',
    content: 'Add shared context here.\n',
  },
  {
    relativePath: 'facets/policies/default.md',
    content: 'Follow project coding standards.\n',
  },
  {
    relativePath: 'facets/compositions/default.yaml',
    content: ['name: default', 'description: Default composition', 'persona: default'].join('\n') + '\n',
  },
];

export async function initializeFacetedHome(options: { homeDir: string }): Promise<void> {
  const facetedRoot = getFacetedRoot(options.homeDir);
  ensureConfigFile(options.homeDir);

  const facetsRoot = join(facetedRoot, 'facets');
  mkdirSync(facetsRoot, { recursive: true });

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
