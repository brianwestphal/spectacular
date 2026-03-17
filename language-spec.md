# Spectacular Language Specification — Draft v0.2

Spectacular is a language for specifying software as a layered, human-readable source of truth. It is designed to be written and read by both humans and AI tools like Claude Code.

## Core Principles

- **Prose-first**: Specifications are written in natural language. Structure is added only where it aids clarity or tooling.
- **Layered**: A base specification can be extended, overridden, or reduced by variant layers (platforms, environments, customers, etc.).
- **Mixed precision**: Statements range from high-level intent to exact technical detail. Both are valid. Analysis tools help identify where precision is insufficient.
- **Cross-cutting**: Concerns like security or accessibility can be specified broadly in their own files and apply across all features — or specified narrowly within a feature. The same information can be organized by feature or by vertical.

## File Structure

### Extensions

- `.spectacular` — full extension
- `.spc` — short extension

Both are equivalent. A project may use either or both.

### Directory Layout

A Spectacular project is a directory tree. All `.spectacular` and `.spc` files within the tree form the specification. Files are peers — no imports or exports are needed. Every file at the same directory level is part of the same layer.

```
my-app/
  authentication.spc
  payment.spc
  security.spc
  _layers_/
    ios/
      authentication.spc
      design.spc
    android/
      authentication.spc
    web/
      payment.spc
```

### The `_layers_` Directory

A directory named `_layers_` signals that its subdirectories are **variant layers**. Each subdirectory represents a named variant (platform, environment, customer, etc.).

Files within a layer correspond to files in the parent directory by name. A layer file extends, overrides, or removes content from its corresponding base file.

Layers can be nested for arbitrary depth:

```
my-app/
  authentication.spc
  _layers_/
    mobile/
      authentication.spc
      _layers_/
        ios/
          authentication.spc
        android/
          authentication.spc
    web/
      authentication.spc
```

**Resolution order** follows directory depth. For the `ios` variant, the resolved specification for authentication merges in order:

1. `my-app/authentication.spc` (base)
2. `my-app/_layers_/mobile/authentication.spc` (mobile layer)
3. `my-app/_layers_/mobile/_layers_/ios/authentication.spc` (ios layer)

Each layer extends the previous. When statements conflict, the deeper (more specific) layer wins.

### Layer-Only Files

A layer may introduce files that don't exist in the parent. These represent features or concerns that apply only to that variant.

```
my-app/
  _layers_/
    ios/
      app-store-compliance.spc   @rem iOS-only concern
```

## Syntax

Spectacular's syntax is markdown with a small set of directive extensions. Standard markdown features — headings, paragraphs, lists, bold, italic, code blocks, links — all work as expected and carry their natural meaning.

**All directives start with `@`.** This is the single rule that separates Spectacular syntax from standard markdown. Everything beginning with `@` is a directive; everything else is markdown.

### Sections

Sections use markdown headings:

```
# Authentication

## Sign In

## Sign Out
```

Sections can nest to arbitrary depth via heading levels (`#` through `######`). Sections are the primary unit of organization and the primary unit of layering — a layer can extend, override, or remove a section by matching its heading.

### Statements

Statements are prose — sentences or paragraphs within a section. Each statement describes a requirement, behavior, constraint, or characteristic.

```
## Sign In

The sign in screen presents email and password fields centered on the screen.
A "Sign In" button submits the credentials.
On successful sign in, the user is navigated to the home screen.
On failure, an error message is displayed inline below the form.
```

Statements can be any level of precision:

```
## Sign In

The sign in experience should feel fast and responsive.

The sign in API call must complete within 2 seconds under normal network conditions.
The API endpoint is POST /api/v2/auth/signin and accepts a JSON body
with `email` and `password` fields.
```

### Lists

Standard markdown lists for enumerating requirements:

```
## Password Requirements

- At least 8 characters
- At least one uppercase letter
- At least one number
- Must not match any of the user's last 5 passwords
```

### Emphasis and Strength

Standard markdown emphasis carries meaning:

- **Bold** for critical / non-negotiable requirements
- *Italic* for clarifying notes or soft preferences

```
The payment flow **must not** store raw credit card numbers at any point.
The exact animation timing *may be adjusted* during implementation.
```

### Code Blocks

When exact technical details are needed, use fenced code blocks:

