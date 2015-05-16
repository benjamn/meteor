Package.describe({
  summary: "Parser/transpiler for ECMAScript 6+ syntax",
  // Tracks the npm version below.  Use wrap numbers to increment
  // without incrementing the npm version.
  version: '5.4.3'
});

Npm.depends({
  'babel-core': '5.4.3'
});

Package.onUse(function (api) {
  api.addFiles('babel.js', 'server');

  api.export('Babel', 'server');
});
