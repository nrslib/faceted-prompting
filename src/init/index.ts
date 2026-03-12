import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
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
      mkdirSync(dirname(targetPath), { recursive: true });
      writeFileSync(targetPath, template.content, 'utf-8');
    }
  }
}
