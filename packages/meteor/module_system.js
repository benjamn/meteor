var global = this;
var installed = {};
var hasOwn = Object.prototype.hasOwnProperty;

function require (absoluteId) {
  if (hasOwn.call(installed, absoluteId)) {
    var module = installed[absoluteId];

    if (! hasOwn.call(module, "exports")) {
      module.call(global, function (relativeId) {
        return require(absolutize(relativeId, absoluteId));
      }, module.exports = {}, module);
    }

    return module.exports;
  }

  throw new Error(
    "module " + JSON.stringify(absoluteId) + " not installed"
  );
}

// Given two module identifiers `relativeId` and `absoluteId`, the
// `absolutize` function returns the absolute form of `relativeId`, as if
// `relativeId` had been required from a module with the identifier
// `absoluteId`.
var pathNormExp = /\/(\.?|[^\/]+\/\.\.)\//;
function absolutize (relativeId, absoluteId) {
  if (relativeId.charAt(0) === ".") {
    // Note: if `absoluteId` is omitted, then `"/undefined/../" + relativeId` will
    // be the starting point for normalization, which works just fine!
    relativeId = "/" + absoluteId + "/../" + relativeId;
    while (relativeId != (absoluteId = relativeId.replace(pathNormExp, "/")))
      relativeId = absoluteId;
    relativeId = relativeId.replace(/^\//, "");
  }
  return relativeId;
}

Meteor.def = function def(id, module) {
  installed[module.id = id] = module;
  if (id.indexOf("packages/") === 0) {
    require(id);
  } else {
    qtail = qtail.next = { module: module };
    flushQueue();
  }
};

// Anonymous modules are pushed onto a queue so that (when ready) they can
// be executed in order of installation.
var qhead = {};
var qtail = qhead;

// The `flushQueue` function attempts to evaluate the oldest module in the
// queue, provided all of its dependencies have been installed. This
// provision is important because it ensures that the module can call
// `require` without fear of missing dependencies.
function flushQueue() {
  var next = qhead.next, module;
  if (next && !flushing && ready(module = next.module)) {
    flushing = qhead = next;
    // Module evaluation might throw an exception, so we need to schedule
    // the next call to `flushQueue` before invoking `module.call`. The
    // `setTimeout` function allows the stack to unwind before flushing
    // resumes, so that the browser has a chance to report exceptions
    // and/or handle other events.
    if (! hasOwn.call(module, "exports")) {
      var timer = global.setTimeout(resume, 0);
      require(module.id);
      global.clearTimeout(timer);
    }
    resume();
  }
}

// If `install` is called during the evaluation of a queued module,
// `flushQueue` could be invoked recursively. To prevent double
// evaluation, `flushQueue` sets `flushing` to a truthy value before it
// evaluates a module and refuses to evaluate any modules if `flushing` is
// truthy already.
var flushing;

// Since `resume` is only ever invoked from `setTimeout`, there is no risk
// that `flushQueue` is already executing, so it is safe to clear the
// `flushing` flag unconditionally.
function resume() {
  flushing = undefined;
  flushQueue();
}

// To be recognized as dependencies, calls to `require` must use string
// literal identifiers.
var requireExp = /[^\.]\brequire\(['"]([^'"]+)['"]\)/g;

// A module is `ready` to be evaluated if
//
//   1. it has an `.exports` property (indicating that it has already begun to be evaluated) or
//   1. all of its direct dependencies are installed and `ready` to be evaluated.
//
// Note that the above definition is recursive.
function ready(module) {
  var deps, code, match, id, result = true;

  if (!module.seen &&
      !hasOwn.call(module, "exports")) {
    // Here's a little secret: module definitions don't have to be
    // functions, as long as they have a suitable `.toString` and `.call`
    // methods. If you have a really long module that you don't want to
    // waste time scanning, just override its `.toString` function to
    // return something equivalent (with regard to dependencies) but
    // shorter.
    deps = module.deps;
    if (!deps) {
      code = module + "";
      deps = module.deps = {};
      requireExp.lastIndex = 0;
      while ((match = requireExp.exec(code)))
        deps[absolutize(match[1], module.id)] = true;
    }

    // There may be cycles in the dependency graph, so we must be
    // careful that the recursion always terminates. Each module we
    // check is temporarily marked as `.seen` before its dependencies
    // are traversed, so that if we encounter the same module again we
    // can immediately return `true`.
    module.seen = true;

    for (id in deps) {
      if (hasOwn.call(deps, id)) {
        // Once a dependency is determined to be satisfied, we
        // remove its identifier from `module.deps`, so that we
        // can avoid considering it again if `ready` is called
        // multiple times.
        if (hasOwn.call(installed, id) && ready(installed[id])) {
          delete deps[id];
          // If any dependency is missing or not `ready`, then the
          // current module is not yet `ready`. The `break` is not
          // strictly necessary here, but immediately terminating
          // the loop postpones work that can be done later.
        } else {
          result = false;
          break;
        }
      }
    }

    // Ordinarily I would be more paranoid about always resetting
    // `module.seen` to `false`, but if you thoroughly examine the code
    // above, you'll find that the only real threat of exceptions comes
    // from evaluating `code = module + ""` in a recursive call to
    // `ready`. So if you decide to override the `.toString` method of a
    // module for performance reasons, get it right.
    module.seen = false;
  }

  // console.log("ready", module.id, result, module.deps);
  return result;
}
