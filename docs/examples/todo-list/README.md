# Todo List App — Spectacular Example

A simple task management app specified in Spectacular, demonstrating layered specs across iOS and Android.

## Structure

```
todo-list/
  app.spc              — App overview, auth, cloud sync, data model
  tasks.spc            — Task CRUD, completion, quick add
  lists.spc            — Default Inbox, custom lists, list switching
  navigation.spc       — Bottom toolbar, screen transitions
  security.spc         — TLS, token storage, encryption, input validation
  notifications.spc    — Due date reminders, quiet hours, settings
  _layers_/
    ios/
      navigation.spc   — Safe area, SF Symbols, iOS tab bar HIG
      tasks.spc        — Swipe actions, haptics, 3D Touch quick actions
      notifications.spc — UNUserNotificationCenter, badge count, permission strategy
    android/
      navigation.spc   — Material Design 3, Material Symbols, predictive back
      tasks.spc        — Long-press context menu, FAB, @remove 3D Touch
      notifications.spc — Notification channels, AlarmManager, POST_NOTIFICATIONS
```

## Directives Used

| Directive | Count | Examples |
|-----------|-------|---------|
| `@label`  | 12    | `cloud-sync`, `task-list`, `tls`, `due-reminders`, `quick-actions` |
| `@see`    | 9     | Cross-refs between security, sync, tasks, lists |
| `@ref`    | 4     | Apple HIG, Material Design docs |
| `@rem`    | 3     | Author notes (stretch goals, implementation notes) |
| `@remove` | 1     | Android removes `## 3D Touch Quick Actions` |

## Running the Tools

```bash
# Resolve base spec (no platform layers)
npx spc --path docs/examples/todo-list resolve

# Resolve merged iOS or Android spec
npx spc --path docs/examples/todo-list resolve ios
npx spc --path docs/examples/todo-list resolve android

# Diff iOS vs Android
npx spc --path docs/examples/todo-list diff ios android

# Diff base vs a platform (see what a layer adds)
npx spc --path docs/examples/todo-list diff base ios

# AI-powered analysis (requires ANTHROPIC_API_KEY by default)
npx spc --path docs/examples/todo-list check
npx spc --path docs/examples/todo-list check ambiguity
npx spc --path docs/examples/todo-list check --variant ios
npx spc --path docs/examples/todo-list check --provider codex   # uses OPENAI_API_KEY
npx spc --path docs/examples/todo-list check --provider gemini  # uses GEMINI_API_KEY
```

## Sample Analysis Results

The following results were produced by running `spc check` on the **base spec** (no variant) using `claude-opus-4-20250514`. They demonstrate the kinds of issues the analysis tools surface.

### Ambiguity — 5 errors, 6 warnings, 3 info

The ambiguity check flags statements that are too vague for reliable code generation.

**Errors (high risk of wrong implementation):**

- **app.spc > Authentication** — No specification of authentication flow, error handling, or what happens after failed login attempts.
- **app.spc > Cloud Sync** — "Real time" is not defined — could mean instant, within seconds, or minutes.
- **navigation.spc > Bottom Toolbar** — "Visually highlighted" is too vague — could be implemented many different ways.
- **security.spc > Data Encryption** — "Sensitive user data must be encrypted at rest" doesn't specify encryption algorithm, key management, or implementation details.
- **tasks.spc > Task List View** — Sort order for non-completed tasks is not specified.

**Warnings (multiple reasonable interpretations):**

- "Brief crossfade transition" has no duration specified.
- "Platform-appropriate secure storage" is vague per platform.
- "Prominent button" is subjective — size, position, and styling are unspecified.
- Autosave "short debounce (500ms)" doesn't address navigation-away behavior.
- Reminder timing is unclear when tasks have only a due date without a specific time.
- "Last-write-wins at the field level" doesn't define what constitutes a field.

### Consistency — 2 errors, 3 warnings, 1 info

The consistency check finds statements that conflict with each other.

**Errors:**

- **lists.spc vs app.spc** — Deleting a list "moves all its tasks to Inbox," but app.spc says "each task belongs to exactly one list" — the wording implies permanence rather than reassignment.
- **tasks.spc vs security.spc** — Task creation says titles are required but mentions no length limit; security.spc separately states a 200-character limit. These should be co-located or cross-referenced.

**Warnings:**

- The list selector is described as accessible from both the toolbar (navigation.spc) and the task list view (lists.spc) — unclear if these are the same or two entry points.
- Quick-add doesn't clarify which list new tasks are assigned to.
- Authentication requirements don't address expired tokens or offline scenarios.

### Completeness — 4 errors, 6 warnings, 5 info

The completeness check identifies likely gaps.

**Errors (would block implementation):**

- Authentication has no error handling, password requirements, account recovery, or rate limiting.
- Cloud sync has no failure scenarios, data size limits, or edge case handling.
- Task creation has no validation rules beyond requiring a title.
- Input validation section mentions validation but lacks specific rules for most fields.

**Warnings (could cause issues):**

- No data retention, backup, or export capabilities.
- No list count limits or bulk operations.
- No notification delivery guarantees or battery optimization handling.
- No performance specification for large task lists.
- No accessibility specifications for navigation or screen readers.
- No auto-save error handling.

### Redundancy — 3 warnings, 2 info

The redundancy check finds unnecessarily repeated or overlapping statements.

**Warnings:**

- app.spc duplicates the Inbox list description from lists.spc — should use `@see(lists@default-lists)` instead.
- Task title character limit appears in both tasks.spc and security.spc.
- List switching describes a crossfade transition that duplicates navigation.spc.

### Takeaways

This example spec is intentionally written at mixed precision to demonstrate the analysis tools. A real spec would iterate on these findings:

1. **Fix errors first** — ambiguity errors and consistency errors represent the highest risk of generating wrong code.
2. **Use `@see` to reduce redundancy** — cross-reference rather than duplicate information.
3. **Add precision incrementally** — not everything needs to be specified up front, but the analysis helps identify where vagueness is most costly.
