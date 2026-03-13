function walkOwnBody(root, visit) {
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    if (Array.isArray(current)) {
      stack.push(...current);
      continue;
    }

    if (!(current instanceof Object)) {
      continue;
    }

    if (current !== root) {
      if (current.type === 'ArrowFunctionExpression') {
        continue;
      }

      if (current.type === 'FunctionExpression') {
        continue;
      }

      if (current.type === 'FunctionDeclaration') {
        continue;
      }
    }

    if (visit(current) === false) {
      return;
    }

    for (const [key, value] of Object.entries(current)) {
      if (key === 'parent') {
        continue;
      }

      if (value instanceof Object) {
        stack.push(value);
      }
    }
  }
}

function getTopLevelJsxComponents(program) {
  const components = [];

  for (const statement of program.body) {
    let component = null;

    if (
      statement.type === 'FunctionDeclaration' &&
      statement.id?.name &&
      /^[A-Z]/u.test(statement.id.name)
    ) {
      component = statement;
    }

    if (statement.type === 'VariableDeclaration') {
      for (const declaration of statement.declarations) {
        if (declaration.id.type !== 'Identifier') {
          continue;
        }

        if (!/^[A-Z]/u.test(declaration.id.name)) {
          continue;
        }

        if (declaration.init?.type !== 'ArrowFunctionExpression') {
          if (declaration.init?.type !== 'FunctionExpression') {
            continue;
          }
        }

        component = declaration.init;
      }
    }

    if (!component) {
      continue;
    }

    if (component.body.type !== 'BlockStatement') {
      continue;
    }

    let containsJsx = false;
    walkOwnBody(component.body, (current) => {
      if (current.type === 'JSXElement') {
        containsJsx = true;
        return false;
      }

      if (current.type === 'JSXFragment') {
        containsJsx = true;
        return false;
      }

      return true;
    });

    if (!containsJsx) {
      continue;
    }

    components.push(component);
  }

  return components;
}

const noClassName = {
  meta: {
    docs: {
      description: 'disallow className in Retend JSX',
    },
    schema: [],
    messages: {
      unexpected: 'Use the class prop in Retend JSX instead of className.',
    },
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (node.name.type !== 'JSXIdentifier') {
          return;
        }

        if (node.name.name !== 'className') {
          return;
        }

        context.report({ node: node.name, messageId: 'unexpected' });
      },
    };
  },
};

const noTemplatedClass = {
  meta: {
    docs: {
      description: 'disallow templated class values in Retend JSX',
    },
    schema: [],
    messages: {
      unexpected:
        'Use array or object syntax for dynamic class values in Retend JSX.',
    },
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (node.name.type !== 'JSXIdentifier') {
          return;
        }

        if (node.name.name !== 'class') {
          return;
        }

        if (node.value?.type !== 'JSXExpressionContainer') {
          return;
        }

        let reported = false;
        walkOwnBody(node.value.expression, (current) => {
          if (
            current.type === 'TemplateLiteral' &&
            current.expressions.length > 0
          ) {
            context.report({ node: current, messageId: 'unexpected' });
            reported = true;
            return false;
          }

          if (current.type === 'BinaryExpression' && current.operator === '+') {
            context.report({ node: current, messageId: 'unexpected' });
            reported = true;
            return false;
          }

          if (
            current.type === 'CallExpression' &&
            current.callee.type === 'MemberExpression' &&
            !current.callee.computed &&
            current.callee.property.type === 'Identifier' &&
            current.callee.property.name === 'join'
          ) {
            context.report({
              node: current.callee.property,
              messageId: 'unexpected',
            });
            reported = true;
            return false;
          }

          return true;
        });

        if (reported) {
          return;
        }
      },
    };
  },
};

const noGetInJsx = {
  meta: {
    docs: {
      description: 'disallow .get() in JSX expressions',
    },
    schema: [],
    messages: {
      unexpected:
        'Calling .get() in JSX returns a static snapshot. Pass the Cell directly.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type !== 'MemberExpression') {
          return;
        }

        if (node.callee.computed) {
          return;
        }

        if (node.callee.property.type !== 'Identifier') {
          return;
        }

        if (node.callee.property.name !== 'get') {
          return;
        }

        let parent = node.parent;
        while (parent) {
          if (parent.type === 'JSXExpressionContainer') {
            context.report({
              node: node.callee.property,
              messageId: 'unexpected',
            });
            return;
          }

          if (parent.type === 'ArrowFunctionExpression') {
            return;
          }

          if (parent.type === 'FunctionDeclaration') {
            return;
          }

          if (parent.type === 'FunctionExpression') {
            return;
          }

          parent = parent.parent;
        }
      },
    };
  },
};

