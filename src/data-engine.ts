/**
 * DataEngine — abstract interface for facet data retrieval.
 *
 * Compose logic depends only on this interface; callers wire
 * concrete implementations (FileDataEngine, etc.).
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import type { FacetKind, FacetContent } from './types.js';

/**
 * Abstract interface for facet data retrieval.
 *
 * Methods return Promises so that implementations backed by
 * async I/O (database, network) can be used without changes.
 */
export interface DataEngine {
  resolve(kind: FacetKind, key: string): Promise<FacetContent | undefined>;
  list(kind: FacetKind): Promise<string[]>;
}

/**
 * File-system backed DataEngine.
 *
 * Resolves facets from a single root directory using the convention:
 *   {root}/{kind}/{key}.md
 */
export class FileDataEngine implements DataEngine {
  constructor(private readonly root: string) {}

  async resolve(kind: FacetKind, key: string): Promise<FacetContent | undefined> {
    const filePath = join(this.root, kind, `${key}.md`);
    if (!existsSync(filePath)) return undefined;
    const body = readFileSync(filePath, 'utf-8');
    return { body, sourcePath: filePath };
  }

  async list(kind: FacetKind): Promise<string[]> {
    const dirPath = join(this.root, kind);
    if (!existsSync(dirPath)) return [];
    return readdirSync(dirPath)
      .filter(f => f.endsWith('.md'))
      .map(f => f.slice(0, -3));
  }
}

/**
 * Chains multiple DataEngines with first-match-wins resolution.
 */
export class CompositeDataEngine implements DataEngine {
  private readonly engines: readonly DataEngine[];

  constructor(engines: readonly DataEngine[]) {
    if (engines.length === 0) {
      throw new Error('CompositeDataEngine requires at least one engine');
    }
    this.engines = engines;
  }

  async resolve(kind: FacetKind, key: string): Promise<FacetContent | undefined> {
    for (const engine of this.engines) {
      const result = await engine.resolve(kind, key);
      if (result !== undefined) return result;
    }
    return undefined;
  }

  async list(kind: FacetKind): Promise<string[]> {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const engine of this.engines) {
      const keys = await engine.list(kind);
      for (const key of keys) {
        if (!seen.has(key)) {
          seen.add(key);
          result.push(key);
        }
      }
    }
    return result;
  }
}
