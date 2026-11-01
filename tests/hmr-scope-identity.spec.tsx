import type { DOMRenderer } from 'retend-web';
import type { JSX } from 'retend/jsx-runtime';

import {
  Cell,
  If,
  MissingScopeError,
  __HMR_SYMBOLS,
  createScope,
  getActiveRenderer,
  useScopeContext,
} from 'retend';
import { hotReloadModule, withHMRBoundaries } from 'retend-web/plugins/hmr';
import { beforeEach, describe, expect, it } from 'vitest';

import { browserSetup } from './setup.tsx';

browserSetup();

type Scope = ReturnType<typeof createScope>;

const PAGE_FILE = '/tests/fixtures/user-page.tsx';
const LAYOUT_FILE = '/tests/fixtures/user-layout.tsx';
const OTHER_FILE = '/tests/fixtures/other-page.tsx';

const fileData = (fileName: string, lineNumber = 1) =>
  ({ fileName, lineNumber, columnNumber: 1 }) as JSX.JSXDevFileData;

const currentRenderer = () => getActiveRenderer() as DOMRenderer;

/** Renders `template` and puts the result in the document. */
const mount = (template: () => JSX.Template) => {
  const renderer = currentRenderer();
  const rendered = renderer.render(template);
  const nodes = Array.isArray(rendered) ? rendered : [rendered];
  renderer.host.document.body.append(...(nodes as Node[]));
  return renderer;
};

const bodyText = (renderer: DOMRenderer) =>
  renderer.host.document.body.textContent;

/**
 * A consumer living in a module that HMR does not re-execute: it keeps the
 * scope object it was created with, even after the scope's own module reloads.
 */
const consumerOf = (scope: Scope) =>
  function Consumer() {
    return <span>{String(useScopeContext(scope))}</span>;
  };

const pageOf = (
  scope: Scope,
  value: string,
  children: () => JSX.Template,
  fileName = PAGE_FILE,
  lineNumber = 1
) =>
  function Page() {
    return withHMRBoundaries(
      scope.Provider,
      [{ value, children }],
      fileData(fileName, lineNumber),
      currentRenderer()
    );
  };

beforeEach(() => {
  // The registry lives for the lifetime of the `retend` module, so start each
  // test from an empty one.
  __HMR_SYMBOLS.ScopeList.clear();
});

