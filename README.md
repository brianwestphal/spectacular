# Spectacular

A layered specification language for defining software as a human- and AI-readable source of truth.

Write your software spec once. Layer on platform-specific customizations for iOS, Android, web, or any variant. Use AI-powered analysis to find ambiguities, conflicts, and gaps before code is generated.

## Quick Start

```bash
npm install -g spectacular-lang
```

### Write a spec

Create a file called `app.spc`:

```spectacular
# My App

A mobile task manager with cloud sync and offline support.

## Task List

The main screen shows a scrollable list of tasks.
Each task displays its title, due date, and a completion checkbox.
Completed tasks are sorted to the bottom with a strikethrough title.
```

### Add platform layers

```
my-app/
  app.spc
  _layers_/
    ios/
      app.spc       # iOS-specific additions/overrides
    android/
      app.spc       # Android-specific additions/overrides
```

### Resolve, diff, and analyze

```bash
# See the merged spec for iOS
spc resolve ios

# Compare iOS and Android
spc diff ios android

# Find ambiguities, conflicts, and gaps (uses Claude by default)
spc check
spc check --variant ios
spc check --provider codex    # use OpenAI instead
spc check --provider gemini   # use Gemini instead
```

## The Language

Spectacular is **markdown with a small set of `@` directives**. If you can write markdown, you can write Spectacular.

### Syntax

Everything starting with `@` is a Spectacular directive. Everything else is standard markdown.

```spectacular
# Authentication
@label(auth)

The app requires sign-in before any content is accessible.
Users sign in with email and password.

@see(security@tls)

## Password Requirements

- At least 8 characters
- At least one uppercase letter
- At least one number

@ref(https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
```

### Directives

| Directive | Purpose |
|-----------|---------|
| `@label(id)` | Stable anchor for cross-referencing |
| `@see(reference)` | Cross-reference within the spec |
| `@ref(url)` | Link to external resource |
| `@remove ## Heading` | Remove a section from a parent layer |
| `@rem text` | Single-line comment (not part of the spec) |
| `@+rem` / `@-rem` | Multi-line comment block (nestable) |

Parenthesized values support bare or quoted forms with JS-style escaping:

```spectacular
@ref(./designs/login.figma)
@ref("https://example.com/path_(with_parens)/page")
```

### Layering

The `_layers_/` directory signals variant layers. Each subdirectory is a named variant that extends, overrides, or removes content from the parent.

```
my-app/
  auth.spc                        # base
  _layers_/
    mobile/
      auth.spc                    # extends base
      _layers_/
        ios/
          auth.spc                # extends mobile
        android/
          auth.spc                # extends mobile
    web/
      auth.spc                    # extends base
```

Resolution order follows directory depth. More specific layers always win:

- **Extend** (default): Layer content is appended to the parent section.
- **Override**: When statements conflict, the deeper layer wins.
- **Remove**: `@remove ## Section` eliminates a section entirely.
- **Add**: Layers can introduce sections that don't exist in the parent.

### Cross-Cutting Concerns

No special syntax needed. Write broadly-scoped statements in dedicated files:

```spectacular
# Security

All API communication **must** use TLS 1.3 or higher.
PII **must not** be written to application logs.
```

The analysis tools cross-reference these against feature-specific files to flag violations and gaps.

## CLI Reference

All commands accept `--path <dir>` to specify the spec project root (defaults to current directory).

| Command | Description |
|---------|-------------|
| `spc init [dir]` | Scaffold a new spec directory with starter files |
| `spc resolve [variant]` | Merge layers and print the resolved spec |
| `spc diff <a> <b>` | Show differences between two variants (`base` is a valid name) |
| `spc check [type]` | AI-powered analysis: `ambiguity`, `consistency`, `completeness`, `redundancy`, or all |
| `spc absorb <variant>` | Absorb code changes into proposed spec updates |
| `spc generate <variant>` | Generate/update code from the spec |

### The bug-fix feedback loop

```bash
# 1. Fix a bug in iOS code
# 2. Absorb the fix into spec updates
spc absorb ios --source ios=./ios-app

# 3. Review & edit the proposed .spc changes
# 4. Generate updated code for all variants
spc generate all --source ios=./ios-app --source android=./android-app
```

`absorb` supports the same diff selection flags as code review tools:
`--uncommitted` (default), `--staged`, `--unstaged`, `--commit <sha>`, `--range <from..to>`, `--branch <name>`, `--files <patterns>`.

`generate` creates a recoverable snapshot before making changes, so you can always roll back.

### AI provider auto-detection

The `check`, `absorb`, and `generate` commands auto-detect the best available AI provider:

1. `ANTHROPIC_API_KEY` env var → Claude API
2. `OPENAI_API_KEY` env var → OpenAI API
3. `GEMINI_API_KEY` env var → Gemini API
4. `claude` CLI installed → Claude Code CLI
5. `codex` CLI installed → Codex CLI
6. `gemini` CLI installed → Gemini CLI

Override with `--provider <name>`. All commands support `--model` to override the default model and `--json` for machine-readable output.

## Using Spectacular with AI Tools

Spectacular is designed to be both the input and the source of truth for AI-powered code generation. A comprehensive guide for AI tools ships with the package at [AI.md](AI.md).

The guide covers:
- **Writing specs** — structure, conventions, and patterns
- **Setting up tooling** — installing, adding package.json scripts, CLAUDE.md integration
- **Running analysis** — interpreting findings, fixing issues, asking clarifying questions
- **Absorbing bug fixes** — feeding code changes back into the spec
- **Maintaining specs** — adding/modifying/removing features and variants
- **Generating code** — invoking AI to update source code from the spec

### With Claude Code

Add to your project's `CLAUDE.md`:

```markdown
## Specification

This project uses the Spectacular language for its software specification.
The spec is in the `spec/` directory.

- Language reference: node_modules/spectacular-lang/language-spec.md
- AI integration guide: node_modules/spectacular-lang/AI.md
- Resolve the spec: `npx spc --path spec resolve`
- Analyze the spec: `npx spc --path spec check --json`

When writing or modifying code:
- Read the relevant .spc files first to understand requirements
- The spec is the source of truth — code must match the spec
- If the spec is ambiguous, ask before assuming

When fixing bugs:
- After fixing a bug in code, run `npx spc absorb <variant> --source <variant>=<path>`
- Review and apply the proposed spec changes
- Then run `npx spc generate all --source ...` to propagate the fix

**Important**: Any change to requirements, behavior, or constraints must be
reflected in the spec files. The spec is the source of truth — do not change
code behavior without updating the spec to match.
```

### With other AI tools

Include `language-spec.md` and/or `AI.md` in your system prompt or context, along with the resolved spec for the target variant. The `spc resolve` command outputs clean, readable text that any LLM can consume. Use `spc check --json` for machine-readable analysis output.

## Full Language Specification

See [language-spec.md](language-spec.md) for the complete specification, including detailed semantics for layering, resolution, cross-cutting concerns, and planned tooling.

## Example

See [docs/examples/todo-list/](docs/examples/todo-list/) for a complete example with base + iOS + Android layers and sample analysis results.

## License

MIT
