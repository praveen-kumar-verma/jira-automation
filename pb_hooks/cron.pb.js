/// <reference path="../pb_data/types.d.ts" />

console.log("Loading PocketBase Jira cron hooks");

var cron = require(__hooks + "/cron.js");

cron.register();
