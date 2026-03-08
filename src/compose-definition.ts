import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { ComposeDefinition, ComposeOrderEntry } from './types.js';

const ALLOWED_COMPOSE_KEYS = new Set([
  'name',
  'description',
  'persona',
  'knowledge',
  'policies',
  'instruction',
  'order',
]);

const ORDER_VALUES = new Set(['persona', 'knowledge', 'policies', 'instruction']);

function normalizeOrder(rawOrder: string[] | undefined): ComposeOrderEntry[] | undefined {
  if (!rawOrder) return undefined;
  const normalized: ComposeOrderEntry[] = [];
  const seen = new Set<ComposeOrderEntry>();
  for (const entry of rawOrder) {
    if (!ORDER_VALUES.has(entry)) {
      throw new Error(`Invalid compose order entry: ${entry}`);
    }
    if (entry === 'persona') continue;
    const typedEntry = entry as ComposeOrderEntry;
    if (seen.has(typedEntry)) continue;
    seen.add(typedEntry);
    normalized.push(typedEntry);
  }
  return normalized.length > 0 ? normalized : undefined;
}

function ensureStringList(value: unknown, field: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be a YAML list`);
  }
  if (!value.every(entry => typeof entry === 'string')) {
    throw new Error(`${field} must contain only strings`);
  }
  return value;
}

function ensureOptionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new Error(`${field} must be a scalar string`);
  }
  return value;
}

function ensureRequiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Compose definition must include required field: ${field}`);
  }
  return value.trim();
}

function parseComposeDefinitionYaml(rawYaml: string): Record<string, unknown> {
  const parsed = parse(rawYaml);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Compose definition must be a YAML object');
  }

  for (const key of Object.keys(parsed)) {
    if (!ALLOWED_COMPOSE_KEYS.has(key)) {
      throw new Error(`Unknown compose definition key: ${key}`);
    }
  }

  return parsed as Record<string, unknown>;
}

function toOptionalNonEmpty(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export async function loadComposeDefinition(definitionPath: string): Promise<ComposeDefinition> {
  const rawYaml = readFileSync(definitionPath, 'utf-8');
  const parsed = parseComposeDefinitionYaml(rawYaml);

  const name = ensureRequiredString(parsed.name, 'name');
  const persona = ensureRequiredString(parsed.persona, 'persona');
  const description = ensureOptionalString(parsed.description, 'description');
  const instruction = ensureOptionalString(parsed.instruction, 'instruction');

  const knowledge = ensureStringList(parsed.knowledge, 'knowledge');
  const policies = ensureStringList(parsed.policies, 'policies');
  const rawOrder = ensureStringList(parsed.order, 'order');
  const order = normalizeOrder(rawOrder);

  return {
    name,
    description: toOptionalNonEmpty(description),
    persona,
    knowledge: knowledge && knowledge.length > 0 ? knowledge : undefined,
    policies: policies && policies.length > 0 ? policies : undefined,
    instruction: toOptionalNonEmpty(instruction),
    order,
  };
}
