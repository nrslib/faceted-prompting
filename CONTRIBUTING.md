# Contributing to faceted-prompting

Thank you for your interest in contributing to faceted-prompting!

## Development Setup

```bash
git clone https://github.com/nrslib/faceted-prompting.git
cd faceted-prompting
npm install
npm run build
npm test
npm run lint
```

## How to Contribute

1. **Open an issue** to discuss the change before starting work
2. **Keep changes small and focused** — bug fixes, documentation improvements, and typo corrections are welcome
3. **Include tests** for new behavior
4. **Maintain framework independence** — this library must have zero dependencies on any specific AI agent framework

Large refactoring or feature additions without prior discussion are difficult to review and may be declined.

## Before Submitting a PR

### 1. Pass CI checks

```bash
npm run build
npm run lint
npm test
```

### 2. Follow code style

- TypeScript strict mode (`noUncheckedIndexedAccess`, `strictNullChecks`, `noImplicitAny`)
- ESM with `.js` extensions in imports (NodeNext module resolution)
- Prefer simple, readable code over clever solutions
- No `any` types

### 3. Design constraints

- Modules annotated "ZERO dependencies on TAKT internals" must stay framework-independent
- Tests live in `src/__tests__/` and use Vitest
- Keep the public API surface minimal — only export what consumers need

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
