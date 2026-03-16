# Tasks

## Task Completion

Completing a task triggers haptic feedback using `HapticFeedbackConstants.CONFIRM`.

@remove ## 3D Touch Quick Actions

## Long-Press Context Menu

Long-pressing a task row opens a context menu with actions:

- Complete / Uncomplete
- Edit
- Move to list
- Delete

The context menu uses the Material Design 3 popup menu component.

## Task Creation

A floating action button (FAB) in the bottom-right corner opens task creation.
The FAB uses the `add` Material Symbol and the primary container color.
The FAB hides on scroll-down and reappears on scroll-up.

@rem The FAB replaces the "prominent button" mentioned in the base spec

## Quick Add

The quick-add text field appears inside an expanding FAB animation
when the FAB is tapped, rather than being always visible.
