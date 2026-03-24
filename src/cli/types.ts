export interface FacetCliOptions {
  readonly cwd: string;
  readonly homeDir: string;
  readonly select: (candidates: string[], prompt?: string) => Promise<string>;
  readonly input: (prompt: string, defaultValue: string) => Promise<string>;
}

export interface ComposeCliOptions {
  readonly composition?: string;
  readonly outputMode?: 'split' | 'combined';
  readonly output?: string;
  readonly overwrite?: boolean;
}

export type FacetCliResult =
  | {
      readonly kind: 'path';
      readonly path: string;
    }
  | {
      readonly kind: 'paths';
      readonly paths: readonly string[];
    }
  | {
      readonly kind: 'text';
      readonly text: string;
    };
