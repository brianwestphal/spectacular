# Tasks

## Task List View
@label(task-list)

The main screen shows a scrollable list of tasks for the currently selected list.
Each task row displays:

- Title
- Due date, if set (*displayed as relative text like "Tomorrow" or "In 3 days" when within 7 calendar days*)
- Priority indicator (colored dot: red for high, orange for medium, none for low)
- Completion checkbox

Active tasks are sorted by: priority (high first), then due date (soonest first), then creation date (newest first).
Completed tasks appear with a strikethrough title and are sorted to the bottom.
Tapping a task opens its detail view.

## Task Creation
@label(task-creation)

A prominent button below the task list opens a detailed creation form.
New tasks require a title (max 200 characters). The following fields are optional:

- Due date (date picker)
- Priority level (high, medium, low — defaults to low)
- Notes (free-text, supports basic markdown)
- List assignment (defaults to the currently viewed list)

After creation, the new task appears at the top of the list with a brief entrance animation.

## Task Detail

The detail view shows all task fields and allows inline editing.
Changes save automatically after the user stops editing for 500ms.
If the user navigates away before the debounce completes, changes are saved immediately.
@see(app@cloud-sync)

A delete action is available at the bottom of the detail view.
**Deleting a task requires a confirmation prompt.**

## Task Completion
@label(task-completion)

Tapping the checkbox on a task row toggles its completion state.
Completing a task plays a 200ms scale animation on the checkbox.
Uncompleting a task moves it back to its sorted position among active tasks.

## Quick Add

@rem Stretch goal — might cut from v1
A text field pinned above the task list allows rapid task creation by title only.
Pressing return creates the task and clears the field.

## Task Search
@label(task-search)

A search bar is available above the task list.
Search matches against task titles and notes (case-insensitive substring match).
Results are displayed inline in the task list — non-matching tasks are hidden.
Matching text is highlighted in the results.
When searching, results include tasks from all lists (not just the currently selected list).
Each result shows its list name so the user knows where it belongs.
Clearing the search restores the normal single-list view.
