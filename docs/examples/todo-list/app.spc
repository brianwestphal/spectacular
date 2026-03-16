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

Tasks sync across all of the user's devices in real time.
Changes made offline are queued and synced when connectivity is restored.
Conflict resolution uses a last-write-wins strategy at the field level.

## Data Model

Each task belongs to exactly one list.
Each user has at least one list (the default "Inbox" list, which cannot be deleted).
