function walkTree(root, visit) {
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
    let node = statement;

    if (
      statement.type === 'ExportDefaultDeclaration' ||
      statement.type === 'ExportNamedDeclaration'
    ) {
      if (!statement.declaration) {
        continue;
      }

      node = statement.declaration;
    }

    const candidates = [];

    if (node.type === 'FunctionDeclaration' && node.id?.name) {
      if (/^[A-Z]/u.test(node.id.name)) {
        candidates.push(node);
      }
    }

    if (node.type === 'VariableDeclaration') {
      for (const declaration of node.declarations) {
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

        candidates.push(declaration.init);
      }
    }

    for (const component of candidates) {
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
  }

  return components;
}

function getPropsDestructureStatement(component, propsName) {
  const firstStatement = component.body.body[0];
  if (!firstStatement) {
    return null;
  }

  if (firstStatement.type !== 'VariableDeclaration') {
    return null;
  }

  if (firstStatement.kind !== 'const') {
    return null;
  }

  const firstDeclaration = firstStatement.declarations[0];
  if (!firstDeclaration) {
    return null;
  }

  if (firstDeclaration.id.type !== 'ObjectPattern') {
    return null;
  }

  if (firstDeclaration.init?.type !== 'Identifier') {
    return null;
  }

  if (firstDeclaration.init.name !== propsName) {
    return null;
  }

  return firstStatement;
}

function isCellFactoryCall(node) {
  if (node.type !== 'CallExpression') {
    return false;
  }

  if (node.callee.type !== 'MemberExpression') {
    return false;
  }

  if (node.callee.computed) {
    return false;
  }

  if (node.callee.object.type !== 'Identifier') {
    return false;
  }

  if (node.callee.object.name !== 'Cell') {
    return false;
  }

  if (node.callee.property.type !== 'Identifier') {
    return false;
  }

  return (
    node.callee.property.name === 'source' ||
    node.callee.property.name === 'derived' ||
    node.callee.property.name === 'task'
  );
}

function getContainingFunction(node) {
  let parent = node.parent;

  while (parent) {
    if (
      parent.type === 'ArrowFunctionExpression' ||
      parent.type === 'FunctionExpression' ||
      parent.type === 'FunctionDeclaration'
    ) {
      return parent;
    }

    parent = parent.parent;
  }

  return null;
}

function isInsideFunction(node) {
  return getContainingFunction(node) !== null;
}

function isStaticStringLiteral(node) {
  if (node?.type !== 'Literal' && node?.type !== 'StringLiteral') {
    return false;
  }

  return typeof node.value === 'string';
}

function isNullLiteral(node) {
  return (
    (node?.type === 'Literal' || node?.type === 'NullLiteral') &&
    node.value === null
  );
}

function isRetendCellCall(node, propertyName) {
  if (node?.type !== 'CallExpression') {
    return false;
  }

  if (node.callee.type !== 'MemberExpression') {
    return false;
  }

  if (node.callee.computed) {
    return false;
  }

  if (node.callee.object.type !== 'Identifier') {
    return false;
  }

  if (node.callee.object.name !== 'Cell') {
    return false;
  }

  if (node.callee.property.type !== 'Identifier') {
    return false;
  }

  return node.callee.property.name === propertyName;
}

function isNamedCall(node, name) {
  return (
    node?.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    node.callee.name === name
  );
}

function unwrapExpression(node) {
  let current = node;

  while (
    current?.type === 'ParenthesizedExpression' ||
    current?.type === 'TSAsExpression' ||
    current?.type === 'TSTypeAssertion' ||
    current?.type === 'TSNonNullExpression'
  ) {
    current = current.expression;
  }

  return current;
}

function getReturnedExpressions(callback) {
  const expressions = [];

  if (!callback) {
    return expressions;
  }

  if (callback.body.type !== 'BlockStatement') {
    expressions.push(unwrapExpression(callback.body));
    return expressions;
  }

  walkOwnBody(callback.body, (current) => {
    if (current.type !== 'ReturnStatement') {
      return true;
    }

    if (current.argument) {
      expressions.push(unwrapExpression(current.argument));
    }

    return true;
  });

  return expressions;
}

function getJsxElementName(node) {
  if (node.type === 'JSXIdentifier') {
    return node.name;
  }

  if (node.type === 'JSXMemberExpression') {
    return getJsxElementName(node.property);
  }

  if (node.type === 'JSXNamespacedName') {
    return node.name.name;
  }

  return null;
}

