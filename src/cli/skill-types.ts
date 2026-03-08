import type { ComposeDefinition } from '../types.js';

export type SkillMode = 'inline' | 'reference';

export interface SkillEntry {
  readonly source: string;
  readonly mode: SkillMode;
  readonly output: string;
  readonly cc?: {
    readonly 'user-invocable'?: boolean;
  };
}

export type SkillsRegistry = Record<string, Record<string, SkillEntry>>;

export interface FacetRefContent {
  readonly body: string;
  readonly path: string;
}

export interface SkillSection {
  readonly ref: string;
  readonly body: string;
  readonly path: string;
}

export type InstructionSection = SkillSection | { readonly ref: 'literal'; readonly body: string };

export interface SkillDocumentInput {
  readonly definition: ComposeDefinition;
  readonly mode: SkillMode;
  readonly persona: SkillSection;
  readonly policies: readonly SkillSection[];
  readonly knowledge: readonly SkillSection[];
  readonly instruction?: InstructionSection;
}

export interface ResolvedDefinitionSections {
  readonly persona: SkillSection;
  readonly policies: readonly SkillSection[];
  readonly knowledge: readonly SkillSection[];
  readonly instruction?: InstructionSection;
}
