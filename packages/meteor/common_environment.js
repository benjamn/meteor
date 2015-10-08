/**
 * @summary The Meteor namespace
 * @namespace Meteor
 */
if (typeof Meteor !== "object") {
  Meteor = {};
}

var hop = {}.hasOwnProperty;
var extensions = ["", ".js", ".json"];
var MISSING = {};
var undefined;

function getOwn(obj, key) {
  return hop.call(obj, key) && obj[key];
}

function isObject(value) {
  return value && typeof value === "object";
}

function isFunction(value) {
  return typeof value === "function";
}

function isString(value) {
  return typeof value === "string";
}

// File objects represent either directories or modules that have been
// installed via Meteor.install. When a File respresents a directory, its
// .contents property is an object containing the names of the files (or
// directories) that it contains. When a File represents a module, its
// .contents property is a function that can be invoked with the
// appropriate (module, require, exports) arguments to evaluate the
// module. The .parent property of a File is either a directory File or
// null. Note that a child may claim another File as its parent even if
// the parent does not have an entry for that child in its .contents
// object. This is important for implementing anonymous files, and for
// preventing child modules from using ../relative/identifier syntax to
// examine unrelated modules.
function File(contents, parent) {
  var file = this;

  file.parent = parent = parent || null;
  file.merge(contents);

  // Each directory File has its own bound version of the require function
  // that can resolve relative identifiers. Non-directory Files inherit
  // the require function of their parent directories, so we don't have to
  // create a new require function every time we evaluate a module.
  file.require = file.isDir() ? function require(id) {
    var result = evaluate(file.resolve(id));
    if (result === MISSING) {
      throw new Error("Cannot find module '" + id + "'");
    }
    return result;
  } : parent && parent.require;
}

var Fp = File.prototype;

function evaluate(file) {
  var module = file && file.contents;
  if (isFunction(module)) {
    if (! hop.call(module, "exports")) {
      module(module, file.require, module.exports = {});
    }
    return module.exports;
  }
  return MISSING;
}

Fp.isDir = function () {
  return isObject(this.contents);
};

Fp.merge = function (contents) {
  var file = this;

  if ((contents = ensureObjectOrFunction(contents))) {
    var fileContents = file.contents = file.contents || (
      isFunction(contents) ? contents : {}
    );

    if (isObject(contents) && file.isDir()) {
      Object.keys(contents).forEach(function (key) {
        var child = getOwn(fileContents, key);
        if (child) {
          child.merge(contents[key]);
        } else {
          fileContents[key] = new File(contents[key], file);
        }
      });
    }
  }
};

function ensureObjectOrFunction(contents) {
  if (Array.isArray(contents)) {
    var deps = {};
    contents.forEach(function (item) {
      if (isString(item)) {
        deps[item] = true;
      } else if (isFunction(item)) {
        item.deps = deps;
        contents = item;
      }
    });
  } else if (isFunction(contents)) {
    contents.deps = contents.deps || {};
  } else if (! isObject(contents)) {
    contents = null;
  }
  return contents;
}

Fp.appendIdPart = function (part, isLastPart) {
  var file = this;

  while (file && ! file.isDir()) {
    file = file.parent;
  }

  if (! file || ! part || part === ".") {
    return file;
  }

  if (part === "..") {
    return file.parent;
  }

  for (var e = 0; e < extensions.length; ++e) {
    var withExtension = part + extensions[e];

    var child = getOwn(file.contents, withExtension);
    if (child) {
      return child;
    }

    if (! isLastPart) {
      // Only consider multiple file extensions if this part is the last
      // part of a module identifier, and not "." or ".."
      break;
    }
  }

  return null;
};

Fp.appendId = function (id) {
  var file = this;
  var parts = id.split("/");
  // Use Array.prototype.every to terminate iteration early if
  // file.appendIdPart returns null.
  parts.every(function (part, i) {
    return file = file.appendIdPart(part, i === parts.length - 1);
  });
  return file;
};

Fp.resolve = function (id) {
  var file = this;

  // The resolve method can be called without an argument to return the
  // file or directory represented by the current file.
  if (id) {
    file =
      // Absolute module identifiers (i.e. those that begin with a /
      // character) are interpreted relative to the app root directory,
      // which is a slight deviation from Node, which has access to the
      // entire file system.
      id.charAt(0) === "/" ? appDir.appendId(id) :
      // Relative module identifiers are interpreted relative to the
      // current file, naturally.
      id.charAt(0) === "." ? file.appendId(id) :
      // Top-level module identifiers are interpreted as referring to
      // either Meteor or NPM packages.
      file.topLevelLookup(id);
  }

  // If the identifier resolves to a directory, we use the same logic as
  // Node to find an index.js or package.json file to evaluate.
  while (file && file.isDir()) {
    // If package.json does not exist, evaluate will return the MISSING
    // object, which has no .main property.
    var pkg = evaluate(file.appendIdPart("package.json"));
    file = pkg && isString(pkg.main) &&
      file.appendId(pkg.main) || // Might resolve to another directory!
      file.appendIdPart("index.js");
  }

  return file;
};

