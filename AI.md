# Spectacular — AI Integration Guide

This document is designed to be included in AI tool context (e.g., CLAUDE.md, system prompts) to enable AI-assisted specification authoring, analysis, and code generation using the Spectacular language.

## Overview

Spectacular is a layered specification language for defining software. Specs are written in markdown with `@` directives, organized in a directory tree, and layered via `_layers_/` directories for platform or variant customization.

**Your role as an AI tool:**
- Write and maintain `.spc` specification files
- Set up and run analysis tooling
- Interpret analysis findings and improve specs (or ask clarifying questions)
- Generate and maintain code that conforms to specs

## Language Quick Reference

Files use `.spc` or `.spectacular` extensions. The syntax is markdown plus these directives:

```
@label(id)              Stable anchor for cross-referencing
@see(reference)         Cross-reference: @see(filename@label) or @see(filename#heading-slug)
@ref(url-or-path)       External resource link
@remove ## Heading      Remove a section from parent layer
@rem text               Single-line comment (stripped from spec)
@+rem / @-rem           Multi-line comment block (nestable, stripped from spec)
```

Parenthesized values can be bare or quoted with JS-style escaping:
```
@ref(./path/to/file)
@ref("https://example.com/path_(parens)")
```

**Layering:** Files in `_layers_/<variant>/` extend, override, or remove content from corresponding files in the parent directory. Deeper layers win on conflict.

**Full language specification:** See `language-spec.md` in this package for complete details.

## Task: Writing a New Spec

When asked to create a specification for software, follow this structure:

### 1. Create the directory structure

```
project-name/
  spec/
    app.spc              # High-level overview, core data model
    <feature>.spc        # One file per major feature area
    security.spc         # Cross-cutting security concerns
    _layers_/
      <variant>/         # Platform or variant layers
        <feature>.spc    # Only files that need customization
```

### 2. Write the base spec first

Start with the base layer. Each file should:
- Begin with a top-level `#` heading matching the concern
- Break into `##` sections for distinct aspects
- Use `@label()` on sections that other files will reference
- Use natural language at whatever precision is appropriate
- Use **bold** for non-negotiable requirements
- Use *italic* for soft preferences or clarifying notes
- Use `@see()` to cross-reference related sections in other files
- Use `@ref()` to link to external resources (design files, API docs, guidelines)

Example:
```spectacular
# Authentication
@label(auth)

The app requires sign-in before any content is accessible.

## Sign In

Users sign in with email and password.
The email field validates format before submission.
**Failed sign-in attempts must be rate-limited to 5 per minute.**

@see(security@tls)

## Sign Out

Sign out is available from the profile screen.
Signing out clears all local session data.

@see(security@token-storage)
```

### 3. Add variant layers

Only create layer files for features that differ on that variant. The layer file should:
- Use the same filename as the base file it extends
- Use the same section headings to extend those sections
- Only contain what's different — don't repeat the base
- Use `@remove ## Section` to remove sections that don't apply
- Use prose negation ("X is not supported") for partial removals within a section

Example iOS layer:
```spectacular
# Authentication

## Sign In

The email field uses the `.emailAddress` keyboard type.
Sign in with Apple is available as the first social option.

@ref(https://developer.apple.com/sign-in-with-apple/)
```

### 4. Cross-cutting files

For concerns that apply across features (security, accessibility, performance), write dedicated files with broadly-scoped statements:

```spectacular
# Security

All API communication **must** use TLS 1.3 or higher.
PII **must not** be written to application logs.
```

The analysis tools will cross-reference these against feature-specific files.

## Task: Setting Up Analysis Tooling

When setting up a project to use Spectacular analysis:

### 1. Install the package

```bash
npm install --save-dev spectacular-lang
```

### 2. Add scripts to package.json

```json
{
  "scripts": {
    "spec:resolve": "spc --path spec resolve",
    "spec:resolve:ios": "spc --path spec resolve ios",
    "spec:resolve:android": "spc --path spec resolve android",
    "spec:diff": "spc --path spec diff ios android",
    "spec:check": "spc --path spec check --json",
    "spec:check:ios": "spc --path spec check --json --variant ios"
  }
}
```

### 3. Reference in CLAUDE.md (for Claude Code projects)

Add to the project's CLAUDE.md:

