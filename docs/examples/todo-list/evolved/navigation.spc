# Navigation
@label(main-nav)

## Bottom Toolbar

The app uses a persistent bottom toolbar for primary navigation.
The toolbar has three items:

- **Tasks** (left) — navigates to the task list view
- **Lists** (center) — opens the list selector
- **Settings** (right) — opens the settings screen

The active item is visually highlighted with a filled icon and label.
Inactive items show an outline icon without a label.

## Screen Transitions

Navigating between top-level toolbar destinations uses a crossfade transition.
Navigating into detail views (task detail, list settings) uses a push transition.
The back button or swipe-back gesture returns to the previous screen.