```
## API Response Format

The sign in endpoint returns:

​```json
{
  "token": "string",
  "expires_in": 3600,
  "user": {
    "id": "string",
    "email": "string"
  }
}
​```
```

## Directives

All directives begin with `@` and appear on their own line (unless otherwise noted). This is the only non-markdown syntax in Spectacular.

### Directive Reference

| Directive | Purpose | Example |
|---|---|---|
| `@label(id)` | Stable anchor for referencing | `@label(auth-flow)` |
| `@see(reference)` | Cross-reference within the spec | `@see(security#tls)` |
| `@ref(url-or-path)` | External resource pointer | `@ref(./designs/login.figma)` |
| `@remove ## Heading` | Remove a section from parent layer | `@remove ## Social Sign-In` |
| `@rem text` | Single-line comment (not part of spec) | `@rem TODO: revisit this` |
| `@+rem` / `@-rem` | Multi-line comment block (nestable) | see below |

### Parenthesized Values

Directives that take parenthesized arguments — `@label()`, `@see()`, `@ref()`, and any future directives — support two forms:

**Bare value** — when the value contains no special characters:

```
@label(auth-flow)
@see(security#network-communication)
@ref(./designs/login.figma)
```

**Quoted value** — single or double quotes, with JavaScript-style escaping, when the value contains parentheses or other characters that would be ambiguous:

```
@ref("https://example.com/path_(with_parens)/page")
@ref('https://example.com/path_(with_parens)/page')
@label("my \"complex\" label")
@ref('it\'s a path')
```

Supported escape sequences within quoted values: `\"`, `\'`, `\\`, `\n`, `\t`.

### `@label` — Stable Anchors

Attaches a stable identifier to a section or statement. Labels provide a fixed reference point that doesn't break when headings are renamed.

```
@label(auth-flow)
## Authentication Flow

The user signs in with email and password.
```

Other parts of the spec can then reference this label:

```
@see(auth-flow)
```

Labels must be unique within a file. When referenced from another file, use the format `filename@label-id`:

```
@see(authentication@auth-flow)
```

### `@see` — Cross-References

References another section within the specification. Appears on its own line within a section.

**By label:**

```
@see(auth-flow)
@see(authentication@auth-flow)
```

**By heading slug** (heading lowercased, spaces replaced by hyphens):

```
@see(security#network-communication)
@see(#sign-in)
```

The `#` prefix distinguishes heading-slug references from label references. When referencing a heading in the same file, the filename can be omitted.

### `@ref` — External References

Points to a resource outside the specification that provides additional detail, constraints, or context.

```
@ref(https://developer.apple.com/sign-in-with-apple/)
@ref(./designs/login.figma)
@ref(../api/openapi.yaml)
@ref("https://en.wikipedia.org/wiki/RSA_(cryptosystem)")
```

### `@remove` — Section Removal

Removes a section defined in a parent layer from the resolved specification. The heading level and text must match the section being removed.

```
@remove ## Social Sign-In
```

This removes the entire section and all its contents. The section will not appear in the resolved spec for this variant.

To negate a specific behavior without removing an entire section, use prose:

```
## Social Sign-In

Facebook sign-in is not supported on this platform.
```

The analysis tools will detect that this contradicts a parent-layer statement and treat the more specific layer as authoritative.

### `@rem` — Comments

Comments are author notes that are **not part of the specification**. They are stripped during resolution and ignored by analysis tools (except for tools that specifically report on comments, like a TODO tracker).

**Single-line comment:**

```
@rem TODO: Discuss with design team whether the animation should be skippable
@rem This section needs review after the API redesign
```

**Multi-line comment block** using `@+rem` to open and `@-rem` to close:

```
@+rem
This entire block is a comment.
It can span multiple lines and include any content,
including markdown formatting that would otherwise be interpreted.
@-rem
```

**Nesting** is supported — inner blocks must have matching pairs:

```
@+rem
Outer comment.
  @+rem
  Inner comment — perhaps temporarily commenting out a commented section.
  @-rem
Still in the outer comment.
@-rem
```

## Layering Semantics

### Extension (Default Behavior)

When a layer file contains a section that also exists in the parent, the layer's content is **added** to the parent's content:

**Base `authentication.spc`:**
```
## Sign In

The sign in screen presents email and password fields.
A "Sign In" button submits the credentials.
```