const noJsxControlFlow = {
  meta: {
    docs: {
      description:
        'disallow ternaries and logical operators in JSX expressions',
    },
    schema: [],
    messages: {
      conditional: 'Use If or Switch instead of ternaries in Retend JSX.',
      logical: 'Use If instead of logical operators in Retend JSX.',
    },
  },
  create(context) {
    return {
      JSXExpressionContainer(node) {
        if (node.expression.type === 'ConditionalExpression') {
          context.report({ node: node.expression, messageId: 'conditional' });
        }

        if (
          node.expression.type === 'LogicalExpression' &&
          node.expression.operator !== '??'
        ) {
          context.report({ node: node.expression, messageId: 'logical' });
        }
      },
    };
  },
};

const noJsxMap = {
  meta: {
    docs: {
      description: 'disallow .map() in JSX expressions',
    },
    schema: [],
    messages: {
      unexpected: 'Use For instead of .map() in Retend JSX.',
    },
  },
  create(context) {
    return {
      JSXExpressionContainer(node) {
        if (node.expression.type !== 'CallExpression') {
          return;
        }

        if (node.expression.callee.type !== 'MemberExpression') {
          return;
        }

        if (node.expression.callee.computed) {
          return;
        }

        if (node.expression.callee.property.type !== 'Identifier') {
          return;
        }

        if (node.expression.callee.property.name !== 'map') {
          return;
        }

        context.report({
          node: node.expression.callee.property,
          messageId: 'unexpected',
        });
      },
    };
  },
};

const componentStatementOrder = {
  meta: {
    docs: {
      description: 'enforce Retend component statement order',
    },
    schema: [],
    messages: {
      unexpected:
        'Use Retend component order: props, Cell.source, Cell.derived, handlers, lifecycle, return.',
    },
  },
  create(context) {
    return {
      Program(node) {
        for (const component of getTopLevelJsxComponents(node)) {
          let lastOrder = -1;

          for (const bodyStatement of component.body.body) {
            let order = -1;

            if (bodyStatement.type === 'VariableDeclaration') {
              for (const declaration of bodyStatement.declarations) {
                if (
                  declaration.id.type === 'ObjectPattern' &&
                  declaration.init?.type === 'Identifier' &&
                  declaration.init.name === 'props'
                ) {
                  order = 0;
                }

                if (declaration.init?.type === 'CallExpression') {
                  if (
                    declaration.init.callee.type === 'MemberExpression' &&
                    !declaration.init.callee.computed &&
                    declaration.init.callee.object.type === 'Identifier' &&
                    declaration.init.callee.object.name === 'Cell' &&
                    declaration.init.callee.property.type === 'Identifier'
                  ) {
                    if (declaration.init.callee.property.name === 'source') {
                      order = 1;
                    }

                    if (declaration.init.callee.property.name === 'derived') {
                      order = 2;
                    }

                    if (
                      declaration.init.callee.property.name === 'derivedAsync'
                    ) {
                      order = 2;
                    }
                  }
                }

                if (declaration.init?.type === 'ArrowFunctionExpression') {
                  order = 3;
                }

                if (declaration.init?.type === 'FunctionExpression') {
                  order = 3;
                }

                if (order !== -1 && order < lastOrder) {
                  context.report({
                    node: declaration,
                    messageId: 'unexpected',
                  });
                  return;
                }

                if (order > lastOrder) {
                  lastOrder = order;
                }
              }

              continue;
            }

            if (
              bodyStatement.type === 'ExpressionStatement' &&
              bodyStatement.expression.type === 'CallExpression'
            ) {
              if (
                bodyStatement.expression.callee.type === 'Identifier' &&
                bodyStatement.expression.callee.name === 'onSetup'
              ) {
                order = 4;
              }

              if (
                bodyStatement.expression.callee.type === 'Identifier' &&
                bodyStatement.expression.callee.name === 'onConnected'
              ) {
                order = 4;
              }

              if (
                bodyStatement.expression.callee.type === 'MemberExpression' &&
                !bodyStatement.expression.callee.computed &&
                bodyStatement.expression.callee.property.type ===
                  'Identifier' &&
                bodyStatement.expression.callee.property.name === 'listen'
              ) {
                order = 4;
              }
            }

            if (bodyStatement.type === 'ReturnStatement') {
              order = 5;
            }

            if (order !== -1 && order < lastOrder) {
              context.report({ node: bodyStatement, messageId: 'unexpected' });
              return;
            }

            if (order > lastOrder) {
              lastOrder = order;
            }
          }
        }
      },
    };
  },
};

