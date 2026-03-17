# Tasks

## Task List View

The task list is a scrollable `<ul>` element with `role="list"`.
Each task row is keyboard-focusable and activatable with Enter.

## Task Creation

The new-task button opens an inline form above the task list.
The form auto-focuses the title field on open.

## Task Completion

Completing a task triggers a CSS checkbox animation (scale 0.8 → 1.0, 200ms ease-out).

## Quick Add

The quick-add field is always visible above the task list.
Pressing Escape clears the field and blurs it.

## Task Search

The search input is a sticky text field above the task list.
Results filter in real-time as the user types (no submit required).

## Keyboard Shortcuts

- `n` — Focus the quick-add field (when no input is focused)
- `Ctrl+K` or `Cmd+K` — Focus the search field
- `Escape` — Close any open form or modal, or clear the active search
- `Delete` or `Backspace` — Delete the focused task (with confirmation)