**iOS layer `_layers_/ios/authentication.spc`:**
```
## Sign In

The email field uses the `.emailAddress` keyboard type.
The password field uses secure text entry.
```

**Resolved for iOS:**
```
## Sign In

The sign in screen presents email and password fields.
A "Sign In" button submits the credentials.
The email field uses the `.emailAddress` keyboard type.
The password field uses secure text entry.
```

### Override (Conflict Resolution)

When a layer statement conflicts with a parent statement, the deeper layer wins. Analysis tools will report these conflicts for human review.

**Base:**
```
## Session

Sessions expire after 30 minutes of inactivity.
```

**iOS layer:**
```
## Session

Sessions expire after 15 minutes of inactivity.
```

**Resolved for iOS:** Sessions expire after 15 minutes of inactivity.

### Removal

The `@remove` directive eliminates a section from the resolved spec:

**Base:**
```
## Social Sign-In

Users can sign in with Google or Facebook.
```

**iOS layer:**
```
@remove ## Social Sign-In
```

**Resolved for iOS:** The Social Sign-In section does not exist.

### Addition

A layer can introduce entirely new sections that don't exist in any parent:

```
## Biometric Authentication

Face ID or Touch ID can be used after initial sign in.
The user must opt in to biometric authentication explicitly.
```

## Cross-Cutting Concerns

Cross-cutting concerns require no special syntax. They emerge naturally from how the spec is organized and worded.

A file like `security.spc` with broadly-scoped statements applies across all features:

**security.spc:**
```
# Security

## Network Communication
@label(tls)

All API communication must use TLS 1.3 or higher.
Certificate pinning must be implemented for all first-party API endpoints.

## Data Storage

Sensitive user data must be encrypted at rest.
PII must not be written to application logs.
```

The analysis tools cross-reference these broad statements against feature-specific files to:

