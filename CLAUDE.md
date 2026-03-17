# CLAUDE.md

## Project

This is the Spectacular language — a layered specification language and toolset for defining software as a human- and AI-readable source of truth.

- **npm package**: `spectacular-lang` (binary: `spc`)
- **Language spec**: `language-spec.md`
- **AI integration guide**: `AI.md`
- **Example**: `docs/examples/todo-list/`

## Development

```bash
npm run build          # Compile TypeScript to dist/
npm run lint           # ESLint (strict TypeScript)
npm run dev -- <args>  # Run from source via tsx
npm run release        # Interactive release script
```

ESLint uses the strictTypeChecked config from glassbox. All source is in `src/`.

## Architecture

- `src/ai.ts` — Shared AI provider logic (API + CLI for Claude, OpenAI, Gemini)
- `src/analyzer.ts` — `spc check` analysis (ambiguity, consistency, completeness, redundancy)
- `src/absorber.ts` — `spc absorb` logic (git diff → spec change proposals)
- `src/generator.ts` — `spc generate` logic (spec → code, with snapshot/recovery)
- `src/parser.ts` — Parse .spc/.spectacular files into AST
- `src/resolver.ts` — Resolve layered specs by merging along a variant path
- `src/differ.ts` — Section-by-section diff between resolved variants
- `src/formatter.ts` — Terminal output + serialization back to .spc text
- `src/types.ts` — Shared TypeScript types
- `src/cli.ts` — Commander-based CLI entry point

## Requirements Discipline

**The spec is the source of truth.** This principle applies to Spectacular itself and to all projects that use it.

- Any change to language syntax, directives, or semantics must be reflected in `language-spec.md`
- Any change to CLI commands, flags, or behavior must be reflected in `README.md`, `AI.md`, and `language-spec.md`
- Any change to the AI integration workflow must be reflected in `AI.md`
- If a change affects the example, update `docs/examples/todo-list/README.md`
- When adding a new command, add it to all four documents: `README.md` (CLI reference), `AI.md` (task guide), `language-spec.md` (CLI section), and this file (architecture list)
- Do not ship code changes without updating the corresponding documentation
