/**
 * Minimal template engine for Markdown prompt templates.
 *
 * Supports:
 * - {{#if variable}}...{{else}}...{{/if}} conditional blocks (no nesting)
 * - {{variableName}} substitution
 */

type TemplateVars = Record<string, string | boolean>;

/** Check if a template variable value is truthy. */
function isTruthy(value: string | boolean | undefined): boolean {
  return value !== undefined && value !== false && value !== '';
}

/** Resolve a variable to its string representation for substitution. */
function resolveVar(value: string | boolean | undefined): string {
  if (value === undefined || value === false) return '';
  if (value === true) return 'true';
  return value;
}

/**
 * Process {{#if variable}}...{{else}}...{{/if}} conditional blocks.
 *
 * Nesting is NOT supported.
 */
export function processConditionals(
  template: string,
  vars: TemplateVars,
): string {
  return template.replace(
    /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_match, varName: string, body: string): string => {
      const elseIndex = body.indexOf('{{else}}');
      if (isTruthy(vars[varName])) {
        return elseIndex >= 0 ? body.slice(0, elseIndex) : body;
      }
      return elseIndex >= 0 ? body.slice(elseIndex + '{{else}}'.length) : '';
    },
  );
}

/**
 * Replace {{variableName}} placeholders with values from vars.
 */
export function substituteVariables(
  template: string,
  vars: TemplateVars,
): string {
  return template.replace(
    /\{\{(\w+)\}\}/g,
    (_match, varName: string) => resolveVar(vars[varName]),
  );
}

/**
 * Render a template string by processing conditionals then substituting variables.
 */
export function renderTemplate(
  template: string,
  vars: TemplateVars,
): string {
  const afterConditionals = processConditionals(template, vars);
  return substituteVariables(afterConditionals, vars);
}
