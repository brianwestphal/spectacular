# Notifications

## Permission Request

The app requests notification permission after the user creates their first task
with a due date (*not on first launch — this improves opt-in rates*).

The permission prompt is preceded by a custom in-app screen explaining the value
of enabling notifications.

## Badge Count

The app icon badge displays the count of overdue tasks.
The badge count updates when tasks are completed, when due dates pass,
and when the app syncs.
@see(app@cloud-sync)

## Due Date Reminders

Reminders are scheduled as local notifications using UNUserNotificationCenter.
Notification actions allow "Complete" and "Snooze (1 hour)" directly from
the notification banner.
@see(tasks@task-completion)
