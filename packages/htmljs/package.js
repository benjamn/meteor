Package.describe({
  summary: "Small library for expressing HTML trees",
  version: '1.0.4'
});

Npm.depends({
  "bluebird": "2.9.14"
});

Package.onUse(function (api) {
  api.use('deps');
  api.use('underscore');
  api.export('HTML');

  api.addFiles(['preamble.js',
                 'visitors.js',
                 'html.js']);
});

Package.onTest(function (api) {
  api.use('htmljs');
  api.use('html-tools');
  api.use('tinytest');
  api.use('underscore');
  api.addFiles(['htmljs_test.js']);
});
