var jiraService = require(__hooks + "/jiraService.js");

var TASK_COLLECTION = "tasks";
var BATCH_SIZE = 25;
var PROCESSING_MARKER = "PROCESSING";

function cronExpr() {
  return ($os.getenv("JIRA_CRON_EXPR") || "*/2 * * * *").trim();
}

function saveRecord(record) {
  $app.saveNoValidate(record);
}

function getTaskValue(record, name) {
  try {
    return record.getString(name);
  } catch (_) {
    return "";
  }
}

function incrementRetryCount(record) {
  var current = 0;

  try {
    current = Number(record.get("retryCount") || 0);
  } catch (_) {
    current = 0;
  }

  record.set("retryCount", current + 1);
}

function markTaskFailed(record, error) {
  record.set("jiraLastError", String(error.message || error));
  incrementRetryCount(record);
  saveRecord(record);
}

function syncTaskToJira(record) {
  var current = $app.findRecordById(TASK_COLLECTION, record.id);
  var jiraIssueId = getTaskValue(current, "jiraIssueId");
  var jiraLastError = getTaskValue(current, "jiraLastError");

  if (jiraIssueId || jiraLastError === PROCESSING_MARKER) {
    console.log("Skipping task " + current.id + " because it is already locked or synced");
    return "skipped";
  }

  current.set("jiraLastError", PROCESSING_MARKER);
  saveRecord(current);

  try {
    var issue = jiraService.createIssue({
      title: getTaskValue(current, "title"),
      description: getTaskValue(current, "description"),
      priority: getTaskValue(current, "priority") || "medium",
      taskType: getTaskValue(current, "task_type") || "Task"
    });

    current.set("jiraIssueId", issue.key);
    current.set("jiraUrl", issue.browseUrl);
    current.set("jiraLastError", "");
    saveRecord(current);

    console.log("Synced PocketBase task " + current.id + " to Jira issue " + issue.key);
    return "processed";
  } catch (error) {
    console.log("Failed to sync PocketBase task " + current.id + " to Jira: " + error);
    markTaskFailed(current, error);
    return "failed";
  }
}

function runPendingTaskSync() {
  var startedAt = new Date().toISOString();
  var processed = 0;
  var skipped = 0;
  var failed = 0;

  console.log("Jira cron started at " + startedAt);

  var tasks = $app.findRecordsByFilter(
    TASK_COLLECTION,
    "jiraIssueId = '' && jiraLastError != '" + PROCESSING_MARKER + "' && retryCount < 3",
    "createdAt",
    BATCH_SIZE,
    0
  );

  for (var i = 0; i < tasks.length; i++) {
    var result = syncTaskToJira(tasks[i]);

    if (result === "processed") {
      processed++;
    } else if (result === "failed") {
      failed++;
    } else {
      skipped++;
    }
  }

  console.log(
    "Jira cron finished. found=" +
      tasks.length +
      " processed=" +
      processed +
      " failed=" +
      failed +
      " skipped=" +
      skipped
  );
}

function retryFailedTasks() {
  var tasks = $app.findRecordsByFilter(
    TASK_COLLECTION,
    "jiraIssueId = '' && jiraLastError != '' && jiraLastError != '" + PROCESSING_MARKER + "' && retryCount < 3",
    "createdAt",
    BATCH_SIZE,
    0
  );

  for (var i = 0; i < tasks.length; i++) {
    tasks[i].set("jiraLastError", "");
    saveRecord(tasks[i]);
  }

  if (tasks.length > 0) {
    console.log("Moved " + tasks.length + " failed Jira tasks back to pending for retry");
  }
}

function register() {
  routerAdd("GET", "/jira-cron/status", function (e) {
    return e.json(200, {
      ok: true,
      cron: "jira-sync-pending-tasks",
      schedule: ($os.getenv("JIRA_CRON_EXPR") || "*/2 * * * *").trim(),
      batchSize: 25
    });
  });

  routerAdd("POST", "/jira-cron/run-once", function (e) {
    try {
      var cron = require(__hooks + "/cron.js");
      cron.retryFailedTasks();
      cron.runPendingTaskSync();
      return e.json(200, { ok: true });
    } catch (error) {
      return e.json(500, {
        ok: false,
        error: String(error.message || error)
      });
    }
  });

  cronAdd("jira-sync-pending-tasks", cronExpr(), function () {
    var cron = require(__hooks + "/cron.js");
    cron.retryFailedTasks();
    cron.runPendingTaskSync();
  });

  console.log("Registered Jira pending task cron with schedule " + cronExpr());
}

module.exports = {
  register: register,
  retryFailedTasks: retryFailedTasks,
  runPendingTaskSync: runPendingTaskSync,
  syncTaskToJira: syncTaskToJira
};
