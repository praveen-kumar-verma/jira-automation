/// <reference path="../pb_data/types.d.ts" />

console.log("Loaded PocketBase Jira automation hook from pb_hooks/jira.pb.js");

routerAdd("GET", "/jira-debug/hook-loaded", function (e) {
  return e.json(200, {
    ok: true,
    hook: "pb_hooks/jira.pb.js",
    collection: "tasks"
  });
});

routerAdd("GET", "/jira-debug/env", function (e) {
  function getenv(name) {
    return ($os.getenv(name) || "").trim();
  }

  return e.json(200, {
    ok: true,
    env: {
      JIRA_BASE_URL: getenv("JIRA_BASE_URL") ? "set" : "missing",
      JIRA_EMAIL: getenv("JIRA_EMAIL") ? "set" : "missing",
      JIRA_API_TOKEN: getenv("JIRA_API_TOKEN") ? "set" : "missing",
      JIRA_PROJECT_KEY: getenv("JIRA_PROJECT_KEY") ? "set" : "missing"
    }
  });
});

routerAdd("POST", "/jira-debug/create-test-issue", function (e) {
  try {
    function getenv(name) {
      return ($os.getenv(name) || "").trim();
    }

    function b64(input) {
      var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      var output = "";
      var i = 0;
      while (i < input.length) {
        var c1 = input.charCodeAt(i++) & 255;
        var c2 = i < input.length ? input.charCodeAt(i++) & 255 : NaN;
        var c3 = i < input.length ? input.charCodeAt(i++) & 255 : NaN;
        output += chars.charAt(c1 >> 2);
        output += chars.charAt(((c1 & 3) << 4) | ((c2 || 0) >> 4));
        output += isNaN(c2) ? "=" : chars.charAt(((c2 & 15) << 2) | ((c3 || 0) >> 6));
        output += isNaN(c3) ? "=" : chars.charAt(c3 & 63);
      }
      return output;
    }

    function adf(text) {
      return {
        type: "doc",
        version: 1,
        content: [{ type: "paragraph", content: [{ type: "text", text: String(text || "") }] }]
      };
    }

    var jiraBaseUrl = getenv("JIRA_BASE_URL").replace(/\/$/, "");
    var res = $http.send({
      method: "POST",
      url: jiraBaseUrl + "/rest/api/3/issue",
      body: JSON.stringify({
        fields: {
          project: { key: getenv("JIRA_PROJECT_KEY") },
          summary: "PocketBase Jira debug issue",
          description: adf("Created from PocketBase native debug route."),
          issuetype: { name: "Task" },
          priority: { name: "Medium" },
          labels: ["pocketbase", "automation"]
        }
      }),
      timeout: 20,
      headers: {
        Authorization: "Basic " + b64(getenv("JIRA_EMAIL") + ":" + getenv("JIRA_API_TOKEN")),
        Accept: "application/json",
        "Content-Type": "application/json"
      }
    });

    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw new Error("Jira create issue failed: HTTP " + res.statusCode + " " + res.raw);
    }

    return e.json(201, {
      ok: true,
      issue: {
        key: res.json.key,
        browseUrl: jiraBaseUrl + "/browse/" + res.json.key
      }
    });
  } catch (err) {
    return e.json(500, {
      ok: false,
      error: String(err.message || err)
    });
  }
});

