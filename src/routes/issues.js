const express = require('express');
const jiraService = require('../jiraService');

const router = express.Router();

function sendError(res, error) {
  const statusCode = error.details && error.details.status ? 502 : 400;

  res.status(statusCode).json({
    success: false,
    error: error.message,
    details: error.details
  });
}

router.post('/create-issue', async (req, res) => {
  try {
    const issue = await jiraService.createIssue({
      projectKey: req.body.projectKey,
      summary: req.body.summary,
      description: req.body.description,
      issueType: req.body.issueType,
      labels: req.body.labels,
      additionalFields: req.body.additionalFields
    });

    res.status(201).json({
      success: true,
      issue
    });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/create-linked-issue', async (req, res) => {
  try {
    const result = await jiraService.createLinkedIssue({
      sourceIssueKey: req.body.sourceIssueKey,
      summary: req.body.summary,
      description: req.body.description,
      issueType: req.body.issueType,
      linkType: req.body.linkType,
      createAsSubtask: req.body.createAsSubtask,
      labels: req.body.labels,
      additionalFields: req.body.additionalFields
    });

    res.status(201).json({
      success: true,
      ...result
    });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/simulate-transition-hook', async (req, res) => {
  try {
    const result = await jiraService.simulateTransitionPostFunction({
      sourceIssueKey: req.body.sourceIssueKey,
      fromStatus: req.body.fromStatus,
      toStatus: req.body.toStatus,
      transitionName: req.body.transitionName,
      followUpIssueType: req.body.followUpIssueType,
      followUpSummary: req.body.followUpSummary,
      followUpDescription: req.body.followUpDescription,
      linkType: req.body.linkType,
      labels: req.body.labels
    });

    res.status(201).json({
      success: true,
      simulatedHook: {
        trigger: 'issue-transitioned',
        timing: 'after-transition',
        sourceIssueKey: req.body.sourceIssueKey,
        fromStatus: req.body.fromStatus,
        toStatus: req.body.toStatus
      },
      ...result
    });
  } catch (error) {
    sendError(res, error);
  }
});

module.exports = router;
