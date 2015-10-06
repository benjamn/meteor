import { parse } from 'meteor-babel';
import { analyze as analyzeScope } from 'escope';

// Like babel.parse, but annotates any thrown error with $ParseError = true.
function tryToParse(source) {
  try {
    return parse(source, {strictMode: false});
  } catch (e) {
    if (typeof e.loc === 'object') {
      e.$ParseError = true;
    }
    throw e;
  }
}

var dependencyKeywordPattern = /\b(require|import|export)\b/g;

export function findImportedModuleIdentifiers(source) {
  const identifiers = {};
  const possibleIndexes = [];
  let match;

  dependencyKeywordPattern.lastIndex = 0;
  while ((match = dependencyKeywordPattern.exec(source))) {
    possibleIndexes.push(match.index);
  }

  if (!possibleIndexes.length) {
    return [];
  }

  const ast = tryToParse(source);

  function walk(node, left, right) {
    if (left >= right) {
      // The window of possible indexes is empty, so we can ignore
      // the entire subtree rooted at this node.
    } else if (Array.isArray(node)) {
      for (var i = 0, len = node.length; i < len; ++i) {
        walk(node[i], left, right);
      }
    } else if (isNode(node)) {
      const start = node.start;
      const end = node.end;

      // Narrow the left-right window to exclude possible indexes
      // that fall outside of the current node.
      while (left < right && possibleIndexes[left] < start) ++left;
      while (left < right && end < possibleIndexes[right - 1]) --right;

      if (left < right) {
        let id = getRequiredModuleId(node);
        if (typeof id === "string") {
          identifiers[id] = node;
          return;
        }

        id = getImportedModuleId(node);
        if (typeof id === "string") {
          identifiers[id] = node;
          return;
        }

        // Continue traversing the children of this node.
        for (const key of Object.keys(node)) {
          switch (key) {
          case "type":
          case "loc":
          case "start":
          case "end":
            // Ignore common keys that are never nodes.
            continue;
          }

          walk(node[key], left, right);
        }
      }
    }
  }

  walk(ast, 0, possibleIndexes.length);

  return identifiers;
}

function isNode(value) {
  return value
    && typeof value === "object"
    && typeof value.type === "string"
    && typeof value.start === "number"
    && typeof value.end === "number";
}

function getRequiredModuleId(node) {
  if (node.type === "CallExpression" &&
      node.callee.type === "Identifier" &&
      node.callee.name === "require") {
    const args = node.arguments;
    const argc = args.length;
    if (argc > 0) {
      const arg = args[0];
      if (arg.type === "Literal" &&
          typeof arg.value === "string") {
        return arg.value;
      }
    }
  }
}

function getImportedModuleId(node) {
  if (node.type === "ImportDeclaration" ||
      node.type === "ExportAllDeclaration" ||
      node.type === "ExportNamedDeclaration") {
    // The .source of an ImportDeclaration or Export{Named,All}Declaration
    // is always a string-valued Literal node, if not null.
    if (isNode(node.source)) {
      return node.source.value;
    }
  }
}

// Analyze the JavaScript source code `source` and return a dictionary of all
// globals which are assigned to in the package. The values in the dictionary
// are all `true`.
//
// This is intended for use in detecting package-scope variables in Meteor
// packages, where the linker needs to add a "var" statement to prevent them
// from staying as globals.
//
// It only cares about assignments to variables; an assignment to a field on an
// object (`Foo.Bar = true`) neither causes `Foo` nor `Foo.Bar` to be returned.
export function findAssignedGlobals(source) {
  // escope's analyzer treats vars in the top-level "Program" node as globals.
  // The \n// */\n is necessary in case source ends with an unclosed comment.
  const wrappedSource = 'function wrapper() {' + source + '\n// */\n}';

  const ast = tryToParse(wrappedSource);
  // We have to pass ignoreEval; otherwise, the existence of a direct eval call
  // causes escope to not bother to resolve references in the eval's scope.
  // This is because an eval can pull references inward:
  //
  //   function outer() {
  //     var i = 42;
  //     function inner() {
  //       eval('var i = 0');
  //       i;  // 0, not 42
  //     }
  //   }
  //
  // But it can't pull references outward, so for our purposes it is safe to
  // ignore.
  const scopeManager = analyzeScope(ast, { ignoreEval: true });
  const globalScope = scopeManager.acquire(ast);

  const assignedGlobals = {};
  // Underscore is not available in this package.
  globalScope.implicit.variables.forEach((variable) => {
    assignedGlobals[variable.name] = true;
  });

  return assignedGlobals;
}