function isJsxComponentElement(node) {
  if (node?.type !== 'JSXElement') {
    return false;
  }

  const name = getJsxElementName(node.openingElement.name);
  return Boolean(name && /^[A-Z]/u.test(name));
}

function isProviderElementName(node) {
  if (node.type === 'JSXIdentifier') {
    return node.name === 'Provider';
  }

  if (node.type === 'JSXMemberExpression') {
    return isProviderElementName(node.property);
  }

  return false;
}

function getJsxAttribute(node, name) {
  for (const attribute of node.openingElement.attributes) {
    if (attribute.type !== 'JSXAttribute') {
      continue;
    }

    if (attribute.name.type !== 'JSXIdentifier') {
      continue;
    }

    if (attribute.name.name === name) {
      return attribute;
    }
  }

  return null;
}

function getStaticStringFromAttribute(attribute) {
  if (!attribute) {
    return null;
  }

  if (isStaticStringLiteral(attribute.value)) {
    return attribute.value.value;
  }

  if (attribute.value?.type !== 'JSXExpressionContainer') {
    return null;
  }

  const expression = unwrapExpression(attribute.value.expression);
  if (!isStaticStringLiteral(expression)) {
    return null;
  }

  return expression.value;
}

function isInternalHref(value) {
  return value.startsWith('/') && !value.startsWith('//');
}

function isResourceCreatingNode(node) {
  if (node.type === 'NewExpression') {
    if (node.callee.type !== 'Identifier') {
      return false;
    }

    return (
      node.callee.name === 'ResizeObserver' ||
      node.callee.name === 'MutationObserver' ||
      node.callee.name === 'IntersectionObserver'
    );
  }

  if (node.type !== 'CallExpression') {
    return false;
  }

  if (node.callee.type === 'Identifier') {
    return (
      node.callee.name === 'setInterval' ||
      node.callee.name === 'requestAnimationFrame'
    );
  }

  if (node.callee.type !== 'MemberExpression') {
    return false;
  }

  if (node.callee.computed) {
    return false;
  }

  if (node.callee.property.type !== 'Identifier') {
    return false;
  }

  return (
    node.callee.property.name === 'addEventListener' ||
    node.callee.property.name === 'observe' ||
    node.callee.property.name === 'subscribe'
  );
}

function effectCallbackCreatesResource(callback) {
  let createsResource = false;
  const root =
    callback.body.type === 'BlockStatement' ? callback.body : callback.body;

  walkOwnBody(root, (current) => {
    if (isResourceCreatingNode(current)) {
      createsResource = true;
      return false;
    }

    return true;
  });

  return createsResource;
}

function effectCallbackReturnsCleanup(callback) {
  if (callback.body.type !== 'BlockStatement') {
    const expression = unwrapExpression(callback.body);
    return (
      expression?.type === 'ArrowFunctionExpression' ||
      expression?.type === 'FunctionExpression'
    );
  }

  let hasCleanup = false;

  walkOwnBody(callback.body, (current) => {
    if (current.type !== 'ReturnStatement') {
      return true;
    }

    const expression = unwrapExpression(current.argument);
    if (!expression) {
      return true;
    }

    if (
      expression.type === 'ArrowFunctionExpression' ||
      expression.type === 'FunctionExpression' ||
      expression.type === 'Identifier'
    ) {
      hasCleanup = true;
      return false;
    }

    return true;
  });

  return hasCleanup;
}

function findAnonymousJsxMarkup(expression) {
  const node = unwrapExpression(expression);

  if (!node) {
    return null;
  }

  if (node.type === 'JSXFragment') {
    return node;
  }

  if (node.type === 'JSXElement') {
    return isJsxComponentElement(node) ? null : node;
  }

  if (node.type === 'ConditionalExpression') {
    return (
      findAnonymousJsxMarkup(node.consequent) ??
      findAnonymousJsxMarkup(node.alternate)
    );
  }

  if (node.type === 'LogicalExpression') {
    return (
      findAnonymousJsxMarkup(node.left) ?? findAnonymousJsxMarkup(node.right)
    );
  }

  if (node.type === 'SequenceExpression') {
    for (const expression of node.expressions) {
      const anonymousJsx = findAnonymousJsxMarkup(expression);
      if (anonymousJsx) {
        return anonymousJsx;
      }
    }
  }

  if (node.type === 'ArrayExpression') {
    for (const element of node.elements) {
      const anonymousJsx = findAnonymousJsxMarkup(element);
      if (anonymousJsx) {
        return anonymousJsx;
      }
    }
  }

  return null;
}

