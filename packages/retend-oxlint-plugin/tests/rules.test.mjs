import assert from 'node:assert/strict';
import test from 'node:test';

import { plugin } from '../index.js';

function runVisitor(ruleName, visitorName, node) {
  const reports = [];
  const visitors = plugin.rules[ruleName].createOnce({
    report(report) {
      reports.push(report);
    },
  });

  visitors[visitorName](node);
  return reports;
}

function jsxAttribute(name) {
  return {
    type: 'JSXAttribute',
    name: { type: 'JSXIdentifier', name },
  };
}

function jsxElement(name, attributes = []) {
  return {
    type: 'JSXElement',
    openingElement: {
      name: { type: 'JSXIdentifier', name },
      attributes,
    },
  };
}

function cellGetCall(cellName = 'items') {
  return {
    type: 'CallExpression',
    arguments: [],
    callee: {
      type: 'MemberExpression',
      computed: false,
      object: { type: 'Identifier', name: cellName },
      property: { type: 'Identifier', name: 'get' },
    },
  };
}

test('require-submit-prevent reports form submit handlers without --prevent', () => {
  const reports = runVisitor(
    'require-submit-prevent',
    'JSXElement',
    jsxElement('form', [jsxAttribute('onSubmit')])
  );

  assert.equal(reports.length, 1);
  assert.equal(reports[0].messageId, 'unexpected');
});

test('require-submit-prevent allows form submit handlers with --prevent', () => {
  const reports = runVisitor(
    'require-submit-prevent',
    'JSXElement',
    jsxElement('form', [jsxAttribute('onSubmit--prevent')])
  );

  assert.equal(reports.length, 0);
});

test('invalid-event-modifiers reports unknown modifiers', () => {
  const reports = runVisitor(
    'invalid-event-modifiers',
    'JSXAttribute',
    jsxAttribute('onClick--preventDefault')
  );

  assert.equal(reports.length, 1);
  assert.equal(reports[0].messageId, 'invalid');
});

test('invalid-event-modifiers reports passive plus prevent', () => {
  const reports = runVisitor(
    'invalid-event-modifiers',
    'JSXAttribute',
    jsxAttribute('onScroll--passive--prevent')
  );

  assert.equal(reports.length, 1);
  assert.equal(reports[0].messageId, 'passivePrevent');
});

test('no-cell-mutation-without-set reports mutating method calls on .get()', () => {
  const reports = runVisitor('no-cell-mutation-without-set', 'CallExpression', {
    type: 'CallExpression',
    arguments: [{ type: 'Identifier', name: 'nextItem' }],
    callee: {
      type: 'MemberExpression',
      computed: false,
      object: cellGetCall(),
      property: { type: 'Identifier', name: 'push' },
    },
  });

  assert.equal(reports.length, 1);
  assert.equal(reports[0].messageId, 'unexpected');
});

test('no-cell-mutation-without-set reports property assignment on .get()', () => {
  const reports = runVisitor(
    'no-cell-mutation-without-set',
    'AssignmentExpression',
    {
      type: 'AssignmentExpression',
      operator: '=',
      left: {
        type: 'MemberExpression',
        computed: false,
        object: cellGetCall('user'),
        property: { type: 'Identifier', name: 'name' },
      },
      right: { type: 'Literal', value: 'Ada' },
    }
  );

  assert.equal(reports.length, 1);
  assert.equal(reports[0].messageId, 'unexpected');
});

test('no-async-component reports async top-level JSX components', () => {
  const reports = runVisitor('no-async-component', 'Program', {
    type: 'Program',
    body: [
      {
        type: 'FunctionDeclaration',
        async: true,
        id: { type: 'Identifier', name: 'App' },
        params: [],
        body: {
          type: 'BlockStatement',
          body: [
            {
              type: 'ReturnStatement',
              argument: jsxElement('div'),
            },
          ],
        },
      },
    ],
  });

  assert.equal(reports.length, 1);
  assert.equal(reports[0].messageId, 'unexpected');
});

function identifier(name) {
  return { type: 'Identifier', name };
}

function member(object, property) {
  return {
    type: 'MemberExpression',
    computed: false,
    object: typeof object === 'string' ? identifier(object) : object,
    property: identifier(property),
  };
}

function call(callee, args = []) {
  return {
    type: 'CallExpression',
    arguments: args,
    callee,
  };
}

