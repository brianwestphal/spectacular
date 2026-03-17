# Claude Setup Prompt for Spectacular

Copy everything below this line and paste it into Claude Code in your project.

---

I want to set up this project to use the Spectacular specification language as its source of truth. Do the following:

## 1. Install the tools

```bash
npm install --save-dev spectacular-lang
```

## 2. Learn the language and tools

Read these files from the installed package to understand the language and workflow:
- `node_modules/spectacular-lang/language-spec.md` — full language spec
- `node_modules/spectacular-lang/AI.md` — AI integration guide (this is your operational playbook)

## 3. Convert existing specifications

Look through the project for any existing specification documents, requirements files, design docs, README sections describing features, or any other source-of-truth documents. Common locations: `docs/`, `spec/`, `SPEC.md`, `REQUIREMENTS.md`, feature descriptions in `README.md`, Notion exports, etc.

Convert them into Spectacular `.spc` files following these rules:
- Create a `spec/` directory at the project root
- Create one `.spc` file per major feature area or concern
- Create `spec/_layers_/` for platform/variant customizations if applicable
- Use `@label()` on sections other files will reference
- Use `@see()` for cross-references between files
- Use `@ref()` to link back to any external resources (design files, API docs, etc.)
- Use **bold** for non-negotiable requirements
- Use *italic* for soft preferences
- Preserve the intent and precision level of the original docs — don't add precision that wasn't there
- If the original docs have platform-specific sections, split them into base + layer files

## 4. Set up package.json scripts

Add these scripts (adjust paths and variant names to match this project):

```json
{
  "spec:resolve": "spc --path spec resolve",
  "spec:check": "spc --path spec check",
  "spec:check:json": "spc --path spec check --json"
}
```

If this project has platform variants (e.g., ios, android, web), also add:

```json
{
  "spec:resolve:<variant>": "spc --path spec resolve <variant>",
  "spec:check:<variant>": "spc --path spec check --variant <variant>",
  "spec:absorb:<variant>": "spc --path spec absorb <variant> --source <variant>=./<source-dir>",
  "spec:generate:<variant>": "spc --path spec generate <variant> --source <variant>=./<source-dir>",
  "spec:generate:all": "spc --path spec generate all --source <variant1>=./<dir1> --source <variant2>=./<dir2>"
}
```

## 5. Set up CLAUDE.md

Add a "Specification" section to this project's CLAUDE.md (create the file if it doesn't exist). Use this template:

```markdown
## Specification

This project uses the Spectacular language for its software specification.
The spec is in the `spec/` directory.

- Language reference: node_modules/spectacular-lang/language-spec.md
- AI integration guide: node_modules/spectacular-lang/AI.md
- Resolve the spec: `npm run spec:resolve`
- Analyze the spec: `npm run spec:check`

When writing or modifying code:
- Read the relevant .spc files first to understand requirements
- The spec is the source of truth — code must match the spec
- If the spec is ambiguous, ask before assuming

When fixing bugs:
- After fixing a bug in code, run the appropriate `spec:absorb:*` script
- Review and apply the proposed spec changes
- Then regenerate other variants to propagate the fix

**Important**: Any change to requirements, behavior, or constraints must be
reflected in the spec files. The spec is the source of truth — do not change
code behavior without updating the spec to match.

When modifying the spec:
- Run `npm run spec:check` after changes to catch issues
- Fix errors and review warnings before considering the spec complete
```

## 6. Run initial analysis

After creating the spec files, run `npm run spec:check` and show me the results. Address any errors — they represent the highest risk of generating wrong code. Warnings can be reviewed together.

## 7. Summary

When you're done, show me:
- The directory structure of `spec/`
- A brief summary of what was converted and from where
- The `spc check` results
- Any decisions you made or questions you have about ambiguous requirements