onRecordAfterCreateSuccess(function (e) {
  e.next();

  try {
    function getenv(name) {
      return ($os.getenv(name) || "").trim();
    }

    function b64(input) {
      var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      var output = "";
      var i = 0;
      while (i < input.length) {
        var c1 = input.charCodeAt(i++) & 255;
        var c2 = i < input.length ? input.charCodeAt(i++) & 255 : NaN;
        var c3 = i < input.length ? input.charCodeAt(i++) & 255 : NaN;
        output += chars.charAt(c1 >> 2);
        output += chars.charAt(((c1 & 3) << 4) | ((c2 || 0) >> 4));
        output += isNaN(c2) ? "=" : chars.charAt(((c2 & 15) << 2) | ((c3 || 0) >> 6));
        output += isNaN(c3) ? "=" : chars.charAt(c3 & 63);
      }
      return output;
    }

    function authHeaders() {
      return {
        Authorization: "Basic " + b64(getenv("JIRA_EMAIL") + ":" + getenv("JIRA_API_TOKEN")),
        Accept: "application/json",
        "Content-Type": "application/json"
      };
    }

    function adf(text) {
      return {
        type: "doc",
        version: 1,
        content: [{ type: "paragraph", content: [{ type: "text", text: String(text || "") }] }]
      };
    }

    function requiredEnv() {
      var keys = ["JIRA_BASE_URL", "JIRA_EMAIL", "JIRA_API_TOKEN", "JIRA_PROJECT_KEY"];
      var missing = [];
      for (var i = 0; i < keys.length; i++) {
        if (!getenv(keys[i])) {
          missing.push(keys[i]);
        }
      }
      if (missing.length > 0) {
        throw new Error("Missing Jira environment variables: " + missing.join(", "));
      }
    }

    function jiraPriority(value) {
      var map = {
        highest: "Highest",
        high: "High",
        medium: "Medium",
        low: "Low",
        lowest: "Lowest"
      };
      return map[String(value || "medium").toLowerCase()] || "Medium";
    }

    function safeGetString(record, name) {
      try {
        return record.getString(name);
      } catch (_) {
        return "";
      }
    }

    function saveRecordNoHooks(record) {
      $app.unsafeWithoutHooks().saveNoValidate(record);
    }

    console.log("PocketBase Jira create hook fired for task " + e.record.id);

    if (e.record.getString("jira_issue_key")) {
      return;
    }

    requiredEnv();

    var jiraBaseUrl = getenv("JIRA_BASE_URL").replace(/\/$/, "");
    var priority = e.record.getString("priority") || "medium";
    var taskType = safeGetString(e.record, "task_type") || safeGetString(e.record, "issue_type") || "Task";
    var description = [
      e.record.getString("description"),
      "",
      "Created from PocketBase task record.",
      "PocketBase record id: " + e.record.id,
      "Priority: " + jiraPriority(priority),
      "Task type: " + taskType
    ].join("\n").trim();

    var createRes = $http.send({
      method: "POST",
      url: jiraBaseUrl + "/rest/api/3/issue",
      body: JSON.stringify({
        fields: {
          project: { key: getenv("JIRA_PROJECT_KEY") },
          summary: e.record.getString("title") || "PocketBase task " + e.record.id,
          description: adf(description),
          issuetype: { name: taskType },
          priority: { name: jiraPriority(priority) },
          labels: ["pocketbase", "automation"]
        }
      }),
      timeout: 20,
      headers: authHeaders()
    });

    if (createRes.statusCode < 200 || createRes.statusCode >= 300) {
      throw new Error("Jira create issue failed: HTTP " + createRes.statusCode + " " + createRes.raw);
    }

    var issueKey = createRes.json.key;
    e.record.set("jira_issue_key", issueKey);
    e.record.set("jira_url", jiraBaseUrl + "/browse/" + issueKey);
    e.record.set("jira_last_error", "");
    saveRecordNoHooks(e.record);

    console.log("Created Jira issue " + issueKey + " for PocketBase task " + e.record.id);
  } catch (err) {
    console.log("Failed to create Jira issue for PocketBase task " + e.record.id + ": " + err);

    try {
      e.record.set("jira_last_error", String(err.message || err));
      $app.unsafeWithoutHooks().saveNoValidate(e.record);
    } catch (saveErr) {
      console.log("Failed to persist Jira create error for task " + e.record.id + ": " + saveErr);
    }
  }
}, "tasks");

onRecordAfterUpdateSuccess(function (e) {
  e.next();

  var original = null;
  if (typeof e.record.original === "function") {
    original = e.record.original();
  } else if (typeof e.record.originalCopy === "function") {
    original = e.record.originalCopy();
  }

  if (!original) {
    return;
  }

  var oldPriority = original.getString("priority");
  var newPriority = e.record.getString("priority");

  if (oldPriority === newPriority) {
    return;
  }

  try {
    function getenv(name) {
      return ($os.getenv(name) || "").trim();
    }

    function b64(input) {
      var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      var output = "";
      var i = 0;
      while (i < input.length) {
        var c1 = input.charCodeAt(i++) & 255;
        var c2 = i < input.length ? input.charCodeAt(i++) & 255 : NaN;
        var c3 = i < input.length ? input.charCodeAt(i++) & 255 : NaN;
        output += chars.charAt(c1 >> 2);
        output += chars.charAt(((c1 & 3) << 4) | ((c2 || 0) >> 4));
        output += isNaN(c2) ? "=" : chars.charAt(((c2 & 15) << 2) | ((c3 || 0) >> 6));
        output += isNaN(c3) ? "=" : chars.charAt(c3 & 63);
      }
      return output;
    }

    function authHeaders() {
      return {
        Authorization: "Basic " + b64(getenv("JIRA_EMAIL") + ":" + getenv("JIRA_API_TOKEN")),
        Accept: "application/json",
        "Content-Type": "application/json"
      };
    }

    function jiraPriority(value) {
      var map = {
        highest: "Highest",
        high: "High",
        medium: "Medium",
        low: "Low",
        lowest: "Lowest"
      };
      return map[String(value || "medium").toLowerCase()] || "Medium";
    }

    function updatePriority(jiraBaseUrl, issueKey, priority) {
      if (!priority || oldPriority === priority) {
        return;
      }

      var res = $http.send({
        method: "PUT",
        url: jiraBaseUrl + "/rest/api/3/issue/" + issueKey,
        body: JSON.stringify({
          fields: {
            priority: { name: jiraPriority(priority) }
          }
        }),
        timeout: 20,
        headers: authHeaders()
      });

      if (res.statusCode < 200 || res.statusCode >= 300) {
        throw new Error("Jira priority update failed: HTTP " + res.statusCode + " " + res.raw);
      }
    }

    var issueKey = e.record.getString("jira_issue_key");
    if (!issueKey) {
      return;
    }

    var jiraBaseUrl = getenv("JIRA_BASE_URL").replace(/\/$/, "");
    updatePriority(jiraBaseUrl, issueKey, newPriority);

    e.record.set("jira_last_error", "");
    $app.unsafeWithoutHooks().saveNoValidate(e.record);
    console.log("Synced Jira issue " + issueKey + " from PocketBase task " + e.record.id);
  } catch (err) {
    console.log("Failed to sync Jira issue for PocketBase task " + e.record.id + ": " + err);

    try {
      e.record.set("jira_last_error", String(err.message || err));
      $app.unsafeWithoutHooks().saveNoValidate(e.record);
    } catch (saveErr) {
      console.log("Failed to persist Jira sync error for task " + e.record.id + ": " + saveErr);
    }
  }
}, "tasks");