function isSimpleHandlerExpression(expression) {
  const node = unwrapExpression(expression);

  if (!node) {
    return false;
  }

  if (
    node.type === 'CallExpression' ||
    node.type === 'AssignmentExpression' ||
    node.type === 'UpdateExpression' ||
    node.type === 'AwaitExpression'
  ) {
    return true;
  }

  if (node.type !== 'UnaryExpression') {
    return false;
  }

  return (
    node.operator === 'void' &&
    unwrapExpression(node.argument)?.type === 'CallExpression'
  );
}

function isSimpleInlineHandler(callback) {
  if (callback.body.type !== 'BlockStatement') {
    return isSimpleHandlerExpression(callback.body);
  }

  if (callback.body.body.length !== 1) {
    return false;
  }

  const statement = callback.body.body[0];
  return (
    statement.type === 'ExpressionStatement' &&
    isSimpleHandlerExpression(statement.expression)
  );
}

const noModuleCell = {
  meta: {
    docs: {
      description:
        'disallow Cell.source(), Cell.derived(), and Cell.task() at module scope',
    },
    schema: [],
    messages: {
      unexpected:
        'Cells should ideally be declared in the render path. To share access to a cell across multiple distant components, consider a wrapper provider and the scopes API.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isCellFactoryCall(node)) {
          return;
        }

        if (isInsideFunction(node)) {
          return;
        }

        context.report({ node: node.callee.property, messageId: 'unexpected' });
      },
    };
  },
};

const taskDefineAtComponentLevel = {
  meta: {
    docs: {
      description: 'require Cell.task() declarations at component level',
    },
    schema: [],
    messages: {
      unexpected:
        'Define Cell.task() in the component body, then call .runWith() inside handlers.',
    },
  },
  create(context) {
    return {
      Program(node) {
        for (const component of getTopLevelJsxComponents(node)) {
          walkTree(component.body, (current) => {
            if (!isCellFactoryCall(current)) {
              return true;
            }

            if (current.callee.property.name !== 'task') {
              return true;
            }

            if (getContainingFunction(current) === component) {
              return true;
            }

            context.report({
              node: current.callee.property,
              messageId: 'unexpected',
            });
            return false;
          });
        }
      },
    };
  },
};

const noModuleJsx = {
  meta: {
    docs: {
      description: 'disallow JSX at module level',
    },
    schema: [],
    messages: {
      unexpected: 'JSX must be declared within functions.',
    },
  },
  create(context) {
    return {
      JSXElement(node) {
        let parent = node.parent;
        while (parent) {
          if (
            parent.type === 'ArrowFunctionExpression' ||
            parent.type === 'FunctionExpression' ||
            parent.type === 'FunctionDeclaration'
          ) {
            return;
          }
          parent = parent.parent;
        }
        context.report({ node, messageId: 'unexpected' });
      },
      JSXFragment(node) {
        let parent = node.parent;
        while (parent) {
          if (
            parent.type === 'ArrowFunctionExpression' ||
            parent.type === 'FunctionExpression' ||
            parent.type === 'FunctionDeclaration'
          ) {
            return;
          }
          parent = parent.parent;
        }
        context.report({ node, messageId: 'unexpected' });
      },
    };
  },
};

const noInlineObjectType = {
  meta: {
    docs: {
      description: 'disallow inline object types',
    },
    schema: [],
    messages: {
      unexpected:
        'Use an interface or type statement instead of inline object type.',
    },
  },
  create(context) {
    const checkParam = (param) => {
      if (!param) {
        return;
      }

      if (
        param.type === 'Identifier' &&
        param.typeAnnotation?.type === 'TSTypeAnnotation' &&
        param.typeAnnotation.typeAnnotation?.type === 'TSTypeLiteral'
      ) {
        context.report({
          node: param.typeAnnotation.typeAnnotation,
          messageId: 'unexpected',
        });
        return;
      }

      if (param.type === 'AssignmentPattern') {
        checkParam(param.left);
      }
    };

    return {
      FunctionDeclaration(node) {
        for (const param of node.params) {
          checkParam(param);
        }
      },
      ArrowFunctionExpression(node) {
        for (const param of node.params) {
          checkParam(param);
        }
      },
      FunctionExpression(node) {
        for (const param of node.params) {
          checkParam(param);
        }
      },
      TSTypeLiteral(node) {
        let parent = node.parent;
        while (parent) {
          if (parent.type === 'TSTypeAliasDeclaration') {
            return;
          }

          parent = parent.parent;
        }

        if (node.parent?.type === 'TSTypeAnnotation') {
          const owner = node.parent.parent;
          if (
            owner?.type === 'Identifier' ||
            owner?.type === 'AssignmentPattern'
          ) {
            return;
          }
        }

        context.report({ node, messageId: 'unexpected' });
      },
    };
  },
};

