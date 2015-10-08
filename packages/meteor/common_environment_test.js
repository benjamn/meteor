function guid() {
  return Math.random().toString(36).slice(2);
}

Tinytest.add("environment - Meteor.install - sync", function (test) {
  var testSyncPackageName = "test-sync-" + guid();

  var load = Meteor.install(testSyncPackageName, {
    "foo.js": function (module, require) {
      module.exports = require("asdf");
    },
    node_modules: {
      asdf: {
        "package.json": function (module) {
          module.exports = {
            main: "./lib"
          };
        },
        lib: {
          "index.js": function (module, require, exports) {
            exports.asdfMain = true;
          }
        }
      }
    }
  });

  test.equal(load("./foo"), {
    asdfMain: true
  });

  test.equal(load("asdf"), {
    asdfMain: true
  });

  test.equal(load("./foo"), load("./foo.js"));
});

Tinytest.addAsync(
  "environment - Meteor.install - async",
  function (test, onComplete) {
    var order = [];

    // Tinytest doesn't know how to clear out the module system between
    // repeated test runs, so we avoid package name collisions manually.
    var testAsyncPackageName = "test-async-" + guid();

    // Calling Meteor.install with an array of module identifiers and a
    // module factory function registers that module as an entry point
    // that should be evaluated once all of its depedencies have been
    // installed. Note that those dependencies may not have been evaluated
    // before this module is evaluated.
    var load = Meteor.install(testAsyncPackageName, [
      "./dep1", // Unmet dependency.
      function (module, require) {
        order.push("root");
        var dep1 = require("./dep1");
        test.equal(dep1, { dep2: true });
        test.ok(load("./dep1") === dep1);
        test.equal(order, ["package.json", "root", "dep2"]);
        test.equal(load("./dep1/dep3"), { dep3: true });
        test.equal(order, ["package.json", "root", "dep2", "dep3"]);
        onComplete();
      }
    ]);

    Meteor.install(testAsyncPackageName, {
      dep1: {
        "package.json": function (module) {
          order.push("package.json");
          module.exports = { main: "./dep2" };
        },
        "dep2.json": [
          "./dep2", // Self dependency.
          "./dep3", // Unmet dependency.
          function (module) {
            order.push("dep2");
            module.exports = { dep2: true };
          }
        ]
      }
    });

    Meteor.install(testAsyncPackageName, {
      dep1: {
        "dep3.js": function (module, require, exports) {
          order.push("dep3");
          exports.dep3 = true;
        }
      }
    });
  }
);

Tinytest.add("environment - Meteor.install - global", function (test) {
  var testGlobalPackageName = "test-global-" + guid();

  Meteor.install(".global", {
    glob: {
      "package.json": function (module) {
        module.exports = { main: "glob.js" };
      },
      "glob.js": function (m, r, exports) {
        exports.glob = "global glob";
      }
    },
    "assert.js": function (m, r, exports) {
      exports.assert = "global assert";
    }
  });

  Meteor.install(testGlobalPackageName, {
    "index1.js": function (m, require) {
      test.equal(require("glob"), { glob: "global glob" });
      test.equal(require("assert"), { assert: "global assert" });
    }
  })("./index1");

  Meteor.install(testGlobalPackageName, {
    node_modules: {
      glob: {
        "index.js": function (m, r, exports) {
          exports.glob = "local glob";
        }
      },
      "assert.js": function (m, r, exports) {
        exports.assert = "local assert";
      }
    },
    "index2.js": function (m, require) {
      test.equal(require("glob"), { glob: "local glob" });
      // The assert module is defined by a single file in the global
      // node_modules directory, so it gets precedence over the version
      // installed locally.
      test.equal(require("assert"), { assert: "global assert" });
    }
  })("./index2");
});

Tinytest.addAsync(
  "environment - Meteor.install - package",
  function (test, onComplete) {
    var testPackage1 = "test-package-1-" + guid();
    var testPackage2 = "test-package-2-" + guid();
    var testPackage3 = "test-package-3-" + guid();

    Meteor.install(testPackage1, {
      "index.js": function (m, r, exports) {
        exports.testPackage = 1;
      }
    });

    Meteor.install(testPackage2, [
      testPackage1, // Met dependency.
      testPackage2, // Self dependency.
      testPackage3, // Unmet dependency.
      function (m, require, exports) {
        test.equal(require(testPackage1), {
          testPackage: 1
        });

        test.ok(require(testPackage2) === exports);
        test.equal(require(testPackage2), {
          testPackage: 2
        });

        test.equal(require(testPackage3), {
          testPackage: 3
        });

        onComplete();
      }
    ]);

    Meteor.install(testPackage3, {
      "index.js": function(module) {
        module.exports = {
          testPackage: 3
        };
      }
    });

    // Finally, turn testPackage2 into a valid package by adding an
    // index.js file.
    Meteor.install(testPackage2, {
      "index.js": function (module) {
        module.exports = { testPackage: 2 };
      }
    });
  }
);
