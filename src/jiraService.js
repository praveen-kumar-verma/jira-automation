const axios = require('axios');
const logger = require('./logger');

const requiredEnv = ['JIRA_BASE_URL', 'JIRA_EMAIL', 'JIRA_API_TOKEN', 'JIRA_PROJECT_KEY'];

function validateJiraConfig() {
  const missing = requiredEnv.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required Jira environment variables: ${missing.join(', ')}`);
  }
}

function createJiraClient() {
  validateJiraConfig();

  return axios.create({
    baseURL: `${process.env.JIRA_BASE_URL.replace(/\/$/, '')}/rest/api/3`,
    auth: {
      username: process.env.JIRA_EMAIL,
      password: process.env.JIRA_API_TOKEN
    },
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    timeout: 15000
  });
}

function toAdfDescription(description) {
  if (!description) {
    return undefined;
  }

  if (typeof description === 'object') {
    return description;
  }

  return {
    type: 'doc',
    version: 1,
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: String(description)
          }
        ]
      }
    ]
  };
}

function normalizeJiraError(error) {
  if (error.response) {
    return {
      status: error.response.status,
      statusText: error.response.statusText,
      data: error.response.data
    };
  }

  return {
    message: error.message
  };
}

function normalizeLabels(labels) {
  return Array.isArray(labels) ? labels : [];
}

function normalizeLinkType(linkType = 'Relates') {
  const normalized = String(linkType).trim().toLowerCase();
  const aliases = {
    blocks: 'Blocks',
    relates: 'Relates',
    'relates to': 'Relates',
    duplicates: 'Duplicate',
    duplicate: 'Duplicate',
    clones: 'Cloners',
    cloners: 'Cloners'
  };

  return aliases[normalized] || linkType;
}

function issueSelfUrl(issueKey) {
  return `${process.env.JIRA_BASE_URL.replace(/\/$/, '')}/browse/${issueKey}`;
}

async function createIssue({
  projectKey = process.env.JIRA_PROJECT_KEY,
  summary,
  description,
  issueType = 'Task',
  parentKey,
  labels = [],
  additionalFields = {}
}) {
  if (!summary) {
    throw new Error('summary is required');
  }

  const client = createJiraClient();
  const fields = {
    project: {
      key: projectKey
    },
    summary,
    issuetype: {
      name: issueType
    },
    ...additionalFields
  };

  const adfDescription = toAdfDescription(description);
  if (adfDescription) {
    fields.description = adfDescription;
  }

  const safeLabels = normalizeLabels(labels);

  if (safeLabels.length > 0) {
    fields.labels = safeLabels;
  }

  if (parentKey) {
    fields.parent = {
      key: parentKey
    };
  }

  try {
    const response = await client.post('/issue', { fields });
    const issue = {
      id: response.data.id,
      key: response.data.key,
      self: response.data.self,
      browseUrl: issueSelfUrl(response.data.key)
    };

    logger.info('Created Jira issue', { issueKey: issue.key, issueType, parentKey });
    return issue;
  } catch (error) {
    const jiraError = normalizeJiraError(error);
    logger.error('Failed to create Jira issue', { jiraError });
    const wrapped = new Error('Jira issue creation failed');
    wrapped.details = jiraError;
    throw wrapped;
  }
}

async function linkIssues({
  inwardIssueKey,
  outwardIssueKey,
  linkType = 'Relates'
}) {
  if (!inwardIssueKey || !outwardIssueKey) {
    throw new Error('inwardIssueKey and outwardIssueKey are required');
  }

  const client = createJiraClient();
  const jiraLinkType = normalizeLinkType(linkType);
  const payload = {
    type: {
      name: jiraLinkType
    },
    inwardIssue: {
      key: inwardIssueKey
    },
    outwardIssue: {
      key: outwardIssueKey
    }
  };

  try {
    await client.post('/issueLink', payload);
    logger.info('Linked Jira issues', { inwardIssueKey, outwardIssueKey, linkType: jiraLinkType });
    return {
      inwardIssueKey,
      outwardIssueKey,
      linkType: jiraLinkType
    };
  } catch (error) {
    const jiraError = normalizeJiraError(error);
    logger.error('Failed to link Jira issues', { jiraError, inwardIssueKey, outwardIssueKey });
    const wrapped = new Error('Jira issue linking failed');
    wrapped.details = jiraError;
    throw wrapped;
  }
}

async function createLinkedIssue({
  sourceIssueKey,
  summary,
  description,
  issueType = 'Task',
  linkType = 'Relates',
  createAsSubtask = false,
  labels = [],
  additionalFields = {}
}) {
  if (!sourceIssueKey) {
    throw new Error('sourceIssueKey is required');
  }

  const issue = await createIssue({
    summary,
    description,
    issueType: createAsSubtask ? 'Sub-task' : issueType,
    parentKey: createAsSubtask ? sourceIssueKey : undefined,
    labels,
    additionalFields
  });

  if (createAsSubtask) {
    return {
      issue,
      relationship: {
        type: 'parent/subtask',
        parentIssueKey: sourceIssueKey,
        childIssueKey: issue.key
      }
    };
  }

  const link = await linkIssues({
    inwardIssueKey: sourceIssueKey,
    outwardIssueKey: issue.key,
    linkType
  });

  return {
    issue,
    relationship: link
  };
}

async function simulateTransitionPostFunction({
  sourceIssueKey,
  fromStatus,
  toStatus,
  transitionName,
  followUpIssueType = 'Task',
  followUpSummary,
  followUpDescription,
  linkType = 'Relates',
  labels = ['automation', 'post-function-simulation']
}) {
  if (!sourceIssueKey) {
    throw new Error('sourceIssueKey is required');
  }

  const statusText = toStatus ? ` moved to ${toStatus}` : ' transitioned';
  const summary = followUpSummary || `Follow-up for ${sourceIssueKey}${statusText}`;
  const description =
    followUpDescription ||
    [
      `Simulated workflow post-function hook for ${sourceIssueKey}.`,
      fromStatus ? `From status: ${fromStatus}` : null,
      toStatus ? `To status: ${toStatus}` : null,
      transitionName ? `Transition: ${transitionName}` : null,
      'This local endpoint represents logic that would run after a Jira workflow transition.'
    ]
      .filter(Boolean)
      .join('\n');

  logger.info('Simulating transition post-function hook', {
    sourceIssueKey,
    fromStatus,
    toStatus,
    transitionName
  });

  return createLinkedIssue({
    sourceIssueKey,
    summary,
    description,
    issueType: followUpIssueType,
    linkType,
    labels
  });
}

module.exports = {
  createIssue,
  createLinkedIssue,
  linkIssues,
  simulateTransitionPostFunction
};
