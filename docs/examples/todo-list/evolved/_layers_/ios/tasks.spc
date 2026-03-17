# Tasks

## Task Completion

Completing a task triggers haptic feedback (light impact).

## Swipe Actions

Swiping left on a task row reveals a red "Delete" action.
Swiping right on a task row reveals a green "Complete" toggle action.
Swipe actions use standard iOS trailing/leading swipe-action styling.

## 3D Touch Quick Actions
@label(quick-actions)

Force-pressing the app icon shows quick actions:

- "New Task" — opens task creation in the Inbox list
- "Search" — opens the task search view

@rem These become long-press actions on devices without 3D Touch

## Task Creation

The new-task sheet presents as a compact modal card (medium detent).
The sheet can be expanded to full screen by dragging up.

## Task Search

Search uses a UISearchController-style search bar that appears when scrolling up.
The cancel button dismisses the search and restores the previous list view.
