const fs = require("fs");
const path = require("path");
const hasOwn = Object.prototype.hasOwnProperty;

import { rememberId } from "./client.js";

function haveSeenIdPreviously(id, previous) {
  return id.split("/").every(part => {
    if (part === "") {
      return true;
    }

    if (! hasOwn.call(previous, part)) {
      return false;
    }

    const next = previous[part];
    if (next === 1) {
      return true;
    }

    previous = next;
    return true;
  });
}

export default class Importer {
  constructor(sourceRoot, manifest) {
    this.sourceRoot = sourceRoot;
    this.manifest = manifest;
    this._readFileCache = Object.create(null);
    this._resolveCache = Object.create(null);
  }

  getResults(id, parentId, previous, pending) {
    const importer = this;
    const results = [];

    function walk(id, parentId, callback) {
      const dynamicPath = importer.resolve(id, parentId);
      if (! hasOwn.call(importer.manifest, dynamicPath)) {
        return;
      }

      const item = importer.manifest[dynamicPath];
      const result =
        importer.getResultFromDynamicPath(dynamicPath);

      if (! result) return;
      if (haveSeenIdPreviously(result.id, previous)) {
        return;
      }

      rememberId(result.id, previous);

      if (callback) {
        callback(result);
      }

      Object.keys(item.deps).forEach(id => {
        // Let dynamic dependencies be requested later.
        if (! item.deps[id].dynamic) {
          // If we know the install path, use that instead of id.
          const installPath = item.deps[id].installPath;
          const absInstallPath = installPath &&
            installPath.replace(/^\/*/, "/");
          walk(absInstallPath || id, result.id, callback);
        }
      });
    }

    // Populate the previous object with all the dependencies of any
    // pending requests so that we don't include them in results.
    Object.keys(pending).forEach(parentId => {
      Object.keys(pending[parentId]).forEach(
        id => walk(id, parentId)
      );
    });

    walk(id, parentId, result => results.push(result));

    results.forEach((result, i) => {
      result.code = importer._read(result.path);
    });

    return results;
  }

  getResultFromDynamicPath(dynamicPath) {
    const item = this.manifest[dynamicPath];
    return item && {
      id: dynamicPath.replace(/^dynamic\b/, ""),
      path: path.join(this.sourceRoot, dynamicPath),
      code: null, // Filled in later.
      extensions: item.extensions,
    };
  }

  _read(absPath) {
    return hasOwn.call(this._readFileCache, absPath)
      ? this._readFileCache[absPath]
      : this._readFileCache[absPath] =
          fs.readFileSync(absPath, "utf8");
  }

  // TODO Somehow defer to modules-runtime/meteorInstall for this logic.
  resolve(id, parentId) {
    const cacheKey = JSON.stringify({parentId,id});

    if (hasOwn.call(this._resolveCache, cacheKey)) {
      return this._resolveCache[cacheKey];
    }

    return this._resolveCache[cacheKey] =
      this.resolveAbsolute(id, parentId) ||
      this.resolveRelative(id, parentId) ||
      this.resolveNodeModules(id, parentId);
  }

  resolveAbsolute(id, parentId) {
    return id.startsWith("/") &&
      this.resolveDynamicPath(path.join("dynamic", id));
  }

  resolveRelative(id, parentId) {
    return id.startsWith(".") &&
      this.resolveDynamicPath(
        path.join("dynamic", parentId, "..", id));
  }

  resolveNodeModules(id, parentId) {
    // TODO Improve this.
    return this.resolveDynamicPath(
      path.join("dynamic", "node_modules", id));
  }

  resolveDynamicPath(dynamicPath) {
    dynamicPath = path.normalize(dynamicPath);

    if (hasOwn.call(this.manifest, dynamicPath)) {
      return dynamicPath;
    }

    for (const key in this.manifest) {
      if (! hasOwn.call(this.manifest, key)) {
        continue;
      }

      if (key.startsWith(dynamicPath)) {
        const item = this.manifest[key];
        if (item) {
          const extensions = item.extensions || [".js", ".json"];
          for (var i = 0; i < extensions.length; ++i) {
            if (key === dynamicPath + extensions[i]) {
              return key;
            }
          }
        }
      }
    }
  }
}
