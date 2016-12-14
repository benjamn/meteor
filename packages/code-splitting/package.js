Package.describe({
  name: "code-splitting",
  version: "0.0.1",
  summary: "",
  // By default, Meteor will default to using README.md for documentation.
  // To avoid submitting documentation, set this field to null.
  documentation: "README.md"
});

Package.onUse(function(api) {
  api.use("ddp");
  api.use("modules");
  api.use("promise");
  api.use("ecmascript", "server");
  api.mainModule("client.js", "client");
  api.mainModule("server.js", "server");
});
