import Importer from "./importer.js";
import "./client.js";

const hasOwn = Object.prototype.hasOwnProperty;
const importers = Object.create(null);

Meteor.methods({
  __dynamicImport({
    // The requested module identifier string.
    id,
    // Absolute identifier of the requesting module.
    parentId,
    // Tree of all absolute identifiers of dynamic modules previously
    // received by the client.
    previous,
    // Requested but not yet received modules, represented as { id,
    // parentId } records. The server will resolve these requests and
    // merge them into previous before collecting results.
    pending,
  }) {
    const platform = this.connection ? "web.browser" : "server";
    const importer = getOrCreateImporter(platform);
    if (importer) {
      const startTime = +new Date;
      const results =
        importer.getResults(id, parentId, previous, pending);
      console.log(new Date - startTime, "ms", id, parentId);
      return results;
    }
  }
});

function getOrCreateImporter(platform) {
  if (hasOwn.call(importers, platform)) {
    return importers[platform];
  }

  if (hasOwn.call(dynamicImportInfo, platform)) {
    const {
      sourceRoot,
      manifest,
    } = dynamicImportInfo[platform];

    return importers[platform] =
      new Importer(sourceRoot, manifest);
  }
}
