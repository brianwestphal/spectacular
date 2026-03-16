# Tasks

## Task List View
@label(task-list)

The main screen shows a scrollable list of tasks for the currently selected list.
Each task row displays:

- Title
- Due date, if set (*displayed as relative text like "Tomorrow" or "In 3 days" when within a week*)
- Priority indicator (colored dot: red for high, orange for medium, none for low)
- Completion checkbox

Completed tasks appear with a strikethrough title and are sorted to the bottom.
Tapping a task opens its detail view.

## Task Creation
@label(task-creation)

A prominent button on the task list screen allows creating a new task.
New tasks require a title. The following fields are optional:

- Due date (date picker)
- Priority level (high, medium, low — defaults to low)
- Notes (free-text, supports basic markdown)
- List assignment (defaults to the currently viewed list)

After creation, the new task appears at the top of the list with a brief entrance animation.

## Task Detail

The detail view shows all task fields and allows inline editing.
Changes save automatically after a short debounce (500ms).
@see(app@cloud-sync)

A delete action is available at the bottom of the detail view.
**Deleting a task requires a confirmation prompt.**

## Task Completion
@label(task-completion)

Tapping the checkbox on a task row toggles its completion state.
Completing a task plays a brief, subtle animation on the checkbox.
Uncompleting a task moves it back to its sorted position among active tasks.

## Quick Add

@rem Stretch goal — might cut from v1
A text field pinned above the task list allows rapid task creation by title only.
Pressing return creates the task and clears the field.