const maxComponentLines = {
  meta: {
    docs: {
      description: 'disallow JSX components longer than 150 lines',
    },
    schema: [],
    messages: {
      unexpected: 'Keep JSX components at 150 lines or fewer.',
    },
  },
  create(context) {
    return {
      Program(node) {
        for (const component of getTopLevelJsxComponents(node)) {
          if (!component.loc) {
            continue;
          }

          if (component.loc.end.line - component.loc.start.line + 1 <= 150) {
            continue;
          }

          context.report({ node: component, messageId: 'unexpected' });
        }
      },
    };
  },
};

const maxJsxComponentsPerFile = {
  meta: {
    docs: {
      description: 'disallow more than 2 JSX components per file',
    },
    schema: [],
    messages: {
      unexpected: 'Keep files to at most 2 top-level JSX components.',
    },
  },
  create(context) {
    return {
      Program(node) {
        const components = getTopLevelJsxComponents(node);

        if (components.length <= 2) {
          return;
        }

        for (const component of components.slice(2)) {
          context.report({ node: component, messageId: 'unexpected' });
        }
      },
    };
  },
};

const noGetInDerivedAsync = {
  meta: {
    docs: {
      description: 'disallow .get() inside Cell.derivedAsync()',
    },
    schema: [],
    messages: {
      unexpected:
        'Use the get parameter inside Cell.derivedAsync() to track dependencies.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type !== 'MemberExpression') {
          return;
        }

        if (node.callee.computed) {
          return;
        }

        if (node.callee.object.type !== 'Identifier') {
          return;
        }

        if (node.callee.object.name !== 'Cell') {
          return;
        }

        if (node.callee.property.type !== 'Identifier') {
          return;
        }

        if (node.callee.property.name !== 'derivedAsync') {
          return;
        }

        const callback = node.arguments[0];
        if (callback?.type !== 'ArrowFunctionExpression') {
          if (callback?.type !== 'FunctionExpression') {
            return;
          }
        }

        walkOwnBody(callback.body, (current) => {
          if (
            current.type === 'CallExpression' &&
            current.callee.type === 'MemberExpression' &&
            !current.callee.computed &&
            current.callee.property.type === 'Identifier' &&
            current.callee.property.name === 'get'
          ) {
            context.report({
              node: current.callee.property,
              messageId: 'unexpected',
            });
            return false;
          }

          return true;
        });
      },
    };
  },
};

const noReactImports = {
  meta: {
    docs: {
      description: 'disallow React imports in Retend projects',
    },
    schema: [],
    messages: {
      unexpected: 'Do not import from react or react-dom in Retend projects.',
    },
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        if (node.source.value !== 'react') {
          if (node.source.value !== 'react-dom') {
            return;
          }
        }

        context.report({ node: node.source, messageId: 'unexpected' });
      },
    };
  },
};

const noListenInOnSetup = {
  meta: {
    docs: {
      description: 'disallow .listen() inside onSetup()',
    },
    schema: [],
    messages: {
      unexpected:
        'Call .listen() directly in the component body instead of wrapping it in onSetup().',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type !== 'Identifier') {
          return;
        }

        if (node.callee.name !== 'onSetup') {
          return;
        }

        const callback = node.arguments[0];
        if (callback?.type !== 'ArrowFunctionExpression') {
          if (callback?.type !== 'FunctionExpression') {
            return;
          }
        }

        walkOwnBody(callback.body, (current) => {
          if (
            current.type === 'CallExpression' &&
            current.callee.type === 'MemberExpression' &&
            !current.callee.computed &&
            current.callee.property.type === 'Identifier' &&
            current.callee.property.name === 'listen'
          ) {
            context.report({
              node: current.callee.property,
              messageId: 'unexpected',
            });
            return false;
          }

          return true;
        });
      },
    };
  },
};

