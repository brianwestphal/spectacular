# Todo List App

A simple task management application for organizing daily tasks across
multiple lists. Users can create, complete, and manage tasks with due dates
and priority levels.

## Authentication

The app requires authentication before any content is accessible.
Users sign in with email and password, or via third-party OAuth providers
(Google, Apple).
@see(security#token-storage)

## Cloud Sync
@label(cloud-sync)

Tasks sync across all of the user's devices within 5 seconds of a change.
Non-destructive changes made offline are queued and synced when connectivity is restored.
**Destructive operations (deleting lists, deleting tasks) must not proceed while offline.**
The app must detect connectivity and show an error message if a destructive operation
cannot be synced. This prevents ghost deletions that revert on next sync.
Conflict resolution uses a last-write-wins strategy at the individual field level
(title, due date, priority, notes, completion status are each independent fields).
Timestamps for conflict resolution use server time.

## Data Model

Each task belongs to exactly one list at a time (tasks can be moved between lists).
@see(lists@default-lists)
