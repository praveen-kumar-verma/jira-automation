migrate(function (app) {
  var collection = app.findCollectionByNameOrId("tasks");

  collection.fields.removeByName("status");
  collection.fields.removeByName("priority");
  collection.fields.removeByName("task_type");

  collection.fields.add(
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
    })
  );

  app.save(collection);
}, function (app) {
  var collection = app.findCollectionByNameOrId("tasks");

  collection.fields.removeByName("priority");
  collection.fields.removeByName("task_type");
  collection.fields.add(
    new TextField({
      name: "status",
      required: true,
      max: 30
    })
  );

  app.save(collection);
});