const preferRouterNavigation = {
  meta: {
    docs: {
      description: 'prefer router navigation over window.location or history',
    },
    schema: [],
    messages: {
      unexpected:
        'Use router.navigate() or Link for internal navigation instead of window.location or window.history.',
    },
  },
  create(context) {
    return {
      AssignmentExpression(node) {
        if (node.left.type !== 'MemberExpression') {
          return;
        }

        if (node.left.object.type !== 'MemberExpression') {
          return;
        }

        if (node.left.object.object.type !== 'Identifier') {
          return;
        }

        if (node.left.object.object.name !== 'window') {
          return;
        }

        if (node.left.object.property.type !== 'Identifier') {
          return;
        }

        if (node.left.object.property.name !== 'location') {
          return;
        }

        if (node.left.property.type !== 'Identifier') {
          return;
        }

        if (node.left.property.name !== 'href') {
          return;
        }

        if (node.right.type !== 'Literal') {
          return;
        }

        if (!node.right.raw.startsWith("'/")) {
          if (!node.right.raw.startsWith('"/')) {
            return;
          }
        }

        if (node.right.raw.startsWith("'//")) {
          return;
        }

        if (node.right.raw.startsWith('"//')) {
          return;
        }

        context.report({ node: node.left.property, messageId: 'unexpected' });
      },
      CallExpression(node) {
        if (node.callee.type !== 'MemberExpression') {
          return;
        }

        if (node.callee.object.type !== 'MemberExpression') {
          return;
        }

        if (node.callee.object.object.type !== 'Identifier') {
          return;
        }

        if (node.callee.object.object.name !== 'window') {
          return;
        }

        if (node.callee.object.property.type !== 'Identifier') {
          return;
        }

        if (
          node.callee.object.property.name === 'location' &&
          node.callee.property.type === 'Identifier' &&
          node.arguments[0]?.type === 'Literal'
        ) {
          if (
            node.callee.property.name !== 'assign' &&
            node.callee.property.name !== 'replace'
          ) {
            return;
          }

          if (!node.arguments[0].raw.startsWith("'/")) {
            if (!node.arguments[0].raw.startsWith('"/')) {
              return;
            }
          }

          if (node.arguments[0].raw.startsWith("'//")) {
            return;
          }

          if (node.arguments[0].raw.startsWith('"//')) {
            return;
          }

          context.report({
            node: node.callee.property,
            messageId: 'unexpected',
          });
          return;
        }

        if (
          node.callee.object.property.name === 'history' &&
          node.callee.property.type === 'Identifier' &&
          node.arguments[2]?.type === 'Literal'
        ) {
          if (
            node.callee.property.name !== 'pushState' &&
            node.callee.property.name !== 'replaceState'
          ) {
            return;
          }

          if (!node.arguments[2].raw.startsWith("'/")) {
            if (!node.arguments[2].raw.startsWith('"/')) {
              return;
            }
          }

          if (node.arguments[2].raw.startsWith("'//")) {
            return;
          }

          if (node.arguments[2].raw.startsWith('"//')) {
            return;
          }

          context.report({
            node: node.callee.property,
            messageId: 'unexpected',
          });
        }
      },
    };
  },
};

export default {
  meta: {
    name: 'retend',
  },
  rules: {
    'component-statement-order': componentStatementOrder,
    'max-component-lines': maxComponentLines,
    'max-jsx-components-per-file': maxJsxComponentsPerFile,
    'no-classname': noClassName,
    'no-templated-class': noTemplatedClass,
    'no-get-in-derived-async': noGetInDerivedAsync,
    'no-get-in-jsx': noGetInJsx,
    'no-jsx-control-flow': noJsxControlFlow,
    'no-jsx-map': noJsxMap,
    'no-listen-in-onsetup': noListenInOnSetup,
    'no-react-imports': noReactImports,
    'prefer-router-navigation': preferRouterNavigation,
  },
};