- Confirm compliance (authentication API calls use TLS — consistent)
- Flag potential violations (a logging feature that might capture PII)
- Identify gaps (a feature introduces an API call but doesn't address encryption)

Feature files can explicitly acknowledge cross-cutting concerns:

```
## Sign In

@see(security@tls)

The sign in API uses certificate pinning with the auth service certificate.
```

## Full Example

### Directory Structure

```
task-app/
  app.spc
  tasks.spc
  navigation.spc
  security.spc
  _layers_/
    ios/
      navigation.spc
      tasks.spc
    android/
      navigation.spc
```

### `app.spc`

```spectacular
# Task App

A simple task management application. Users can create, complete, and delete tasks.
The app requires authentication. Tasks are stored in the cloud and sync across devices.
```

### `tasks.spc`

```spectacular
# Tasks

## Task List
@label(task-list)

The main screen shows a scrollable list of the user's tasks.
Each task shows its title, due date (if set), and completion status.
Completed tasks appear with a strikethrough title and are sorted to the bottom.
Tapping a task opens its detail view.

## Task Creation

A prominent button on the task list screen allows creating a new task.
New tasks require a title. Due date and notes are optional.
After creation, the new task appears at the top of the list.

## Task Detail

The detail view shows the task's title, due date, notes, and completion status.
All fields are editable from the detail view.
A delete action is available, with a confirmation prompt.

## Task Completion
@label(task-completion)

Tapping a checkbox on the task list toggles completion.
Completing a task plays a brief, subtle animation.
```

### `security.spc`

```spectacular
# Security
@label(tls)

All API communication must use TLS 1.3 or higher.
Authentication tokens must be stored using platform-appropriate secure storage.
Tokens expire after 24 hours and must be refreshed transparently.
```

### `navigation.spc`

```spectacular
# Navigation
@label(bottom-toolbar)

The app uses a bottom toolbar for primary navigation.
The toolbar has three items: Tasks (left), Add Task (center), Profile (right).
The active item is visually highlighted.
```

### `_layers_/ios/navigation.spc`

```spectacular
# Navigation

The bottom toolbar accounts for the safe area inset of the device.
The toolbar follows iOS Human Interface Guidelines for tab bars.
The Add Task button uses an SF Symbol icon.

@see(tasks@task-list)
@ref(https://developer.apple.com/design/human-interface-guidelines/tab-bars)
```

### `_layers_/ios/tasks.spc`

```spectacular
# Tasks

## Task Completion

Completing a task triggers a haptic feedback (light impact).

## Swipe Actions

Swiping left on a task reveals a delete action.
Swiping right on a task toggles completion.
Swipe actions use standard iOS swipe-action styling.
```

### `_layers_/android/navigation.spc`

```spectacular
# Navigation

The bottom toolbar uses Material Design 3 navigation bar styling.
The Add Task button uses a Material Symbol icon.

@ref(https://m3.material.io/components/navigation-bar)
```

### Resolved: `navigation.spc` for iOS

After merging base + ios layer:

```spectacular
# Navigation
@label(bottom-toolbar)

The app uses a bottom toolbar for primary navigation.
The toolbar has three items: Tasks (left), Add Task (center), Profile (right).
The active item is visually highlighted.
The bottom toolbar accounts for the safe area inset of the device.
The toolbar follows iOS Human Interface Guidelines for tab bars.
The Add Task button uses an SF Symbol icon.

@see(tasks@task-list)
@ref(https://developer.apple.com/design/human-interface-guidelines/tab-bars)
```

### Resolved: `tasks.spc` for iOS

After merging base + ios layer:

```spectacular
# Tasks

## Task List
@label(task-list)

The main screen shows a scrollable list of the user's tasks.
Each task shows its title, due date (if set), and completion status.
Completed tasks appear with a strikethrough title and are sorted to the bottom.
Tapping a task opens its detail view.

## Task Creation

A prominent button on the task list screen allows creating a new task.
New tasks require a title. Due date and notes are optional.
After creation, the new task appears at the top of the list.

## Task Detail

The detail view shows the task's title, due date, notes, and completion status.
All fields are editable from the detail view.
A delete action is available, with a confirmation prompt.

## Task Completion
@label(task-completion)

Tapping a checkbox on the task list toggles completion.
Completing a task plays a brief, subtle animation.
Completing a task triggers a haptic feedback (light impact).

## Swipe Actions

Swiping left on a task reveals a delete action.
Swiping right on a task toggles completion.
Swipe actions use standard iOS swipe-action styling.
```

## Analysis Tools

### Command-Line Interface

**Spec management:**

- **`spc init [dir]`** — Scaffold a new spec directory with starter files.
- **`spc resolve [variant]`** — Produce the fully resolved spec for a variant by merging all applicable layers.
- **`spc diff <variant-a> <variant-b>`** — Show differences between two resolved variants.

**AI-powered analysis:**

- **`spc check ambiguity`** — Identify statements too vague for reliable code generation.
- **`spc check consistency`** — Identify statements that potentially conflict with each other, across files and layers.
- **`spc check completeness`** — Identify areas that likely need more detail (missing error handling, edge cases, accessibility, etc.).
- **`spc check redundancy`** — Identify unnecessarily repeated or overlapping statements.
- **`spc check`** (all) — Run all checks.
- **`spc check security`** *(phase 2)* — Identify specification patterns that may introduce security vulnerabilities.

**Code ↔ spec feedback loop:**

- **`spc absorb <variant>`** — Analyze code changes (git diff) against the current spec and propose spec updates that would prevent the bug class. Supports `--uncommitted`, `--staged`, `--commit`, `--range`, `--branch`, and `--files` for selecting which changes to absorb.
- **`spc generate <variant>`** — Generate or update source code from the resolved spec. Creates a recoverable snapshot before making changes. Use `all` to generate for all variants sequentially.

**Common options:**

All AI-powered commands (`check`, `absorb`, `generate`) support:
- `--provider` — AI provider (`claude`, `claude-cli`, `codex`, `codex-cli`, `gemini`, `gemini-cli`). Auto-detected if omitted.
- `--model` — Override the default model.
- `--json` — Machine-readable JSON output.
- `--source <variant>=<path>` — Map variant names to source code directories (for `absorb` and `generate`).

### AI-Powered Analysis

Several tools require AI to understand natural-language content:

- **Semantic conflict detection**: "Sessions expire after 30 minutes" vs. "Users should stay logged in for convenience" — these are in tension even though they don't contradict literally.
- **Ambiguity scoring**: Rating each statement's specificity and estimating the risk of misinterpretation during code generation.
- **Cross-reference validation**: Verifying that broadly-scoped statements (from security, performance, etc.) are honored by feature-specific statements.
- **Completeness heuristics**: Based on the type of feature being specified, suggesting commonly-needed specifications that may be missing.