function cellSource(value) {
  return call(member('Cell', 'source'), [{ type: 'Literal', value }]);
}

function cellSet(cellName, value) {
  return call(member(cellName, 'set'), [{ type: 'Literal', value }]);
}

function expressionStatement(expression) {
  return { type: 'ExpressionStatement', expression };
}

function programWithComponent(body) {
  return {
    type: 'Program',
    body: [
      {
        type: 'FunctionDeclaration',
        id: identifier('App'),
        params: [],
        body: {
          type: 'BlockStatement',
          body: [
            ...body,
            {
              type: 'ReturnStatement',
              argument: jsxElement('div'),
            },
          ],
        },
      },
    ],
  };
}

test('no-cell-type-alias reports aliased Cell type imports', () => {
  const reports = runVisitor('no-cell-type-alias', 'ImportDeclaration', {
    type: 'ImportDeclaration',
    importKind: 'type',
    source: { type: 'Literal', value: 'retend' },
    specifiers: [
      {
        type: 'ImportSpecifier',
        imported: identifier('Cell'),
        local: identifier('CellType'),
      },
    ],
  });

  assert.equal(reports.length, 1);
  assert.equal(reports[0].messageId, 'unexpected');
});

test('no-cell-type-alias allows direct Cell type imports', () => {
  const reports = runVisitor('no-cell-type-alias', 'ImportDeclaration', {
    type: 'ImportDeclaration',
    importKind: 'type',
    source: { type: 'Literal', value: 'retend' },
    specifiers: [
      {
        type: 'ImportSpecifier',
        imported: identifier('Cell'),
        local: identifier('Cell'),
      },
    ],
  });

  assert.equal(reports.length, 0);
});

test('prefer-cell-task reports try catch finally with loading state', () => {
  const reports = runVisitor(
    'prefer-cell-task',
    'Program',
    programWithComponent([
      {
        type: 'VariableDeclaration',
        kind: 'const',
        declarations: [
          {
            type: 'VariableDeclarator',
            id: identifier('busy'),
            init: cellSource(false),
          },
        ],
      },
      {
        type: 'VariableDeclaration',
        kind: 'const',
        declarations: [
          {
            type: 'VariableDeclarator',
            id: identifier('save'),
            init: {
              type: 'ArrowFunctionExpression',
              async: true,
              params: [],
              body: {
                type: 'BlockStatement',
                body: [
                  expressionStatement(cellSet('busy', true)),
                  {
                    type: 'TryStatement',
                    block: {
                      type: 'BlockStatement',
                      body: [
                        expressionStatement({
                          type: 'AwaitExpression',
                          argument: call(identifier('saveThing')),
                        }),
                      ],
                    },
                    handler: {
                      type: 'CatchClause',
                      param: identifier('caught'),
                      body: { type: 'BlockStatement', body: [] },
                    },
                    finalizer: {
                      type: 'BlockStatement',
                      body: [expressionStatement(cellSet('busy', false))],
                    },
                  },
                ],
              },
            },
          },
        ],
      },
    ])
  );

  assert.equal(reports.length, 1);
  assert.equal(reports[0].messageId, 'unexpected');
});

test('prefer-cell-task allows try catch without loading finalizer', () => {
  const reports = runVisitor(
    'prefer-cell-task',
    'Program',
    programWithComponent([
      {
        type: 'VariableDeclaration',
        kind: 'const',
        declarations: [
          {
            type: 'VariableDeclarator',
            id: identifier('busy'),
            init: cellSource(false),
          },
        ],
      },
      {
        type: 'VariableDeclaration',
        kind: 'const',
        declarations: [
          {
            type: 'VariableDeclarator',
            id: identifier('save'),
            init: {
              type: 'ArrowFunctionExpression',
              async: true,
              params: [],
              body: {
                type: 'BlockStatement',
                body: [
                  {
                    type: 'TryStatement',
                    block: {
                      type: 'BlockStatement',
                      body: [
                        expressionStatement({
                          type: 'AwaitExpression',
                          argument: call(identifier('saveThing')),
                        }),
                      ],
                    },
                    handler: {
                      type: 'CatchClause',
                      param: identifier('caught'),
                      body: { type: 'BlockStatement', body: [] },
                    },
                    finalizer: {
                      type: 'BlockStatement',
                      body: [],
                    },
                  },
                ],
              },
            },
          },
        ],
      },
    ])
  );

  assert.equal(reports.length, 0);
});
