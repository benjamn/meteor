// These tests are of Babel's output.  They document what we require
// from Babel, and catch any changes in Babel's output.  They also
// serve as examples.

// TODO: Make a nice page showing these examples, with commentary!

BabelTests = {
  Transpile: {}
};

BabelTests.Transpile.groups = [
  {
    groupName: 'Classes',
    features: ['es6.classes', 'es6.blockScoping'],
    commentary: `Here's a good reference: [Classes in ECMAScript 6 (final semantics)](http://www.2ality.com/2015/02/es6-classes-final.html).  Note that the transpiler emits \`let\` statements for class definitions, so we need to transpile those too.`,
    cases: [
      {
        name: 'basic class',
        commentary: `This is a basic class definition with a constructor.  The \`classCallCheck\` helper makes sure the constructor is being called with \`new\`, because calling it as a function is disallowed.`,
        input:
        ` | class Foo {
          |   constructor(x) {
          |     this.x = x;
          |   }
          | }`,
        expected:
        ` | var Foo = function Foo(x) {
          |   babelHelpers.classCallCheck(this, Foo);
          |
          |   this.x = x;
          | };`
      },
      {
        name: 'empty subclass',
        commentary: `A subclass (also called a derived class) gets a default constructor that calls the super constructor.`,
        input:
        ` | class Foo extends Bar {}`,
        expected:
        ` | var Foo = (function (_Bar) {
          |   function Foo() {
          |     babelHelpers.classCallCheck(this, Foo);
          |
          |     if (_Bar != null) {
          |       _Bar.apply(this, arguments);
          |     }
          |   }
          |
          |   babelHelpers.inherits(Foo, _Bar);
          |   return Foo;
          | })(Bar);`
      }
    ]
  },
  {
    groupName: 'Template Strings',
    features: ['es6.templateLiterals'],
    cases: [
      {
        name: 'basic interpolation',
        commentary: `Template strings are a nice alternative to string concatenation for generating messages.`,
        input: 'print(`Yo, ${name}!`)',
        expected: 'print("Yo, " + name + "!");'
      },
      {
        name: 'fancier interpolation',
        commentary: `You can put any expression inside the curly braces (which are required).`,
        input:
        ` | print(\`\${x} times \${y} is \${x*y}.\`);
          | print(\`\${x} plus \${y} is \${x+y}.\`);`,
        expected:
        ` | print("" + x + " times " + y + " is " + x * y + ".");
          | print("" + x + " plus " + y + " is " + (x + y) + ".");`
      },
      {
        name: 'basic multiline',
        commentary: `Template strings may span multiple lines.`,
        input: 'print(`foo\nbar`)',
        expected: 'print("foo\\nbar");'
      },
      {
        name: 'multiline with whitespace',
        commentary: `All leading whitespace is included.`,
        input: 'print(`foo\n  bar`)',
        expected: 'print("foo\\n  bar");'
      },
      {
        name: 'basic tag',
        commentary: `You can "tag" a template string with a function that receives the parts of the string.`,
        input: 'print(fn`Yo, ${name}!`)',
        expected: 'print(fn(babelHelpers.taggedTemplateLiteral(["Yo, ", "!"], ["Yo, ", "!"]), name));'
      },
      {
        name: 'tag raw',
        commentary: `The tag function receives both the parsed and the "raw" forms of the string parts (but only the value of the interpolated expressions like \`name\`).`,
        input: 'print(fn`Yo,\\u0020${name}!`)',
        expected: 'print(fn(babelHelpers.taggedTemplateLiteral(["Yo, ", "!"], ["Yo,\\\\u0020", "!"]), name));'
      }
    ]
  },
  {
    groupName: 'Arrow Functions',
    features: ['es6.arrowFunctions'],
    cases: [
      {
        name: 'basic expression',
        commentary: `Arrow functions are, for one thing, a shorter way to write function literals.

The body can be an expression (with no return statement), or a block (which must have an explicit return statement to return a value).  The parentheses around the argument list can be omitted if there is exactly one argument.`,
        input:
        ` | var sum = (x,y) => x + y;
          | var square = x => x*x;
          | var printAndReturn = x => { print(x); return x; };
          | var returnZero = () => 0;`,
        expected:
        ` | var sum = function (x, y) {
          |   return x + y;
          | };
          | var square = function (x) {
          |   return x * x;
          | };
          | var printAndReturn = function (x) {
          |   print(x);return x;
          | };
          | var returnZero = function () {
          |   return 0;
          | };`
      },
      {
        name: 'binding this',
        commentary: `Unlike normal function literals, arrow functions do not have their own \`this\` that depends on how they are called.  They always use the enclosing value of \`this\`.  This behavior is implemented efficiently by the transpiler using a closure.`,
        input:
        ` | var f = function () {
          |   return () => { this.frob(); }
          | };`,
        expected:
        ` | var f = function () {
          |   var _this = this;
          |
          |   return function () {
          |     _this.frob();
          |   };
          | };`
      },
      {
        name: 'binding this doesn\'t clobber variables',
        commentary: `If you name a variable \`_this\`, the transpiler is smart and won't clobber it.`,
        input:
        ` | var f = function () {
          |   return () => this;
          | };
          | var _this = null;`,
        expected:
        ` | var f = function () {
          |   var _this2 = this;
          |
          |   return function () {
          |     return _this2;
          |   };
          | };
          | var _this = null;`
      }
    ]
  },
  {
    groupName: 'Let and Const',
    features: ['es6.blockScoping'],
    cases: [
      {
        name: 'basic let',
        input: 'let x = 3; print(x)',
        expected: 'var x = 3;print(x);'
      }
    ]
  },
  {
    groupName: 'Flow',
    features: ['flow'],
    commentary: `Strip Flow type annotations.`,
    cases: [
      {
        name: 'basic flow',
        input: 'var foo = function (one: any, two: number, three?): string {};',
        expected: 'var foo = function (one, two, three) {};'
      }
    ]
  }
];

// Parse the "pipe form" that we use so that multiline strings with leading
// whitespace can be indented nicely in source code (by Emacs js2-mode, at
// lesat):
//
// ```
//  expected:
//  ` | var square = function (x) {
//    |   return x * x;
//    | };`
// ```

var stripPipes = function (str) {
  var lines = str.split('\n');
  if (lines.length && /^\s*\|/.test(lines[0])) {
    var match = /^\s*\|(\s*)/.exec(lines[0]);
    var spacesAfterPipe = match[1].length;
    return _.map(lines, function (line) {
      var prefix = line.match(/(^\s*\|)|/)[0];
      if (! prefix) {
        return line;
      }
      return line.slice(prefix.length + spacesAfterPipe);
    }).join('\n');
  } else {
    return str;
  }
};

_.each(BabelTests.Transpile.groups, function (group) {
  _.each(group.cases, function (c) {
    c.input = stripPipes(c.input);
    c.expected = stripPipes(c.expected);
  });
});
