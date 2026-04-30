# PocketBase + Jira Cron Task Sync

Local development project that uses PocketBase as the backend, database, hook runtime, static UI server, and cron worker. The browser UI only inserts tasks into PocketBase. Jira is called only from the PocketBase cron job.

## Flow

```text
User adds tasks in UI
  -> PocketBase stores records in tasks collection
  -> PocketBase cron runs on the configured schedule
  -> Cron finds unsynced tasks where jiraIssueId is empty
  -> Cron creates Jira issues
  -> Cron stores jiraIssueId and jiraUrl
```

## Project Structure

```text
pb_hooks/
  cron.pb.js        PocketBase-loaded hook entrypoint
  cron.js           Cron registration and task processing logic
  jiraService.js    Jira REST API helper
pb_migrations/
  202604300001_create_tasks_collection.pb.js
  202605010001_update_tasks_priority_type_remove_status.pb.js
frontend/
  index.html        Single + bulk task UI
scripts/
  start-pocketbase.ps1
.env.example
README.md
```

## Environment

Create `.env` in the project root:

```env
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=you@example.com
JIRA_API_TOKEN=your_jira_api_token
JIRA_PROJECT_KEY=PROJ
JIRA_CRON_EXPR=*/2 * * * *
```

`JIRA_CRON_EXPR` is optional. If it is missing, the cron runs every 2 minutes.

Common cron options:

```text
*/1 * * * *  every 1 minute
*/2 * * * *  every 2 minutes
*/5 * * * *  every 5 minutes
```

PocketBase hooks do not automatically load `.env`, so start PocketBase with the provided script.

## Run

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-pocketbase.ps1
```

Open the UI:

```text
http://127.0.0.1:8090
```

PocketBase dashboard:

```text
http://127.0.0.1:8090/_/
```

## Collection: tasks

The migration creates `tasks` with these fields:

- `title`: text, required
- `description`: text, optional
- `priority`: dropdown/select, required: `highest`, `high`, `medium`, `low`, `lowest`
- `task_type`: dropdown/select, required: `Task`, `Bug`, `Story`
- `jiraIssueId`: text, optional
- `jiraUrl`: URL, optional
- `jiraLastError`: text, optional
- `retryCount`: number, optional
- `createdAt`: auto date on create

There is no `status` field. The UI derives sync state from Jira fields:

- Pending: `jiraIssueId` is empty and `jiraLastError` is empty
- Processing: `jiraLastError` is `PROCESSING`
- Failed: `jiraIssueId` is empty and `jiraLastError` has an error
- Processed: `jiraIssueId` is filled

## Cron

Registered job:

```text
jira-sync-pending-tasks
```

Default schedule:

```text
*/2 * * * *
```

Cron query:

```text
jiraIssueId = '' && jiraLastError != 'PROCESSING' && retryCount < 3
```

Batch size:

```text
25
```

## Idempotency

The cron uses these guards to prevent duplicate Jira issues:

1. It only fetches tasks with empty `jiraIssueId`.
2. Before processing each task, it re-reads the task from PocketBase.
3. It skips the task if `jiraIssueId` exists.
4. It writes `jiraLastError = PROCESSING` before calling Jira.
5. It saves the returned Jira issue key to `jiraIssueId`.

The UI never calls Jira.

## Manual Cron Test

Check cron registration:

```powershell
Invoke-RestMethod http://127.0.0.1:8090/jira-cron/status
```

Run cron once manually:

```powershell
Invoke-RestMethod `
  -Uri http://127.0.0.1:8090/jira-cron/run-once `
  -Method POST
```

## Add One Task By API

```powershell
Invoke-RestMethod `
  -Uri http://127.0.0.1:8090/api/collections/tasks/records `
  -Method POST `
  -ContentType "application/json" `
  -Body '{
    "title": "Create Jira issue from cron",
    "description": "This task should be picked by PocketBase cron.",
    "priority": "medium",
    "task_type": "Task",
    "jiraIssueId": "",
    "retryCount": 0
  }'
```

## Jira Payload

Cron sends:

```json
{
  "fields": {
    "project": { "key": "PROJ" },
    "summary": "task.title",
    "description": {
      "type": "doc",
      "version": 1,
      "content": [
        {
          "type": "paragraph",
          "content": [{ "type": "text", "text": "task.description" }]
        }
      ]
    },
    "issuetype": { "name": "task.task_type" },
    "priority": { "name": "Medium" },
    "labels": ["pocketbase", "cron-sync"]
  }
}
```

## Notes

- Do not use Express as the backend.
- PocketBase is the backend and cron worker.
- UI inserts records only.
- Jira sync happens only inside PocketBase hooks.
- Failed tasks are retried up to 3 times.
- Cron schedule changes require restarting PocketBase because cron jobs are registered at startup.
