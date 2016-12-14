var Mp = module.constructor.prototype;
var previous = Object.create(null);
var pending = Object.create(null);

Mp.dynamicImport = function (id) {
  var module = this;
  var startTime = +new Date;

  try {
    return Promise.resolve(getNamespace(module, id));
  } catch (e) {
    var parentId = module.id;
    var requests = pending[parentId] = pending[parentId] || {};

    return new Promise(function (resolve, reject) {
      Meteor.call("__dynamicImport", {
        id: id,
        parentId: parentId,
        previous: previous,
        pending: pending
      }, function (error, results) {
        delete requests[id];
        if (! Object.keys(requests).length) {
          delete pending[parentId];
        }
        error ? reject(error) : resolve(results);
      });

      requests[id] = 1;

    }).then(function (results) {
      results.forEach(installResult);
      return getNamespace(module, id);
    });
  }
};

function installResult(result) {
  var tree = new Function(
    "require,exports,module",
    result.code
  );

  var idParts = result.id.split("/");
  while (idParts.length) {
    var part = idParts.pop();
    if (part) {
      var next = {};
      next[part] = tree;
      tree = next;
    }
  }

  rememberId(result.id, previous);

  meteorInstall(tree, {
    extensions: result.extensions
  });
}

function rememberId(absId, previous) {
  var idParts = absId.split("/");
  var lastIndex = idParts.length - 1;
  idParts.forEach(function (part, i) {
    if (part) {
      var next = previous[part] ||
        (i < lastIndex ? Object.create(null) : 1);
      previous = previous[part] = next;
    }
  });
}

exports.rememberId = rememberId;

function getNamespace(module, id) {
  var namespace = Object.create(null);
  module.import(id, {
    "*": function (value, key) {
      namespace[key] = value;
    }
  });
  return namespace;
}
