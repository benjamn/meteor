HTML = {};

Promise = Npm.require("bluebird");
IDENTITY = function (x) { return x; };
SLICE = Array.prototype.slice;

var promiseLoopStack = [];

Promise.setScheduler(function(callback) {
  if (promiseLoopStack.length > 0) {
    promiseLoopStack[promiseLoopStack.length - 1].push(callback);
  } else if (typeof process === "object" &&
             typeof process.nextTick === "function") {
    process.nextTick(callback);
  } else {
    Meteor.setTimeout(callback, 0);
  }
});

Promise.synchronize = function(fn) {
  return function wrapper() {
    var loop = [];
    promiseLoopStack.push(loop);
    try {
      var result = fn.apply(this, arguments);
      if (Promise.is(result)) {
        result.done(function(value) {
          result = value;
        });
      }
    } finally {
      for (var i = 0; i < loop.length; ++i) {
        try {
          (0, loop[i])();
        } finally {
          continue;
        }
      }
      promiseLoopStack.pop();
    }
    return result;
  };
};