describe('scope identity across hot updates', () => {
  it('resolves the replacing instance for a consumer in an unchanged module', async () => {
    const renderer = currentRenderer();
    const userScope = createScope('User');
    const Consumer = consumerOf(userScope);
    const PageV1 = pageOf(userScope, 'alice', () => <Consumer />);

    mount(() => withHMRBoundaries(PageV1, [], fileData(PAGE_FILE), renderer));
    expect(bodyText(renderer)).toBe('alice');

    // Reloading the module that called `createScope` produces a new identity.
    const reloadedScope = createScope('User');
    const PageV2 = pageOf(reloadedScope, 'bob', () => <Consumer />);
    await hotReloadModule({ default: PageV2 }, { default: PageV1 });

    expect(bodyText(renderer)).toBe('bob');
  });

  it('resolves for a consumer that first renders after the update finished', async () => {
    const renderer = currentRenderer();
    const showConsumer = Cell.source(false);
    const userScope = createScope('User');
    const Consumer = consumerOf(userScope);
    const children = () => If(showConsumer, () => <Consumer />);
    const PageV1 = pageOf(userScope, 'alice', children);

    mount(() => withHMRBoundaries(PageV1, [], fileData(PAGE_FILE), renderer));
    expect(bodyText(renderer)).toBe('');

    const reloadedScope = createScope('User');
    const PageV2 = pageOf(reloadedScope, 'bob', children);
    await hotReloadModule({ default: PageV2 }, { default: PageV1 });

    // Mounting here must not depend on the update still being in flight.
    showConsumer.set(true);
    expect(bodyText(renderer)).toBe('bob');
  });

  it('keeps resolving across successive reloads of the scope module', async () => {
    const renderer = currentRenderer();
    const firstScope = createScope('User');
    const Consumer = consumerOf(firstScope);
    const PageV1 = pageOf(firstScope, 'v1', () => <Consumer />);

    mount(() => withHMRBoundaries(PageV1, [], fileData(PAGE_FILE), renderer));
    expect(bodyText(renderer)).toBe('v1');

    const secondScope = createScope('User');
    const PageV2 = pageOf(secondScope, 'v2', () => <Consumer />);
    await hotReloadModule({ default: PageV2 }, { default: PageV1 });
    expect(bodyText(renderer)).toBe('v2');

    const thirdScope = createScope('User');
    const PageV3 = pageOf(thirdScope, 'v3', () => <Consumer />);
    await hotReloadModule({ default: PageV3 }, { default: PageV2 });
    expect(bodyText(renderer)).toBe('v3');
  });

  it('keeps resolving after the boundary that registered the provider is re-rendered', async () => {
    const renderer = currentRenderer();
    const userScope = createScope('User');
    const Consumer = consumerOf(userScope);
    const LayoutV1 = pageOf(userScope, 'v1', () => <Consumer />, LAYOUT_FILE);
    const RootV1 = () =>
      withHMRBoundaries(LayoutV1, [], fileData(PAGE_FILE), renderer);

    mount(() => withHMRBoundaries(RootV1, [], fileData(PAGE_FILE), renderer));
    expect(bodyText(renderer)).toBe('v1');

    // A parent-level update disposes the nodes the provider rendered into.
    const RootV2 = () =>
      withHMRBoundaries(LayoutV1, [], fileData(PAGE_FILE), renderer);
    await hotReloadModule({ default: RootV2 }, { default: RootV1 });
    expect(bodyText(renderer)).toBe('v1');

    const reloadedScope = createScope('User');
    const LayoutV2 = pageOf(
      reloadedScope,
      'v2',
      () => <Consumer />,
      LAYOUT_FILE
    );
    await hotReloadModule({ default: LayoutV2 }, { default: LayoutV1 });

    expect(bodyText(renderer)).toBe('v2');
  });

  it('does not resolve across scopes that share a name but not a file', () => {
    const renderer = currentRenderer();
    const firstScope = createScope('User');
    const secondScope = createScope('User');
    const FirstConsumer = consumerOf(firstScope);

    // Register both scopes as providers of their own file first, so the
    // registry knows about each of them.
    const FirstPage = pageOf(
      firstScope,
      'first',
      () => <span>first</span>,
      PAGE_FILE
    );
    mount(() =>
      withHMRBoundaries(FirstPage, [], fileData(PAGE_FILE), renderer)
    );

    const SecondPage = pageOf(
      secondScope,
      'second',
      () => <span>second</span>,
      OTHER_FILE
    );
    mount(() =>
      withHMRBoundaries(SecondPage, [], fileData(OTHER_FILE), renderer)
    );

    // A consumer of the first scope, rendered under the second scope's
    // provider, must fail rather than silently read the sibling's value.
    const Mismatched = pageOf(
      secondScope,
      'second',
      () => <FirstConsumer />,
      OTHER_FILE
    );
    expect(() =>
      mount(() =>
        withHMRBoundaries(Mismatched, [], fileData(OTHER_FILE), renderer)
      )
    ).toThrow(MissingScopeError);
  });

  it('does not treat the only registered scope with a matching name as the requested scope', () => {
    const renderer = currentRenderer();
    const requestedScope = createScope('User');
    const otherScope = createScope('User');
    const Consumer = consumerOf(requestedScope);
    const Page = pageOf(otherScope, 'other', () => <Consumer />);

    expect(() =>
      mount(() => withHMRBoundaries(Page, [], fileData(PAGE_FILE), renderer))
    ).toThrow(MissingScopeError);
  });

  it('keeps two same-named scopes in the same file distinct', () => {
    const renderer = currentRenderer();
    const firstScope = createScope('User');
    const secondScope = createScope('User');
    const First = pageOf(
      firstScope,
      'first',
      () => <span>first</span>,
      PAGE_FILE,
      10
    );
    const Second = pageOf(
      secondScope,
      'second',
      () => <span>second</span>,
      PAGE_FILE,
      20
    );

    mount(() => withHMRBoundaries(First, [], fileData(PAGE_FILE), renderer));
    mount(() => withHMRBoundaries(Second, [], fileData(PAGE_FILE), renderer));

    const Consumer = consumerOf(firstScope);
    const Mismatched = pageOf(
      secondScope,
      'second',
      () => <Consumer />,
      PAGE_FILE,
      20
    );
    expect(() =>
      mount(() =>
        withHMRBoundaries(Mismatched, [], fileData(PAGE_FILE), renderer)
      )
    ).toThrow(MissingScopeError);
  });

  it('does not link scopes when a normal render switches providers at one call site', () => {
    const renderer = currentRenderer();
    const firstScope = createScope('User');
    const secondScope = createScope('User');
    const Consumer = consumerOf(firstScope);
    const First = pageOf(firstScope, 'first', () => <span>first</span>);
    mount(() => withHMRBoundaries(First, [], fileData(PAGE_FILE), renderer));

    const Second = pageOf(secondScope, 'second', () => <Consumer />);
    expect(() =>
      mount(() => withHMRBoundaries(Second, [], fileData(PAGE_FILE), renderer))
    ).toThrow(MissingScopeError);
  });

  it('does not link a differently named scope at the same call site during HMR', async () => {
    const renderer = currentRenderer();
    const firstScope = createScope('User');
    const otherScope = createScope('Theme');
    const Consumer = consumerOf(firstScope);
    const First = pageOf(firstScope, 'first', () => <span>first</span>);
    mount(() => withHMRBoundaries(First, [], fileData(PAGE_FILE), renderer));

    const Second = pageOf(otherScope, 'second', () => <span>second</span>);
    await hotReloadModule({ default: Second }, { default: First });
    expect(bodyText(renderer)).toBe('second');

    const Mismatched = pageOf(otherScope, 'second', () => <Consumer />);
    expect(() =>
      mount(() =>
        withHMRBoundaries(Mismatched, [], fileData(PAGE_FILE), renderer)
      )
    ).toThrow(MissingScopeError);
  });

  it('can replace one scope used as a provider from multiple files', async () => {
    const renderer = currentRenderer();
    const originalScope = createScope('User');
    const Consumer = consumerOf(originalScope);
    const First = pageOf(originalScope, 'first', () => <Consumer />, PAGE_FILE);
    const Second = pageOf(
      originalScope,
      'second',
      () => <Consumer />,
      OTHER_FILE
    );
    mount(() => withHMRBoundaries(First, [], fileData(PAGE_FILE), renderer));
    mount(() => withHMRBoundaries(Second, [], fileData(OTHER_FILE), renderer));
    expect(bodyText(renderer)).toBe('firstsecond');

    const replacementScope = createScope('User');
    const NextFirst = pageOf(
      replacementScope,
      'next',
      () => <Consumer />,
      PAGE_FILE
    );
    await hotReloadModule({ default: NextFirst }, { default: First });
    expect(bodyText(renderer)).toBe('nextsecond');
  });

  it('continues resolving after more than 32 successive replacements', async () => {
    const renderer = currentRenderer();
    const originalScope = createScope('User');
    const Consumer = consumerOf(originalScope);
    let Page = pageOf(originalScope, 'v0', () => <Consumer />);
    mount(() => withHMRBoundaries(Page, [], fileData(PAGE_FILE), renderer));

    for (let index = 1; index <= 40; index++) {
      const NextPage = pageOf(createScope('User'), `v${index}`, () => (
        <Consumer />
      ));
      await hotReloadModule({ default: NextPage }, { default: Page });
      Page = NextPage;
    }
    expect(bodyText(renderer)).toBe('v40');
  });

  it('does not loop forever on corrupt replacement links', () => {
    const firstScope = createScope('User');
    const secondScope = createScope('User');
    Reflect.set(firstScope, __HMR_SYMBOLS.OverwrittenBy, secondScope);
    Reflect.set(secondScope, __HMR_SYMBOLS.OverwrittenBy, firstScope);
    expect(() => useScopeContext(firstScope)).toThrow(MissingScopeError);
  });

  it('still throws when no provider is mounted', () => {
    const renderer = currentRenderer();
    const userScope = createScope('User');
    const Consumer = consumerOf(userScope);

    expect(() =>
      mount(() =>
        withHMRBoundaries(Consumer, [], fileData(PAGE_FILE), renderer)
      )
    ).toThrow(MissingScopeError);
  });
});
