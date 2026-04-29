# PocketBase Hooks + Jira Automation

This project uses PocketBase server-side hooks as the main automation mechanism. There is no Express trigger in the workflow.

When a `tasks` record is created, PocketBase creates one Jira issue. When `priority` changes in PocketBase, PocketBase updates that same Jira issue.

## What Is Included

- `pb_hooks/jira.pb.js`
  - `onRecordAfterCreateSuccess`: creates a Jira issue after a `tasks` record is persisted.
  - `onRecordAfterUpdateSuccess`: syncs priority changes to the same Jira issue.
- `pb_migrations/1714350000_create_tasks_collection.pb.js`
  - Creates the `tasks` collection for fresh installs.
- `pb_migrations/1714351000_update_tasks_dropdowns_and_remove_followups.pb.js`
  - Converts `priority` and `task_type` to dropdown fields.
  - Removes old `link_type` and `jira_followup_key` fields.
- `scripts/start-pocketbase.ps1`
  - Loads `.env` into process environment variables and starts PocketBase locally.

PocketBase JS hooks run inside PocketBase's embedded JavaScript runtime, so the hook uses PocketBase's `$http.send`.

## Environment Variables

PocketBase does not automatically load `.env` files for hooks. Start PocketBase with the provided script.

```env
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=you@example.com
JIRA_API_TOKEN=your_jira_api_token
JIRA_PROJECT_KEY=PROJ
```

## Run

```powershell

powershell -ExecutionPolicy Bypass -File .\scripts\start-pocketbase.ps1
```

Dashboard:

```text
http://127.0.0.1:8090/_/
```

## Collection: tasks

Fields:

- `title`: mapped to Jira summary
- `description`: mapped to Jira description
- `priority`: dropdown: `highest`, `high`, `medium`, `low`, `lowest`
- `task_type`: dropdown: `Task`, `Bug`, `Story`
- `jira_issue_key`: hidden internal Jira issue key used by the hook
- `jira_url`: hidden Jira browse URL populated by the hook after Jira creates the issue
- `jira_last_error`: hidden last Jira sync error, if any

Removed fields:

- `link_type`
- `jira_followup_key`
- visible `jira_key`
- `status`
- `issue_type`

## Behavior

### Create

Creating a PocketBase task:

1. Creates a Jira issue.
2. Sets Jira priority from `priority`.
3. Sets Jira issue type from `task_type`.
4. Stores hidden `jira_issue_key` and hidden `jira_url`.

### Update

Updating an existing PocketBase task:

1. If `priority` changed, the hook updates priority on the same Jira issue.
2. No follow-up Jira issue is created.
3. No issue linking is performed.

## Manual Test

### Check Env

```powershell
Invoke-RestMethod http://127.0.0.1:8090/jira-debug/env
```

All values should be `set`.

### Create Test Jira Issue

```powershell
Invoke-RestMethod `
  -Uri http://127.0.0.1:8090/jira-debug/create-test-issue `
  -Method POST
```

### Create PocketBase Task

```powershell
Invoke-RestMethod `
  -Uri http://127.0.0.1:8090/api/collections/tasks/records `
  -Method POST `
  -ContentType "application/json" `
  -Body '{
    "title": "Create Jira from PocketBase",
    "description": "Manual PocketBase hook test",
    "priority": "medium",
    "task_type": "Task"
  }'
```

Expected:

- PocketBase record is created.
- Jira issue is created.
- hidden `jira_issue_key` and hidden `jira_url` are populated.
- `jira_last_error` is empty.

### Update Priority On Same Jira Issue

```powershell
Invoke-RestMethod `
  -Uri http://127.0.0.1:8090/api/collections/tasks/records/RECORD_ID `
  -Method PATCH `
  -ContentType "application/json" `
  -Body '{
    "priority": "highest"
  }'
```

Expected:

- No new Jira issue is created.
- The Jira issue priority changes to `Highest`.

## Jira Workflow Note

Jira issue status is controlled by the Jira workflow and board columns. This PocketBase form does not set status during task creation.

## Error Handling

Jira failures do not block PocketBase record creation. Errors are logged to the PocketBase console and written to `jira_last_error`.

Common causes:

- `401`: invalid email/API token
- `403`: Jira user lacks project permission
- `400`: required Jira field missing, invalid task type, or invalid priority

## Notes

- This uses PocketBase hooks, not Express routes.
- This does not use cron jobs.
- This does not use OpenPBS scheduler hooks.
- This does not require a Node.js server.