const noClassName = {
  meta: {
    docs: {
      description: 'disallow className in Retend JSX',
    },
    schema: [],
    messages: {
      unexpected:
        'Use the `class` prop instead of `className`. Retend uses standard HTML attributes.',
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

const propsDestructureFirst = {
  meta: {
    docs: {
      description: 'require destructuring props as the first statement',
    },
    schema: [],
    messages: {
      destructure:
        'Destructure props as the first statement in the component. Use `const { x } = props` instead of `props.x`.',
      member:
        'Use destructured props (`const { x } = props`) instead of `props.x`.',
    },
  },
  create(context) {
    return {
      Program(node) {
        for (const component of getTopLevelJsxComponents(node)) {
          const propsParam = component.params[0];
          if (!propsParam) {
            continue;
          }

          if (propsParam.type === 'ObjectPattern') {
            context.report({ node: propsParam, messageId: 'destructure' });
            continue;
          }

          if (propsParam.type !== 'Identifier') {
            continue;
          }

          if (component.body.type !== 'BlockStatement') {
            context.report({ node: component.body, messageId: 'destructure' });
            continue;
          }

          const propsName = propsParam.name;
          const propsStatement = getPropsDestructureStatement(
            component,
            propsName
          );

          if (!propsStatement) {
            let reported = false;
            for (const statement of component.body.body) {
              walkOwnBody(statement, (current) => {
                if (current.type !== 'Identifier') {
                  return true;
                }

                if (current.name !== propsName) {
                  return true;
                }

                if (current.parent?.type === 'JSXSpreadAttribute') {
                  return true;
                }

                context.report({ node: current, messageId: 'destructure' });
                reported = true;
                return false;
              });

              if (reported) {
                break;
              }
            }

            continue;
          }

          for (const statement of component.body.body.slice(1)) {
            let reported = false;
            walkOwnBody(statement, (current) => {
              if (
                current.type === 'MemberExpression' &&
                current.object.type === 'Identifier' &&
                current.object.name === propsName
              ) {
                context.report({ node: current, messageId: 'member' });
                reported = true;
                return false;
              }

              if (
                current.type === 'JSXMemberExpression' &&
                current.object.type === 'JSXIdentifier' &&
                current.object.name === propsName
              ) {
                context.report({ node: current, messageId: 'member' });
                reported = true;
                return false;
              }

              return true;
            });

            if (reported) {
              return;
            }
          }
        }
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

function getStaticJsxStringValue(attribute) {
  if (
    attribute.value?.type === 'Literal' ||
    attribute.value?.type === 'StringLiteral'
  ) {
    return typeof attribute.value.value === 'string'
      ? attribute.value.value
      : null;
  }

  if (attribute.value?.type !== 'JSXExpressionContainer') {
    return null;
  }

  if (
    attribute.value.expression.type !== 'Literal' &&
    attribute.value.expression.type !== 'StringLiteral'
  ) {
    return null;
  }

  return typeof attribute.value.expression.value === 'string'
    ? attribute.value.expression.value
    : null;
}

function isValidTeleportSelector(selector) {
  return (
    /^#[A-Za-z][\w-]*$/u.test(selector) || /^[A-Za-z][\w-]*$/u.test(selector)
  );
}

const validTeleportSelector = {
  meta: {
    docs: {
      description: 'enforce selectors supported by Teleport',
    },
    schema: [],
    messages: {
      unexpected: 'Teleport only supports tag names and #id selectors.',
    },
  },
  create(context) {
    return {
      JSXElement(node) {
        const openingElement = node.openingElement;
        if (openingElement.name.type !== 'JSXIdentifier') {
          return;
        }

        if (openingElement.name.name !== 'Teleport') {
          return;
        }

        for (const attribute of openingElement.attributes) {
          if (attribute.type !== 'JSXAttribute') {
            continue;
          }

          if (attribute.name.type !== 'JSXIdentifier') {
            continue;
          }

          if (attribute.name.name !== 'to') {
            continue;
          }

          const selector = getStaticJsxStringValue(attribute);
          if (selector === null) {
            return;
          }

          if (isValidTeleportSelector(selector)) {
            return;
          }

          context.report({ node: attribute, messageId: 'unexpected' });
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
          if (
            parent.type === 'CallExpression' &&
            parent.callee.type === 'MemberExpression' &&
            !parent.callee.computed &&
            parent.callee.object.type === 'Identifier' &&
            parent.callee.object.name === 'Cell' &&
            parent.callee.property.type === 'Identifier'
          ) {
            if (parent.callee.property.name === 'derived') {
              return;
            }

            if (parent.callee.property.name === 'derivedAsync') {
              return;
            }
          }

          if (parent.type === 'JSXExpressionContainer') {
            context.report({
              node: node.callee.property,
              messageId: 'unexpected',
            });
            return;
          }

          parent = parent.parent;
        }
      },
    };
  },
};

const noDerivedInJsx = {
  meta: {
    docs: {
      description: 'disallow Cell.derived() in JSX expressions',
    },
    schema: [],
    messages: {
      unexpected:
        'Hoist `Cell.derived()` out of JSX into a variable in the parent scope.',
    },
  },
  create(context) {
    const reported = new WeakSet();

    const reportInlineDerived = (root) => {
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

        if (
          current.type === 'CallExpression' &&
          current.callee.type === 'MemberExpression' &&
          !current.callee.computed &&
          current.callee.object.type === 'Identifier' &&
          current.callee.object.name === 'Cell' &&
          current.callee.property.type === 'Identifier' &&
          current.callee.property.name === 'derived'
        ) {
          if (!reported.has(current)) {
            reported.add(current);
            context.report({
              node: current.callee.property,
              messageId: 'unexpected',
            });
          }
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
    };

    return {
      JSXExpressionContainer(node) {
        reportInlineDerived(node.expression);
      },
      ReturnStatement(node) {
        reportInlineDerived(node.argument);
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
      conditional:
        "Use `If` or `Switch` from 'retend' instead of ternary expressions in JSX.",
      logical:
        "Use `If` from 'retend' instead of logical operators (`&&`, `||`) in JSX.",
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

        if (node.expression.type === 'TemplateLiteral') {
          for (const expression of node.expression.expressions) {
            if (expression.type === 'ConditionalExpression') {
              context.report({ node: expression, messageId: 'conditional' });
            }

            if (
              expression.type === 'LogicalExpression' &&
              expression.operator !== '??'
            ) {
              context.report({ node: expression, messageId: 'logical' });
            }
          }
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
      unexpected: "Use `For` from 'retend' instead of `.map()` in JSX.",
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
        'Use Retend component order: props, Cell.source/Cell.task, Cell.derived, handlers, lifecycle, return.',
    },
  },
  create(context) {
    return {
      Program(node) {
        for (const component of getTopLevelJsxComponents(node)) {
          if (component.body.type !== 'BlockStatement') {
            continue;
          }

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
                    if (
                      declaration.init.callee.property.name === 'source' ||
                      declaration.init.callee.property.name === 'task'
                    ) {
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
      description: 'disallow JSX components longer than 100 lines',
    },
    schema: [],
    messages: {
      unexpected: 'Keep JSX components at 100 lines or fewer.',
    },
  },
  create(context) {
    return {
      Program(node) {
        for (const component of getTopLevelJsxComponents(node)) {
          if (!component.loc) {
            continue;
          }

          if (component.loc.end.line - component.loc.start.line + 1 <= 100) {
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
      unexpected:
        "Retend doesn't require React imports. Remove imports from 'react' or 'react-dom'.",
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

const preferBatchSet = {
  meta: {
    docs: {
      description: 'prefer Cell.batch() for sequential cell .set() calls',
    },
    schema: [],
    messages: {
      unexpected: 'Wrap sequential cell .set() calls in a Cell.batch() call.',
    },
  },
  create(context) {
    return {
      BlockStatement(node) {
        let parent = node.parent;
        while (parent) {
          const callee = parent.parent?.callee;
          const isBatchCall =
            callee?.type === 'Identifier'
              ? callee.name === 'batch'
              : callee?.type === 'MemberExpression' &&
                !callee.computed &&
                callee.object.type === 'Identifier' &&
                callee.object.name === 'Cell' &&
                callee.property.type === 'Identifier' &&
                callee.property.name === 'batch';

          if (isBatchCall) {
            if (parent.type === 'ArrowFunctionExpression') {
              return;
            }

            if (parent.type === 'FunctionExpression') {
              return;
            }
          }

          parent = parent.parent;
        }

        const cellNames = new Set();
        let scope = node;
        while (scope) {
          const body =
            scope.type === 'BlockStatement'
              ? scope.body
              : scope.type === 'Program'
                ? scope.body
                : null;

          if (body) {
            for (const scopeStatement of body) {
              if (scopeStatement.type !== 'VariableDeclaration') {
                continue;
              }

              for (const declaration of scopeStatement.declarations) {
                if (declaration.id.type !== 'Identifier') {
                  continue;
                }

                if (!declaration.init) {
                  continue;
                }

                if (!isCellFactoryCall(declaration.init)) {
                  continue;
                }

                cellNames.add(declaration.id.name);
              }
            }
          }

          scope = scope.parent;
        }

        let previousSet = false;
        let reportedRun = false;

        for (const statement of node.body) {
          const isSetCall =
            statement.type === 'ExpressionStatement' &&
            statement.expression.type === 'CallExpression' &&
            statement.expression.callee.type === 'MemberExpression' &&
            !statement.expression.callee.computed &&
            statement.expression.callee.object.type === 'Identifier' &&
            cellNames.has(statement.expression.callee.object.name) &&
            statement.expression.callee.property.type === 'Identifier' &&
            statement.expression.callee.property.name === 'set';

          if (!isSetCall) {
            previousSet = false;
            reportedRun = false;
            continue;
          }

          if (previousSet && !reportedRun) {
            context.report({
              node: statement.expression.callee.property,
              messageId: 'unexpected',
            });
            reportedRun = true;
          }

          previousSet = true;
        }
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

const noAnonymousForComponent = {
  meta: {
    docs: {
      description: 'require For callbacks to render named item components',
    },
    schema: [],
    messages: {
      unexpected:
        "Render a named component from `For()` instead of inline item markup. Use `For(items, (item) => <ItemRow item={item} />, { key: 'id' })`, then put the item's cells, handlers, lifecycle hooks, and JSX inside `ItemRow`.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isNamedCall(node, 'For')) {
          return;
        }

        const callback = node.arguments[1];
        if (callback?.type !== 'ArrowFunctionExpression') {
          if (callback?.type !== 'FunctionExpression') {
            return;
          }
        }

        const returnedExpressions = getReturnedExpressions(callback);
        for (const expression of returnedExpressions) {
          const anonymousJsx = findAnonymousJsxMarkup(expression);
          if (!anonymousJsx) {
            continue;
          }

          context.report({ node: anonymousJsx, messageId: 'unexpected' });
          return;
        }
      },
    };
  },
};

const noCellSetInDerived = {
  meta: {
    docs: {
      description: 'disallow cell writes inside Cell.derived()',
    },
    schema: [],
    messages: {
      unexpected:
        'Keep `Cell.derived()` pure. A derived cell should only read dependencies and return a value. Move this `.set()` call into an event handler, a task, or an explicit listener on the source cell that owns the write.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isRetendCellCall(node, 'derived')) {
          return;
        }

        const callback = node.arguments[0];
        if (callback?.type !== 'ArrowFunctionExpression') {
          if (callback?.type !== 'FunctionExpression') {
            return;
          }
        }

        walkOwnBody(callback.body, (current) => {
          if (current.type !== 'CallExpression') {
            return true;
          }

          if (current.callee.type !== 'MemberExpression') {
            return true;
          }

          if (current.callee.computed) {
            return true;
          }

          if (current.callee.property.type !== 'Identifier') {
            return true;
          }

          if (current.callee.property.name !== 'set') {
            return true;
          }

          context.report({
            node: current.callee.property,
            messageId: 'unexpected',
          });
          return false;
        });
      },
    };
  },
};

const requireEffectCleanup = {
  meta: {
    docs: {
      description:
        'require cleanup from effects that create external resources',
    },
    schema: [],
    messages: {
      unexpected:
        'This Retend lifecycle effect creates an external resource but does not return cleanup. Store the listener, interval, animation frame, observer, or subscription handle, then return a function that removes the listener, clears the handle, disconnects the observer, or unsubscribes. Cleanup is how Retend prevents leaked work after the component is destroyed.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isNamedCall(node, 'onSetup')) {
          if (!isNamedCall(node, 'onConnected')) {
            return;
          }
        }

        const callback = isNamedCall(node, 'onSetup')
          ? node.arguments[0]
          : node.arguments[1];
        if (callback?.type !== 'ArrowFunctionExpression') {
          if (callback?.type !== 'FunctionExpression') {
            return;
          }
        }

        if (!effectCallbackCreatesResource(callback)) {
          return;
        }

        if (effectCallbackReturnsCleanup(callback)) {
          return;
        }

        context.report({ node: callback, messageId: 'unexpected' });
      },
    };
  },
};

const preferOnconnectedForRefDomUse = {
  meta: {
    docs: {
      description: 'prefer onConnected() when setup code reads a DOM ref',
    },
    schema: [],
    messages: {
      unexpected:
        '`onSetup()` can run before a DOM ref has been connected, so this `.get()` can still be null. Use `onConnected(ref, (element) => { ... })` and read the element from the callback parameter instead of calling `ref.get()` during setup.',
    },
  },
  create(context) {
    return {
      Program(node) {
        for (const component of getTopLevelJsxComponents(node)) {
          if (component.body.type !== 'BlockStatement') {
            continue;
          }

          const refNames = new Set();
          for (const statement of component.body.body) {
            if (statement.type !== 'VariableDeclaration') {
              continue;
            }

            for (const declaration of statement.declarations) {
              if (declaration.id.type !== 'Identifier') {
                continue;
              }

              if (!isRetendCellCall(declaration.init, 'source')) {
                continue;
              }

              if (!isNullLiteral(declaration.init.arguments[0])) {
                continue;
              }

              refNames.add(declaration.id.name);
            }
          }

          if (refNames.size === 0) {
            continue;
          }

          walkTree(component.body, (current) => {
            if (!isNamedCall(current, 'onSetup')) {
              return true;
            }

            if (getContainingFunction(current) !== component) {
              return true;
            }

            const callback = current.arguments[0];
            if (callback?.type !== 'ArrowFunctionExpression') {
              if (callback?.type !== 'FunctionExpression') {
                return true;
              }
            }

            walkOwnBody(callback.body, (inner) => {
              if (inner.type !== 'CallExpression') {
                return true;
              }

              if (inner.callee.type !== 'MemberExpression') {
                return true;
              }

              if (inner.callee.computed) {
                return true;
              }

              if (inner.callee.object.type !== 'Identifier') {
                return true;
              }

              if (!refNames.has(inner.callee.object.name)) {
                return true;
              }

              if (inner.callee.property.type !== 'Identifier') {
                return true;
              }

              if (inner.callee.property.name !== 'get') {
                return true;
              }

              context.report({
                node: inner.callee.property,
                messageId: 'unexpected',
              });
              return false;
            });

            return true;
          });
        }
      },
    };
  },
};

const noRawRefCallback = {
  meta: {
    docs: {
      description: 'disallow callback refs in Retend JSX',
    },
    schema: [],
    messages: {
      unexpected:
        'Use a Retend ref cell instead of a callback ref. Declare `const elementRef = Cell.source<HTMLElement | null>(null)`, pass `ref={elementRef}`, and use `onConnected(elementRef, (element) => { ... })` for DOM work.',
    },
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (node.name.type !== 'JSXIdentifier') {
          return;
        }

        if (node.name.name !== 'ref') {
          return;
        }

        if (node.value?.type !== 'JSXExpressionContainer') {
          return;
        }

        const expression = unwrapExpression(node.value.expression);
        if (expression?.type !== 'ArrowFunctionExpression') {
          if (expression?.type !== 'FunctionExpression') {
            return;
          }
        }

        context.report({ node: expression, messageId: 'unexpected' });
      },
    };
  },
};

const requireScopeName = {
  meta: {
    docs: {
      description: 'require createScope() to receive a readable name',
    },
    schema: [],
    messages: {
      unexpected:
        "Pass a non-empty string name to `createScope()`, for example `createScope('Theme')`. Named scopes produce clearer missing-scope errors and make Retend HMR/debug output easier to understand.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isNamedCall(node, 'createScope')) {
          return;
        }

        const name = node.arguments[0];
        if (!isStaticStringLiteral(name)) {
          context.report({ node, messageId: 'unexpected' });
          return;
        }

        if (name.value.trim().length > 0) {
          return;
        }

        context.report({ node: name, messageId: 'unexpected' });
      },
    };
  },
};

const noProviderInlineObjectValue = {
  meta: {
    docs: {
      description: 'disallow inline object values on Retend scope providers',
    },
    schema: [],
    messages: {
      unexpected:
        'Do not pass an inline object to a scope Provider. Give the value a name first, for example `const themeScopeValue = { theme, setTheme }`, then pass `value={themeScopeValue}`. Named provider values make scope shape explicit and easier to review.',
    },
  },
  create(context) {
    return {
      JSXElement(node) {
        if (!isProviderElementName(node.openingElement.name)) {
          return;
        }

        const valueAttribute = getJsxAttribute(node, 'value');
        if (valueAttribute?.value?.type !== 'JSXExpressionContainer') {
          return;
        }

        const expression = unwrapExpression(valueAttribute.value.expression);
        if (expression?.type !== 'ObjectExpression') {
          return;
        }

        context.report({ node: expression, messageId: 'unexpected' });
      },
    };
  },
};

const preferLinkForInternalAnchor = {
  meta: {
    docs: {
      description: 'prefer router Link for internal anchors',
    },
    schema: [],
    messages: {
      unexpected:
        'Use `Link` from \'retend/router\' for internal navigation. Plain `<a href="/...">` asks the browser to navigate directly, while `<Link href="/...">` lets the Retend router handle route state, active links, navigation events, and history updates.',
    },
  },
  create(context) {
    return {
      JSXElement(node) {
        if (node.openingElement.name.type !== 'JSXIdentifier') {
          return;
        }

        if (node.openingElement.name.name !== 'a') {
          return;
        }

        const hrefAttribute = getJsxAttribute(node, 'href');
        const href = getStaticStringFromAttribute(hrefAttribute);
        if (href === null) {
          return;
        }

        if (!isInternalHref(href)) {
          return;
        }

        context.report({ node: hrefAttribute.name, messageId: 'unexpected' });
      },
    };
  },
};

const requireNamedHandlersForComplexJsxEvents = {
  meta: {
    docs: {
      description: 'require named handlers for complex JSX event logic',
    },
    schema: [],
    messages: {
      unexpected:
        'Move complex event logic into a named handler above the return statement. Inline handlers are only clear for one simple call or assignment, such as `onClick={() => open.set(false)}`. For multiple statements, branching, variables, awaits, or error handling, use `const handleClick = () => { ... }` and pass `onClick={handleClick}` so the event behavior has a name and can be reviewed separately from markup.',
    },
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (node.name.type !== 'JSXIdentifier') {
          return;
        }

        if (!/^on[A-Z]/u.test(node.name.name)) {
          return;
        }

        if (node.value?.type !== 'JSXExpressionContainer') {
          return;
        }

        const expression = unwrapExpression(node.value.expression);
        if (expression?.type !== 'ArrowFunctionExpression') {
          if (expression?.type !== 'FunctionExpression') {
            return;
          }
        }

        if (isSimpleInlineHandler(expression)) {
          return;
        }

        context.report({ node: expression, messageId: 'unexpected' });
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
    'no-anonymous-for-component': noAnonymousForComponent,
    'no-cell-set-in-derived': noCellSetInDerived,
    'no-classname': noClassName,
    'no-inline-object-type': noInlineObjectType,
    'no-module-cell': noModuleCell,
    'no-module-jsx': noModuleJsx,
    'task-define-at-component-level': taskDefineAtComponentLevel,
    'props-destructure-first': propsDestructureFirst,
    'no-templated-class': noTemplatedClass,
    'valid-teleport-selector': validTeleportSelector,
    'no-get-in-derived-async': noGetInDerivedAsync,
    'no-get-in-jsx': noGetInJsx,
    'no-derived-in-jsx': noDerivedInJsx,
    'no-jsx-control-flow': noJsxControlFlow,
    'no-jsx-map': noJsxMap,
    'no-listen-in-onsetup': noListenInOnSetup,
    'no-provider-inline-object-value': noProviderInlineObjectValue,
    'no-raw-ref-callback': noRawRefCallback,
    'no-react-imports': noReactImports,
    'prefer-batch-set': preferBatchSet,
    'prefer-link-for-internal-anchor': preferLinkForInternalAnchor,
    'prefer-onconnected-for-ref-dom-use': preferOnconnectedForRefDomUse,
    'prefer-router-navigation': preferRouterNavigation,
    'require-effect-cleanup': requireEffectCleanup,
    'require-named-handlers-for-complex-jsx-events':
      requireNamedHandlersForComplexJsxEvents,
    'require-scope-name': requireScopeName,
  },
};
