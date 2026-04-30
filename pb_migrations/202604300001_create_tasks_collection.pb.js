migrate(function (app) {
  var collection;

  try {
    collection = app.findCollectionByNameOrId("tasks");
  } catch (_) {
    collection = new Collection({
      type: "base",
      name: "tasks"
    });
  }

  collection.listRule = "";
  collection.viewRule = "";
  collection.createRule = "";
  collection.updateRule = null;
  collection.deleteRule = null;

  collection.fields.removeByName("priority");
  collection.fields.removeByName("task_type");
  collection.fields.removeByName("status");
  collection.fields.removeByName("jira_issue_key");
  collection.fields.removeByName("jira_url");
  collection.fields.removeByName("jira_last_error");

  collection.fields.add(
    new TextField({
      name: "title",
      required: true,
      max: 255
    }),
    new TextField({
      name: "description",
      required: false,
      max: 5000
    }),
    new SelectField({
      name: "priority",
      required: true,
      values: ["highest", "high", "medium", "low", "lowest"],
      maxSelect: 1
    }),
    new SelectField({
      name: "task_type",
      required: true,
      values: ["Task", "Bug", "Story"],
      maxSelect: 1
    }),
    new TextField({
      name: "jiraIssueId",
      required: false,
      max: 80
    }),
    new URLField({
      name: "jiraUrl",
      required: false
    }),
    new TextField({
      name: "jiraLastError",
      required: false,
      max: 3000
    }),
    new NumberField({
      name: "retryCount",
      required: false,
      min: 0,
      max: 3,
      onlyInt: true
    }),
    new AutodateField({
      name: "createdAt",
      onCreate: true,
      onUpdate: false
    })
  );

  app.save(collection);
}, function (app) {
  try {
    var collection = app.findCollectionByNameOrId("tasks");
    app.delete(collection);
  } catch (_) {
    // Collection is already absent.
  }
});
