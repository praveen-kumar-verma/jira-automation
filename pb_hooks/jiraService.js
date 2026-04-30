var REQUIRED_ENV = ["JIRA_BASE_URL", "JIRA_EMAIL", "JIRA_API_TOKEN", "JIRA_PROJECT_KEY"];

function getenv(name) {
  return ($os.getenv(name) || "").trim();
}

function jiraBaseUrl() {
  return getenv("JIRA_BASE_URL").replace(/\/$/, "");
}

function validateConfig() {
  var missing = [];

  for (var i = 0; i < REQUIRED_ENV.length; i++) {
    if (!getenv(REQUIRED_ENV[i])) {
      missing.push(REQUIRED_ENV[i]);
    }
  }

  if (missing.length > 0) {
    throw new Error("Missing Jira environment variables: " + missing.join(", "));
  }
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

function toAdf(text) {
  return {
    type: "doc",
    version: 1,
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: String(text || "")
          }
        ]
      }
    ]
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

function normalizeJiraError(response) {
  return "HTTP " + response.statusCode + " " + response.raw;
}

function createIssue(task) {
  validateConfig();

  if (!task.title) {
    throw new Error("Task title is required before creating a Jira issue");
  }

  var baseUrl = jiraBaseUrl();
  var response = $http.send({
    method: "POST",
    url: baseUrl + "/rest/api/3/issue",
    timeout: 20,
    headers: authHeaders(),
    body: JSON.stringify({
      fields: {
        project: {
          key: getenv("JIRA_PROJECT_KEY")
        },
        summary: task.title,
        description: toAdf(task.description),
        issuetype: {
          name: task.taskType || "Task"
        },
        priority: {
          name: jiraPriority(task.priority)
        },
        labels: ["pocketbase", "cron-sync"]
      }
    })
  });

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error("Jira issue creation failed: " + normalizeJiraError(response));
  }

  return {
    id: response.json.id,
    key: response.json.key,
    self: response.json.self,
    browseUrl: baseUrl + "/browse/" + response.json.key
  };
}

function envStatus() {
  return {
    JIRA_BASE_URL: getenv("JIRA_BASE_URL") ? "set" : "missing",
    JIRA_EMAIL: getenv("JIRA_EMAIL") ? "set" : "missing",
    JIRA_API_TOKEN: getenv("JIRA_API_TOKEN") ? "set" : "missing",
    JIRA_PROJECT_KEY: getenv("JIRA_PROJECT_KEY") ? "set" : "missing"
  };
}

module.exports = {
  createIssue: createIssue,
  envStatus: envStatus,
  jiraPriority: jiraPriority,
  validateConfig: validateConfig
};
