# Todo List — Spectacular Walkthrough

This walkthrough demonstrates the complete Spectacular workflow using a todo list app with iOS (SwiftUI) and Web (vanilla HTML/CSS/JS) targets.

Each step documents what was done, how it was done (manually or via `spc` tooling), and what changed.

## Phase 1: Setup

The example spec has iOS and Web layers over a shared base, demonstrating cross-platform generation between a native app (SwiftUI) and a web app (vanilla HTML/CSS/JS).

The top-level spec files are the **original v1** — intentionally imprecise, used to demonstrate `spc check`. The `evolved/` directory contains the **final v4** spec after all walkthrough refinements. The `targets/` code is generated from the evolved spec.

### Directory structure

```
todo-list/
  *.spc (6 base files — original v1)
  _layers_/
    ios/ (3 files — original)
    web/ (3 files — original)
  evolved/
    *.spc (6 base files — refined v4)
    _layers_/
      ios/ (3 files — refined)
      web/ (3 files — refined)
  targets/
    ios/TodoList/ (generated from evolved spec)
    web/ (generated from evolved spec)
```

---

## Phase 2: Initial Code Generation

### Step 2.1: Resolve the specs

Before generating, review the resolved specs for each variant to understand what the AI will work with.

```bash
npx spc --path docs/examples/todo-list resolve web
npx spc --path docs/examples/todo-list resolve ios
```

### Step 2.2: Generate code

Generate the web and iOS targets from the spec:

```bash
npx spc --path docs/examples/todo-list generate web --source web=docs/examples/todo-list/targets/web
npx spc --path docs/examples/todo-list generate ios --source ios=docs/examples/todo-list/targets/ios
```

> **Note:** `spc generate` creates a snapshot before making changes. If the output is unsatisfactory, check the recovery instructions it prints.

### Results

**Web target** — Generated 2 files:
- `app.js` (~1080 lines) — TodoApp class with auth, task CRUD, list management, notifications, offline sync queue, keyboard shortcuts (n, Escape, Delete), hash-based routing
- `style.css` (~860 lines) — Responsive design with bottom nav → sidebar at 768px, modals, animations, toast messages

**iOS target** — Generated 14 files:
- Models: `Task.swift`, `TodoList.swift`, `User.swift`
- Services: `AuthService.swift`, `DataService.swift`, `NotificationService.swift`
- Views: `AuthView.swift`, `TaskListView.swift`, `NewTaskView.swift`, `TaskDetailView.swift`, `ListSelectorView.swift`, `SettingsView.swift`
- App: `ContentView.swift` (tab navigation, notification handling), `TodoListApp.swift` (3D Touch quick actions)

Both targets were generated using `claude-sonnet-4-20250514` via the API with streaming enabled.

---

## Phase 3: Spec Refinement

After initial generation, run the analysis tools to identify issues in the resolved specs.

### Step 3.1: Check both variants

```bash
npx spc --path docs/examples/todo-list check --variant web
npx spc --path docs/examples/todo-list check --variant ios
```

### Step 3.2: Review findings and update specs

The checks surfaced several issues. We addressed the errors and key warnings by manually editing the base spec files:

| Finding | Severity | Change made |
|---------|----------|-------------|
| "Real time" sync is ambiguous | warn | Changed to "within 5 seconds of a change" in app.spc |
| Field-level conflict resolution undefined | warn | Listed the individual fields (title, due date, priority, notes, completion status) and specified server timestamps |
| app.spc duplicates Inbox description from lists.spc | warn | Replaced with `@see(lists@default-lists)` |
| "Each task belongs to exactly one list" implies permanence | error | Changed to "at a time (tasks can be moved between lists)" |
| List deletion wording implies all lists deletable | error | Changed to "delete custom lists" and added "(the Inbox list cannot be modified)" |
| List name uniqueness unclear on case/whitespace | error | Added "case-insensitive, whitespace-trimmed" |
| Task sort order not specified | warn | Added explicit sort: priority → due date → creation date |
| Task title limit only in security.spc, not task creation | error | Added "(max 200 characters)" to task creation section |
| "Brief entrance animation" vague | info | Left as-is (low risk) |
| "Brief, subtle animation" on completion | warn | Changed to "200ms scale animation" |
| Debounce behavior on navigation unclear | warn | Added "If the user navigates away, changes are saved immediately" |
| Reminder timezone not specified | error | Added "in the user's local timezone" |
| "At most 3 reminders" unclear if default counts | warn | Clarified: default + up to 2 additional = 3 max |
| Quiet hours boundary times ambiguous | warn | Changed to "10:00 PM through 6:59 AM" |
| "Brief crossfade" duration unspecified | warn | Changed to "200ms crossfade" |
| Self-referencing @see in iOS tasks layer | warn | Removed the circular `@see(#task-completion)` |
| List color selection mechanism unspecified | info | Added "chosen from a preset palette" |

### Step 3.3: Regenerate

After updating the spec:

```bash
npx spc --path docs/examples/todo-list generate web --source web=docs/examples/todo-list/targets/web
npx spc --path docs/examples/todo-list generate ios --source ios=docs/examples/todo-list/targets/ios
```

Both targets were regenerated to incorporate the refined spec. The generated code now includes explicit sort ordering, proper debounce-on-navigate behavior, and timezone-aware reminders.

---

## Phase 4: New Feature — Task Search

### Step 4.1: Write the spec (manual)

We added a `## Task Search` section to three files:

**Base (`tasks.spc`):**
```spectacular
## Task Search
@label(task-search)

A search bar is available above the task list.
Search matches against task titles and notes (case-insensitive substring match).
Results are displayed inline in the task list — non-matching tasks are hidden.
Matching text is highlighted in the results.
Search applies across all lists, not just the currently selected list.
Clearing the search restores the normal list view.
```

**iOS layer (`_layers_/ios/tasks.spc`):**
```spectacular
## Task Search

Search uses a UISearchController-style search bar that appears when scrolling up.
The cancel button dismisses the search and restores the previous list view.
```

**Web layer (`_layers_/web/tasks.spc`):**
```spectacular
## Task Search

The search input is a sticky text field above the task list.
Results filter in real-time as the user types (no submit required).
```

Also added `Ctrl+K` / `Cmd+K` to the web keyboard shortcuts and `Escape` clears active search.

### Step 4.2: Check the new spec

```bash
npx spc --path docs/examples/todo-list check
```

### Step 4.3: Generate

```bash
npx spc --path docs/examples/todo-list generate web --source web=docs/examples/todo-list/targets/web
npx spc --path docs/examples/todo-list generate ios --source ios=docs/examples/todo-list/targets/ios
```

---

## Phase 5: Bug Fix → Absorb → Regenerate

This phase demonstrates the most important Spectacular workflow: fixing a bug in code, feeding the fix back into the spec, and propagating it to all variants.

### The bug

In the web version, when a user deletes a list while offline, the deletion appears to succeed — tasks move to Inbox in the UI — but the server-side deletion never happens. When connectivity returns and the app syncs, the deleted list reappears with all its original tasks, causing confusion.

### Step 5.1: Fix the bug in web code (manual)

The bug: `deleteList()` in `app.js` proceeds with the deletion locally when offline (moves tasks to Inbox, removes the list from the UI) and queues a sync action. But the server never receives the delete. When connectivity returns, the list reappears with its original tasks.

The fix: add an offline check at the top of `deleteList()`:

```javascript
// Block destructive operations while offline
if (!this.isOnline) {
  this.showError('Cannot delete a list while offline. Please try again when connected.');
  return;
}
```

Also removed the offline queue fallback for deletion — if we're online and the API call fails, show an error instead of silently queuing.

### Step 5.2: Absorb the fix

```bash
npx spc --path docs/examples/todo-list absorb web --source web=docs/examples/todo-list/targets/web
```

