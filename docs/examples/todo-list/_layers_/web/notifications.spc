# Notifications

## Due Date Reminders

Reminders use the Web Notifications API (`Notification.requestPermission()`).
If the browser does not support notifications, reminders are shown as in-app toast messages instead.

## Permission Request

The app requests notification permission after the user creates their first task
with a due date.
A dismissible banner explains the value of notifications before the browser prompt.

## Quiet Hours

Quiet hours are enforced client-side by suppressing notification display.
*The user can still see missed reminders in a notification history panel.*

@remove ## Badge Count