```markdown
## Specification

This project uses the Spectacular language for its software specification.
The spec is in the `spec/` directory.

- Language reference: node_modules/spectacular-lang/language-spec.md
- AI integration guide: node_modules/spectacular-lang/AI.md
- Resolve the spec: `npm run spec:resolve` (or `spec:resolve:ios`, etc.)
- Analyze the spec: `npm run spec:check`

When writing or modifying code:
- Read the relevant .spc files first to understand requirements
- The spec is the source of truth — code must match the spec
- If the spec is ambiguous, ask before assuming

When modifying the spec:
- Run `npm run spec:check` after changes to catch issues
- Fix errors and review warnings before considering the spec complete
```

## Task: Running Analysis and Acting on Results

### Running checks

```bash
# All checks, machine-readable output
spc --path spec check --json

# Specific check types
spc --path spec check ambiguity --json
spc --path spec check consistency --json
spc --path spec check completeness --json
spc --path spec check redundancy --json

# Check a resolved variant
spc --path spec check --variant ios --json

# Use a specific provider
spc --path spec check --provider claude
spc --path spec check --provider codex
spc --path spec check --provider gemini
```

### Interpreting findings

Findings have three severity levels:

- **error** — Must be addressed. High risk of wrong implementation or a direct conflict.
- **warning** — Should be reviewed. Multiple reasonable interpretations exist, or there's a semantic tension.
- **info** — Optional improvement. Minor imprecision that's probably fine.

### Acting on findings

For each finding, decide:

1. **Fix it** — Add precision to the spec to resolve the ambiguity/conflict/gap. This is the right choice for errors and most warnings.

2. **Ask a clarifying question** — If you can't resolve the issue without human input, formulate a specific question. For example:
   - "The spec says sessions expire after 30 minutes, but also says users should stay logged in for convenience. Which takes priority?"
   - "Authentication error handling isn't specified. Should I add rate limiting, account lockout, or both?"

3. **Acknowledge it** — For info-level findings about intentional vagueness, no action is needed. The spec author chose low precision deliberately.

After making changes, re-run `spc check` to verify that fixed issues don't reappear and that new issues weren't introduced.

## Task: Maintaining Specs

When requirements change:

### Adding a feature

1. Decide if the feature belongs in an existing file or a new file.
2. Add sections with `@label()` for anything other files might reference.
3. Add `@see()` references to related cross-cutting concerns.
4. Add variant-layer overrides if the feature differs across platforms.
5. Run `spc check` and address findings.

### Modifying a feature

1. Read the current spec section and all layer overrides for context.
2. Update the base section and any affected layer files.
3. Check for `@see()` references pointing to the changed section — update or notify.
4. Run `spc check consistency` to catch conflicts with other sections.

### Removing a feature

1. Remove the section from the base file.
2. Remove corresponding sections from all layer files.
3. Search for `@see()` and `@label()` references to the removed content and clean them up.
4. Run `spc check` to verify.

### Adding a new variant/platform

1. Create a new directory under `_layers_/`.
2. Add `.spc` files only for features that differ from the base.
3. Use `spc diff base <new-variant>` to review what the layer changes.
4. Run `spc check --variant <new-variant>` to analyze the resolved spec.

## Task: Generating Code from Specs

When generating or modifying code based on a spec:

### 1. Resolve the target variant

```bash
spc --path spec resolve ios
```

This gives you the complete, merged specification for that platform with all layers applied.

### 2. Read the resolved spec

The resolved output is the authoritative source. Do not reason about layer merging yourself — use the resolved output.

### 3. Map spec sections to code

- Each `#` top-level heading typically maps to a major module or feature area.
- Each `##` section maps to a component, screen, service, or behavior.
- `@ref()` links point to external resources that may contain additional implementation details.
- `@see()` links indicate dependencies between features — implement referenced features first or in tandem.

### 4. Respect precision levels

- **High-precision statements** (specific values, API details, exact behaviors) — implement exactly as written.
- **Medium-precision statements** (general approach, rough behavior) — implement using best practices for the target platform, staying within the stated constraints.
- **Low-precision statements** (intent, feel, general direction) — use your judgment, but flag any significant decisions you made that weren't specified.

### 5. Validate against the spec

After generating code, mentally trace each spec statement to verify it's implemented. Flag any statements you couldn't implement or had to deviate from.
