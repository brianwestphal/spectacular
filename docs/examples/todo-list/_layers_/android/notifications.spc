# Notifications

## Notification Channels

The app creates the following notification channels on first launch:

- **Task Reminders** (ID: `task_reminders`) — default importance: high
- **Sync Status** (ID: `sync_status`) — default importance: low

Users can manage channel importance and behavior through Android system settings.

## Permission Request

On Android 13+, the app requests the `POST_NOTIFICATIONS` runtime permission
after the user creates their first task with a due date.
On Android 12 and below, no runtime permission is needed.

## Due Date Reminders

Reminders use AlarmManager with `setExactAndAllowWhileIdle` to ensure
delivery even in Doze mode.
A lightweight foreground service handles reminder scheduling to survive
process termination.
The foreground service shows a persistent low-priority notification in the
Sync Status channel while active.

## Notification Actions

Notification actions allow "Complete" and "Snooze (1 hour)" directly from
the notification shade.
@see(tasks@task-completion)

## Quiet Hours

*On Android, quiet hours defer to the system Do Not Disturb settings
rather than implementing custom quiet-hour logic.*
