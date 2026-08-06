import assert from 'node:assert/strict';
import test from 'node:test';

import { plugin } from '../index.js';

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
  return { type: 'CallExpression', callee, arguments: args };
}

function literal(value) {
  return { type: 'Literal', value };
}

function expressionStatement(expression) {
  return { type: 'ExpressionStatement', expression };
}

function source(name, value) {
  return {
    type: 'VariableDeclaration',
    kind: 'const',
    declarations: [
      {
        type: 'VariableDeclarator',
        id: identifier(name),
        init: call(member('Cell', 'source'), [literal(value)]),
      },
    ],
  };
}

function set(name, value) {
  return expressionStatement(
    call(member(name, 'set'), [
      value instanceof Object ? value : literal(value),
    ])
  );
}

function awaitCall(name = 'request') {
  return expressionStatement({
    type: 'AwaitExpression',
    argument: call(identifier(name)),
  });
}

function asyncOperation(name, body) {
  return {
    type: 'VariableDeclaration',
    kind: 'const',
    declarations: [
      {
        type: 'VariableDeclarator',
        id: identifier(name),
        init: {
          type: 'ArrowFunctionExpression',
          async: true,
          params: [],
          body: { type: 'BlockStatement', body },
        },
      },
    ],
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

function eventAttribute(name, expression) {
  return {
    type: 'JSXAttribute',
    name: { type: 'JSXIdentifier', name },
    value: { type: 'JSXExpressionContainer', expression },
  };
}

function onSetupCalling(name) {
  return expressionStatement(
    call(identifier('onSetup'), [
      {
        type: 'ArrowFunctionExpression',
        async: false,
        params: [],
        body: call(identifier(name)),
      },
    ])
  );
}

function component(body, returned = jsxElement('div'), name = 'App') {
  return {
    type: 'Program',
    body: [
      {
        type: 'FunctionDeclaration',
        async: false,
        id: identifier(name),
        params: [],
        body: {
          type: 'BlockStatement',
          body: [...body, { type: 'ReturnStatement', argument: returned }],
        },
      },
    ],
  };
}

function reportsFor(program) {
  const reports = [];
  const visitor = plugin.rules['no-manual-async-state'].createOnce({
    report(report) {
      reports.push(report);
    },
  });
  visitor.Program(program);
  return reports;
}

test('reports manual pending and error state as Cell.task work', () => {
  const reports = reportsFor(
    component(
      [
        source('busy', false),
        source('error', null),
        asyncOperation('submit', [
          set('busy', true),
          set('error', null),
          awaitCall('save'),
          set('busy', false),
          set('error', member('result', 'message')),
        ]),
      ],
      jsxElement('button', [eventAttribute('onClick', identifier('submit'))])
    )
  );

  assert.equal(reports.length, 1);
  assert.equal(reports[0].messageId, 'task');
  assert.equal(reports[0].data.operation, 'submit');
  assert.equal(reports[0].data.cells, '`busy`, `error`');
});

test('prefers derivedAsync for automatically triggered loaders with retries', () => {
  const reports = reportsFor(
    component(
      [
        source('status', 'idle'),
        source('error', null),
        asyncOperation('load', [
          set('status', 'loading'),
          set('error', null),
          awaitCall('fetchStory'),
          set('status', 'ready'),
          set('error', member('result', 'message')),
        ]),
        onSetupCalling('load'),
      ],
      jsxElement('button', [eventAttribute('onClick', identifier('load'))])
    )
  );

  assert.equal(reports.length, 1);
  assert.equal(reports[0].messageId, 'derivedAsync');
});

test('reports an unclassified operation with the generic alternative', () => {
  const reports = reportsFor(
    component([
      source('isSaving', false),
      asyncOperation('save', [
        set('isSaving', true),
        awaitCall('persist'),
        set('isSaving', false),
      ]),
    ])
  );

  assert.equal(reports.length, 1);
  assert.equal(reports[0].messageId, 'generic');
});

test('also analyzes non-JSX Retend model factories', () => {
  const reports = reportsFor(
    component(
      [
        source('consentBusy', false),
        asyncOperation('submitConsent', [
          set('consentBusy', true),
          awaitCall('saveConsent'),
          set('consentBusy', false),
        ]),
      ],
      { type: 'ObjectExpression', properties: [] },
      'createEditorModel'
    )
  );

  assert.equal(reports.length, 1);
  assert.equal(reports[0].messageId, 'generic');
});

test('finds lifecycle state around a later await', () => {
  const reports = reportsFor(
    component(
      [
        source('promptStatus', 'idle'),
        asyncOperation('loadNudge', [
          awaitCall('saveDraftFirst'),
          set('promptStatus', 'loading'),
          awaitCall('analyzeDraft'),
          set('promptStatus', 'idle'),
        ]),
      ],
      { type: 'ObjectExpression', properties: [] },
      'createEditorModel'
    )
  );

  assert.equal(reports.length, 1);
  assert.equal(reports[0].messageId, 'generic');
});

test('recognizes Cell.batch writes before the await', () => {
  const reports = reportsFor(
    component(
      [
        source('consentBusy', false),
        source('consentError', null),
        asyncOperation('submitConsent', [
          expressionStatement(
            call(member('Cell', 'batch'), [
              {
                type: 'ArrowFunctionExpression',
                async: false,
                params: [],
                body: {
                  type: 'BlockStatement',
                  body: [set('consentBusy', true), set('consentError', null)],
                },
              },
            ])
          ),
          awaitCall('updateAccount'),
          set('consentBusy', false),
          set('consentError', member('result', 'message')),
        ]),
      ],
      jsxElement('form', [
        eventAttribute('onSubmit--prevent', identifier('submitConsent')),
      ])
    )
  );

  assert.equal(reports.length, 1);
  assert.equal(reports[0].messageId, 'task');
  assert.equal(reports[0].data.cells, '`consentBusy`, `consentError`');
});

test('allows synchronous validation error state', () => {
  const reports = reportsFor(
    component(
      [
        source('error', null),
        asyncOperation('submit', [
          set('error', 'Enter a valid email.'),
          awaitCall('save'),
        ]),
      ],
      jsxElement('form', [eventAttribute('onSubmit', identifier('submit'))])
    )
  );

  assert.equal(reports.length, 0);
});

test('allows unrelated interaction state even when an async handler changes it', () => {
  const reports = reportsFor(
    component(
      [
        source('blurred', false),
        asyncOperation('checkField', [
          set('blurred', true),
          awaitCall('validateRemotely'),
          set('blurred', false),
        ]),
      ],
      jsxElement('input', [eventAttribute('onBlur', identifier('checkField'))])
    )
  );

  assert.equal(reports.length, 0);
});

test('reports error-only async bookkeeping when it is reset around the request', () => {
  const reports = reportsFor(
    component(
      [
        source('requestError', null),
        asyncOperation('refresh', [
          set('requestError', null),
          awaitCall('fetchAgain'),
          set('requestError', member('result', 'message')),
        ]),
      ],
      jsxElement('button', [eventAttribute('onClick', identifier('refresh'))])
    )
  );

  assert.equal(reports.length, 1);
  assert.equal(reports[0].messageId, 'task');
});