Fp.topLevelLookup = function (id) {
  var parts = id.split("/");

  if (parts.length === 1) {
    // Use .appendIdPart instead of .appendId or .resolve to ensure the
    // lookup only matches files in the root of the global node_modules
    // directory tree, but pass true for the isLastPart parameter so that
    // .appendIdPart will try multiple file extensions.
    var file = globalNodeModulesDir.appendIdPart(parts[0], true);
    if (file && isFunction(file.contents)) {
      // Only give global packages preference over local packages if they
      // are backed by single-file modules.
      return file;
    }

    if ((file = getOwn(packageDirs, parts[0]))) {
      // If the identifier matches an installed Meteor package, return the
      // corresponding File object, which will most likely be a directory
      // that contains an automatically-generated index.js file.
      return file;
    }
  }

  return this.nodeModulesLookup(id);
};

Fp.nodeModulesLookup = function (id) {
  var file = this;
  return file.isDir() &&
    file.appendId("node_modules/" + id) ||
    (file.parent &&
     file.parent.nodeModulesLookup(id));
};

var globalDir = new File({
  node_modules: {
    // This virtual node_modules directory contains globally-installed NPM
    // packages, available to all package and app code. Non-directory
    // files in this directory are treated as core modules, in the sense
    // of 'path', 'fs', 'assert', etc.
  }
});

var globalNodeModulesDir = globalDir.appendIdPart("node_modules");

var packageDirs = {
  // Map from "user:package" names to File objects representing root
  // package directories.
};

var appDir = new File({
  // This virtual directory tree stores all app code, including local
  // node_modules directories, but excluding the app/packages/ directory.
}, globalDir);

// A queue of anonymous modules waiting to be evaluated when all of their
// dependencies are installed and ready.
var queueHead = {};
var queueTail = queueHead;

function flushQueue() {
  Meteor.defer(function () {
    if (ready(queueHead.next)) {
      // Schedule the next flush now, in case evaluate throws.
      flushQueue();
      evaluate(queueHead = queueHead.next);
    }
  });
}

// A file is ready if all of its dependencies are installed and ready.
function ready(file) {
  var result = !! file;
  var module = file && file.contents;
  var deps = module && module.deps;
  if (deps && ! getOwn(module, "seen")) {
    module.seen = true;
    result = Object.keys(deps).every(function (dep) {
      if (ready(file.resolve(dep))) {
        // Delete satisfied dependencies so that the readiness check gets
        // cheaper over time.
        delete deps[dep];
        return true;
      }
    });
    module.seen = undefined;
  }
  return result;
}

Meteor.install = function (packageName, tree) {
  var targetDir = appDir; // Install tree into appDir by default.

  if (isString(packageName)) {
    targetDir = packageName === ".global"
      // Meteor.install(".global", {...}) will install the tree into the
      // global node_modules directory.
      ? globalNodeModulesDir
      // Meteor.install("user:package", {...}) will install the tree into
      // the directory associated with that package.
      : getOwn(packageDirs, packageName) || (
        packageDirs[packageName] = new File({}, globalDir)
      );
  } else {
    // Omitting the packageName argument to Meteor.install will install
    // the tree into the app directory.
    tree = packageName;
  }

  tree = ensureObjectOrFunction(tree);
  if (isFunction(tree)) {
    // If the given tree is a function expression or an array literal
    // containing a function expression, put it on the queue to be
    // evaluated when all of its dependencies are installed and ready.
    queueTail = queueTail.next = new File(tree, targetDir);
    if (queueHead.next === queueTail) {
      // If the queue contains only one File (the one we just added), go
      // ahead and try to evaluate it.
      flushQueue();
    }
  } else {
    // The only way for previously unsatisfied dependencies to become
    // satisfied is for a new tree to be installed by Meteor.install.
    targetDir.merge(tree);
    flushQueue();
  }

  // Meteor.install returns a require function that resolves module
  // identifiers relative to the target directory, as if the identifier
  // were required from a file in the target directory.
  return targetDir.require;
};