The absorb command analyzed the code diff against the resolved web spec and proposed 7 changes. However, most were noise from prior regenerations — the absorb didn't isolate the key offline deletion fix from the broader diff.

**Lesson learned:** `spc absorb` works best when the diff is small and focused (e.g., `--staged` with just the bug fix committed). When the diff includes large regenerated files, the signal gets lost in the noise.

### Step 5.3: Apply spec changes (manual)

We manually added the critical change to the **base layer** (`app.spc > Cloud Sync`), since offline behavior for destructive operations applies to all platforms:

```spectacular
Non-destructive changes made offline are queued and synced when connectivity is restored.
**Destructive operations (deleting lists, deleting tasks) must not proceed while offline.**
The app must detect connectivity and show an error message if a destructive operation
cannot be synced. This prevents ghost deletions that revert on next sync.
```

This replaced the previous wording: "Changes made offline are queued and synced when connectivity is restored."

### Step 5.4: Regenerate iOS to propagate the fix

```bash
npx spc --path docs/examples/todo-list generate ios --source ios=docs/examples/todo-list/targets/ios
```

The iOS code is regenerated with the updated spec. The AI now knows to block list/task deletion when offline and show an error, matching the web behavior.

---

## Phase 6: Summary

### Final spec state

The spec evolved through 4 versions:

| Version | Trigger | Changes |
|---------|---------|---------|
| v1 | Initial spec | 6 base files + iOS and Web layers |
| v2 | `spc check` findings | 17 fixes: sort order, timezone, debounce behavior, animation durations, list deletion clarity, field-level sync definition |
| v3 | New feature (manual) | Added `## Task Search` to base + both layers, with cross-list search and platform-specific UI |
| v4 | Bug fix (absorb) | Added offline blocking for destructive operations to base `Cloud Sync` section |

### Final file inventory

**Base spec** (6 files): app.spc, tasks.spc, lists.spc, navigation.spc, notifications.spc, security.spc

**iOS layer** (3 files): navigation.spc, tasks.spc, notifications.spc

**Web layer** (3 files): navigation.spc, tasks.spc, notifications.spc

**Generated targets:**
- `targets/web/` — 3 files (index.html, app.js, style.css) — vanilla HTML/CSS/JS
- `targets/ios/TodoList/` — 14 files (Models, Services, Views, App) — SwiftUI

### What we demonstrated

1. **Generate** — Producing working web and iOS apps from a layered spec using `spc generate`
2. **Check + refine** — Using `spc check` to find ambiguities and consistency issues, then manually updating the spec to fix them
3. **New feature** — Writing spec sections for Task Search first, then regenerating code for both platforms
4. **Bug fix feedback loop** — Finding an offline deletion bug in web code, fixing it, running `spc absorb` to propose spec changes, manually applying the cross-platform fix to the base layer, and regenerating iOS to propagate it

### Lessons learned

1. **Start imprecise, refine iteratively.** The initial spec was intentionally vague in places. `spc check` identified exactly where that vagueness would cause problems, and we fixed only what mattered.

2. **Cross-platform bugs often belong in the base layer.** The offline deletion bug was found in the web code, but the fix — blocking destructive operations while offline — applies to all platforms. The spec change went into `app.spc`, not `_layers_/web/`.

3. **`spc absorb` works best with focused diffs.** When the diff includes entire regenerated files, the absorb output is noisy. Use `--staged` or `--commit` to isolate the specific fix for best results.

4. **The spec is a living document.** Over 4 iterations, the spec went from "good enough to start" to "precise enough to generate consistent cross-platform code." This is the intended workflow — not perfection up front, but rapid iteration with tooling support.

5. **AI code generation needs large token limits and streaming.** The initial 4K token limit was far too small for generating complete files. Streaming solved API timeout issues. Use Sonnet for generation (fast, good code quality) and Opus for analysis (deep reasoning).
