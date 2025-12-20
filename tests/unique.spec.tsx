import { describe, expect, it, vi } from 'vitest';
import { browserSetup, getTextContent, vDomSetup } from './setup';
import {
  Cell,
  If,
  runPendingSetupEffects,
  Switch,
  useSetupEffect,
  Unique,
  getActiveRenderer,
} from 'retend';
import type { VNode } from 'retend/v-dom';
import type { DOMRenderer } from 'retend-web';
import { ShadowRoot } from 'retend-web';

const runTests = () => {
  it('should render a <Unique/> component', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const uuid = crypto.randomUUID();

    const UniqueContent = () => {
      return <Unique name={uuid}>{() => <div>Unique Data</div>}</Unique>;
    };

    const doc = (
      <div>
        Hello world: <UniqueContent />
      </div>
    );

    const { body } = window.document;
    body.append(doc as Node & VNode);
    await runPendingSetupEffects();

    expect(getTextContent(body)).toBe('Hello world: Unique Data');
    body.replaceChildren();
  });

  it('should only render one <Unique/> component', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const uuid = crypto.randomUUID();

    const UniqueContent = () => {
      return <Unique name={uuid}>{() => <div>Unique Data</div>}</Unique>;
    };

    const doc = (
      <div>
        Hello world: <UniqueContent />
        Component 2?: <UniqueContent />
      </div>
    );

    const { body } = window.document;
    body.append(doc as Node & VNode);

    expect(getTextContent(body)).toBe('Hello world: Component 2?: Unique Data');
    body.replaceChildren();
  });
};

describe('Unique', () => {
  describe('Browser', () => {
    browserSetup();
    runTests();

    it('should move the <Unique/> component on change', async () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;
      const uuid = crypto.randomUUID();

      const UniqueContent = () => {
        return <Unique name={uuid}>{() => <div>Unique Data</div>}</Unique>;
      };

      const { body } = window.document;
      const show = Cell.source(false);
      const element = (
        <div>
          Showing content: {show}, <UniqueContent /> ||
          {If(show, UniqueContent)}
        </div>
      );

      body.append(element as any);
      await runPendingSetupEffects();

      expect(getTextContent(body)).toBe(
        'Showing content: false, Unique Data ||'
      );
      show.set(true);
      await runPendingSetupEffects();

      expect(getTextContent(body)).toBe(
        'Showing content: true,  ||Unique Data'
      );
      show.set(false);
      await runPendingSetupEffects();

      expect(getTextContent(body)).toBe(
        'Showing content: false, Unique Data ||'
      );
      body.replaceChildren();
    });

    it('should keep the scope of Unique components alive', async () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;
      const uuid = crypto.randomUUID();
      const setupFn = vi.fn();
      const cleanupFn = vi.fn();

      const MainVideoPlayer = () => {
        const MainContent = () => {
          useSetupEffect(() => {
            setupFn();
            return cleanupFn;
          });

          return (
            <>
              Playing video: <video src="https://example.com/video.mp4" />
            </>
          );
        };
        return <Unique name={uuid}>{() => <MainContent />}</Unique>;
      };

      const ListView = () => {
        return (
          <>
            List View: <MainVideoPlayer />
          </>
        );
      };

      const MainView = () => {
        return (
          <>
            Main View: <MainVideoPlayer />
          </>
        );
      };

      const view = Cell.source<'main' | 'list'>('main');
      const renderApp = Cell.source(true);
      const App = () => {
        return (
          <div>
            {If(renderApp, () => {
              return (
                <>
                  <h2>Welcome to app.</h2>
                  {Switch(view, {
                    main: MainView,
                    list: ListView,
                  })}
                </>
              );
            })}
          </div>
        );
      };

      const { body } = window.document;
      body.append((<App />) as any);
      await runPendingSetupEffects();

      expect(getTextContent(body)).toBe(
        'Welcome to app.Main View: Playing video: '
      );
      expect(setupFn).toHaveBeenCalledTimes(1);
      expect(cleanupFn).not.toHaveBeenCalled();

      view.set('list');
      await runPendingSetupEffects();

      expect(getTextContent(body)).toBe(
        'Welcome to app.List View: Playing video: '
      );
      expect(setupFn).toHaveBeenCalledTimes(1); // isnt called again.
      expect(cleanupFn).not.toHaveBeenCalled();

      view.set('main');
      await runPendingSetupEffects();

      expect(getTextContent(body)).toBe(
        'Welcome to app.Main View: Playing video: '
      );
      expect(setupFn).toHaveBeenCalledTimes(1); // isn't called again.
      expect(cleanupFn).not.toHaveBeenCalled();

      renderApp.set(false);
      await runPendingSetupEffects();

      expect(getTextContent(body)).toBe('');
      expect(setupFn).toHaveBeenCalledTimes(1); // isn't called again.
      expect(cleanupFn).toHaveBeenCalledTimes(1); // is called!
      body.replaceChildren();
    });

    it('should preserve Unique components that are reinstantiated in the very next render', async () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;
      const uuid = crypto.randomUUID();
      const setupFn = vi.fn();
      const cleanupFn = vi.fn();

      const UniqueComponent = () => {
        useSetupEffect(() => {
          setupFn();
          return cleanupFn;
        });
        return <div>[Unique Component]</div>;
      };

      const UniqueComponentWrapper = () => {
        return <Unique name={uuid}>{() => <UniqueComponent />}</Unique>;
      };

      const showFirstComponentInstance = Cell.source(false);
      const showSecondComponentInstance = Cell.source(false);

      const App = () => {
        return (
          <div>
            Unique Component Ctx:{' '}
            {If(showFirstComponentInstance, UniqueComponentWrapper)} Unique
            Component Ctx 2:{' '}
            {If(showSecondComponentInstance, UniqueComponentWrapper)}
          </div>
        );
      };

      const { body } = window.document;
      body.append((<App />) as any);

      expect(getTextContent(body)).toBe(
        'Unique Component Ctx:  Unique Component Ctx 2: '
      );

      showFirstComponentInstance.set(true);
      await runPendingSetupEffects();
      expect(getTextContent(body)).toBe(
        'Unique Component Ctx: [Unique Component] Unique Component Ctx 2: '
      );
      expect(setupFn).toHaveBeenCalledTimes(1);

      showSecondComponentInstance.set(true);
      await runPendingSetupEffects();
      expect(getTextContent(body)).toBe(
        'Unique Component Ctx:  Unique Component Ctx 2: [Unique Component]'
      );
      expect(setupFn).toHaveBeenCalledTimes(1);

      showSecondComponentInstance.set(false);
      await runPendingSetupEffects();
      expect(getTextContent(body)).toBe(
        'Unique Component Ctx: [Unique Component] Unique Component Ctx 2: '
      );
      expect(setupFn).toHaveBeenCalledTimes(1);

      showSecondComponentInstance.set(false);
      showFirstComponentInstance.set(false);
      await runPendingSetupEffects();

      expect(setupFn).toHaveBeenCalledTimes(1);
      expect(cleanupFn).toHaveBeenCalledTimes(1);

      showFirstComponentInstance.set(true);
      await runPendingSetupEffects();
      expect(setupFn).toHaveBeenCalledTimes(2);
      expect(cleanupFn).toHaveBeenCalledTimes(1);

      showFirstComponentInstance.set(false);
      showSecondComponentInstance.set(true);

      await runPendingSetupEffects();
      expect(setupFn).toHaveBeenCalledTimes(2);
      expect(cleanupFn).toHaveBeenCalledTimes(1);
      body.replaceChildren();
    });

    it('should save and restore data', async () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;
      const uuid = crypto.randomUUID();
      const saveFn = vi.fn();
      const restoreFn = vi.fn();
      const setupFn = vi.fn();

      const saveState = (el: HTMLElement) => {
        saveFn();
        return { name: 'John Doe' };
      };

      const restoreState = (el: HTMLElement, data: { name: string }) => {
        expect(data.name).toBe('John Doe');
        restoreFn();
      };

      const MusicPlayer = () => {
        useSetupEffect(() => {
          setupFn();
        });

        return (
          <>
            Music player:
            <audio src="music.mp3" controls />
          </>
        );
      };

      const PersistentMusicPlayer = () => {
        return (
          <Unique name={uuid} onSave={saveState} onRestore={restoreState}>
            {() => <MusicPlayer />}
          </Unique>
        );
      };

      const page = Cell.source<'home' | 'about'>('home');
      const App = () => {
        return (
          <div>
            {Switch(page, {
              home: () => (
                <div>
                  <h1>Home </h1>
                  <PersistentMusicPlayer />
                </div>
              ),
              about: () => (
                <div>
                  <h1>About </h1>
                  <PersistentMusicPlayer />
                </div>
              ),
            })}
          </div>
        );
      };

      const { body } = window.document;
      const app = <App />;
      body.append(app as any);
      await runPendingSetupEffects();
      expect(getTextContent(body)).toBe('Home Music player:');
      expect(setupFn).toHaveBeenCalledTimes(1);

      page.set('about');
      await runPendingSetupEffects();
      expect(saveFn).toHaveBeenCalledTimes(1);
      expect(restoreFn).toHaveBeenCalledTimes(1);
      expect(setupFn).toHaveBeenCalledTimes(1);
      body.replaceChildren();
    });

    it('should transfer shadowroots', async () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;
      const page = Cell.source<'home' | 'about'>('home');

      const PersistentMusicPlayer = () => {
        return (
          <Unique name="music-playerr">
            {() => (
              <ShadowRoot>
                <h2>Music player</h2>
              </ShadowRoot>
            )}
          </Unique>
        );
      };

      const App = () => {
        return (
          <div>
            {Switch(page, {
              home: () => (
                <div>
                  <h1>Home </h1>
                  <PersistentMusicPlayer />
                </div>
              ),
              about: () => (
                <div>
                  <h1>About </h1>
                  <PersistentMusicPlayer />
                </div>
              ),
            })}
          </div>
        );
      };

      const { body } = window.document;
      const app = <App />;
      body.append(app as any);
      await runPendingSetupEffects();
      expect(getTextContent(body)).toBe('Home ');
      const unique = body.querySelector('retend-unique-instance');
      expect(unique?.shadowRoot).toBeInstanceOf(window.ShadowRoot);

      page.set('about');
      const unique2 = body.querySelector('retend-unique-instance');
      expect(unique2?.shadowRoot).toBeInstanceOf(window.ShadowRoot);

      await runPendingSetupEffects();
      body.replaceChildren();
    });

    it('should set state to "new" when first rendered', async () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;
      const uuid = crypto.randomUUID();

      const UniqueContent = () => {
        return <Unique name={uuid}>{() => <div>Unique Data</div>}</Unique>;
      };

      const doc = (
        <div>
          Hello world: <UniqueContent />
        </div>
      );

      const { body } = window.document;
      body.append(doc as Node & VNode);
      await runPendingSetupEffects();

      const uniqueElement = body.querySelector('retend-unique-instance');
      expect(uniqueElement?.getAttribute('state')).toBe('new');
      body.replaceChildren();
    });

    it('should set state to "restored" when moved to new location', async () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;
      const uuid = crypto.randomUUID();

      const UniqueContent = () => {
        return <Unique name={uuid}>{() => <div>Unique Data</div>}</Unique>;
      };

      const { body } = window.document;
      const show = Cell.source(false);
      const element = (
        <div>
          Showing content: {show}, <UniqueContent /> ||
          {If(show, UniqueContent)}
        </div>
      );

      body.append(element as any);
      await runPendingSetupEffects();

      let uniqueElement = body.querySelector('retend-unique-instance');
      expect(uniqueElement?.getAttribute('state')).toBe('new');

      show.set(true);
      await runPendingSetupEffects();

      const uniqueElements = body.querySelectorAll('retend-unique-instance');
      // During transition, there might be multiple elements temporarily
      expect(uniqueElements.length).toBeGreaterThan(0);
      const states = Array.from(uniqueElements).map((el) =>
        el.getAttribute('state')
      );
      expect(states).toContain('restored');

      body.replaceChildren();
    });

    it('should set state to "moved" when component is unmounted', async () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;
      const uuid = crypto.randomUUID();
      const saveStates: string[] = [];

      const UniqueContent = () => {
        return (
          <Unique
            name={uuid}
            onSave={(el) => {
              saveStates.push(el.getAttribute('state') || '');
              return {};
            }}
          >
            {() => <div>Unique Data</div>}
          </Unique>
        );
      };

      const { body } = window.document;
      const show = Cell.source(true);
      const element = <div>{If(show, UniqueContent)}</div>;

      body.append(element as any);
      await runPendingSetupEffects();

      let uniqueElement = body.querySelector('retend-unique-instance');
      expect(uniqueElement?.getAttribute('state')).toBe('new');

      // Remove the component completely
      show.set(false);
      await runPendingSetupEffects();

      // Check that onSave was called and the state was 'moved'
      expect(saveStates).toContain('moved');

      // The element should be removed from DOM
      uniqueElement = body.querySelector('retend-unique-instance');
      expect(uniqueElement).toBeNull();

      body.replaceChildren();
    });

    it('should not cleanup derived cells and listeners when Unique component is moved, but should when unmounted', async () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;
      const uuid = crypto.randomUUID();
      let derivedComputes = 0;
      let listenerCalls = 0;
      const sourceCell = Cell.source(0);

      const Content = () => {
        const derived = Cell.derived(() => {
          derivedComputes++;
          return sourceCell.get() * 2;
        });
        sourceCell.listen(() => {
          listenerCalls++;
        });

        return <div>{derived}</div>;
      };

      const UniqueContent = () => (
        <Unique name={uuid}>{() => <Content />}</Unique>
      );

      const page = Cell.source<'home' | 'about'>('home');
      const renderApp = Cell.source(true);

      const App = () => (
        <div>
          {If(renderApp, () =>
            Switch(page, {
              home: () => (
                <div>
                  <h1>Home</h1>
                  <UniqueContent />
                </div>
              ),
              about: () => (
                <div>
                  <h1>About</h1>
                  <UniqueContent />
                </div>
              ),
            })
          )}
        </div>
      );

      const { body } = window.document;
      body.append((<App />) as any);
      await runPendingSetupEffects();

      // 1. Initial state
      expect(derivedComputes).toBe(1); // on initial render
      expect(listenerCalls).toBe(0);

      sourceCell.set(1);
      expect(derivedComputes).toBe(2);
      expect(listenerCalls).toBe(1);

      const computesBeforeMove = derivedComputes;
      const listenersBeforeMove = listenerCalls;

      // 2. Move the component
      page.set('about');
      await runPendingSetupEffects();

      // Check if effects are still active
      sourceCell.set(2);
      expect(derivedComputes).toBe(computesBeforeMove + 1);
      expect(listenerCalls).toBe(listenersBeforeMove + 1);

      const computesAfterMove = derivedComputes;
      const listenersAfterMove = listenerCalls;

      // 3. Unmount the component completely
      renderApp.set(false);
      await runPendingSetupEffects();

      // Check if effects are cleaned up
      sourceCell.set(3);
      expect(derivedComputes).toBe(computesAfterMove);
      expect(listenerCalls).toBe(listenersAfterMove);

      body.replaceChildren();
    });

    it('should transition through states correctly during lifecycle', async () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;
      const uuid = crypto.randomUUID();
      const states: string[] = [];
      const saveStates: string[] = [];

      const UniqueContent = () => {
        return (
          <Unique
            name={uuid}
            onSave={(el) => {
              saveStates.push(el.getAttribute('state') || '');
              return {};
            }}
          >
            {() => <div>Unique Data</div>}
          </Unique>
        );
      };

      const { body } = window.document;
      const showFirst = Cell.source(true);
      const showSecond = Cell.source(false);

      const element = (
        <div>
          First: {If(showFirst, UniqueContent)} || Second:{' '}
          {If(showSecond, UniqueContent)}
        </div>
      );

      body.append(element as any);
      await runPendingSetupEffects();

      let uniqueElement = body.querySelector('retend-unique-instance');
      expect(uniqueElement?.getAttribute('state')).toBe('new');
      states.push(uniqueElement?.getAttribute('state') || '');

      // Move to second position - should become 'restored'
      showFirst.set(false);
      showSecond.set(true);
      await runPendingSetupEffects();

      uniqueElement = body.querySelector('retend-unique-instance');
      expect(uniqueElement?.getAttribute('state')).toBe('restored');
      states.push(uniqueElement?.getAttribute('state') || '');

      // Move back to first position - should stay 'restored'
      showSecond.set(false);
      showFirst.set(true);
      await runPendingSetupEffects();

      uniqueElement = body.querySelector('retend-unique-instance');
      expect(uniqueElement?.getAttribute('state')).toBe('restored');
      states.push(uniqueElement?.getAttribute('state') || '');

      // Remove completely - should save with 'moved' state
      showFirst.set(false);
      await runPendingSetupEffects();

      expect(saveStates).toContain('moved');

      // Re-add - should be 'new' again since it was completely removed
      showFirst.set(true);
      await runPendingSetupEffects();

      uniqueElement = body.querySelector('retend-unique-instance');
      expect(uniqueElement?.getAttribute('state')).toBe('new');
      states.push(uniqueElement?.getAttribute('state') || '');

      // Verify the state transitions
      expect(states).toEqual(['new', 'restored', 'restored', 'new']);

      body.replaceChildren();
    });

    it('should preserve content even if new instance has different children function', async () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;
      const uuid = crypto.randomUUID();

      const { body } = window.document;
      const showFirst = Cell.source(true);

      const App = () => (
        <div>
          {If(
            showFirst,
            () => (
              <Unique name={uuid}>
                {() => <div id="orig">Original Content</div>}
              </Unique>
            ),
            () => (
              <Unique name={uuid}>
                {() => <div id="new">New Content</div>}
              </Unique>
            )
          )}
        </div>
      );

      body.append((<App />) as any);
      await runPendingSetupEffects();
      expect(body.querySelector('#orig')).not.toBeNull();
      expect(body.querySelector('#new')).toBeNull();

      showFirst.set(false);
      await runPendingSetupEffects();

      // Should still have original content because it's "Unique" by name
      expect(body.querySelector('#orig')).not.toBeNull();
      expect(body.querySelector('#new')).toBeNull();
      body.replaceChildren();
    });

    it('should preserve and update attributes on the Unique wrapper', async () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;
      const uuid = crypto.randomUUID();
      const className = Cell.source('initial-class');

      const { body } = window.document;
      const App = () => (
        <Unique name={uuid} class={className}>
          {() => <div>Content</div>}
        </Unique>
      );

      body.append((<App />) as any);
      await runPendingSetupEffects();

      let uniqueEl = body.querySelector('retend-unique-instance');
      expect(uniqueEl?.className).toBe('initial-class');

      className.set('updated-class');
      await runPendingSetupEffects();
      expect(uniqueEl?.className).toBe('updated-class');
      body.replaceChildren();
    });

    it('should handle nested Unique components', async () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;
      const outerUuid = crypto.randomUUID();
      const innerUuid = crypto.randomUUID();
      const innerSetup = vi.fn();

      const Inner = () => {
        useSetupEffect(() => {
          innerSetup();
        });
        return <div>Inner Content</div>;
      };

      const Outer = () => (
        <Unique name={outerUuid}>
          {() => (
            <div class="outer-box">
              <Unique name={innerUuid}>{() => <Inner />}</Unique>
            </div>
          )}
        </Unique>
      );

      const { body } = window.document;
      const show = Cell.source(true);
      body.append(
        (
          <div>
            {If(show, () => (
              <Outer />
            ))}
          </div>
        ) as any
      );
      await runPendingSetupEffects();

      expect(getTextContent(body)).toContain('Inner Content');
      expect(innerSetup).toHaveBeenCalledTimes(1);

      // Move it
      show.set(false);
      await runPendingSetupEffects();
      // It should still exist in memory but not in DOM
      expect(body.querySelector('.outer-box')).toBeNull();

      show.set(true);
      await runPendingSetupEffects();

      expect(getTextContent(body)).toContain('Inner Content');
      expect(innerSetup).toHaveBeenCalledTimes(2); // Should not re-run setup
      body.replaceChildren();
    });

    it('should dispose when not remounted before activate', async () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;
      const uuid = crypto.randomUUID();
      const cleanupFn = vi.fn();

      const Content = () => {
        useSetupEffect(() => {
          return cleanupFn;
        });
        return <div>Content</div>;
      };

      const { body } = window.document;
      const show = Cell.source(true);
      const app = (
        <div>
          {If(show, () => (
            <Unique name={uuid}>{() => <Content />}</Unique>
          ))}
        </div>
      );
      body.append(app as any);
      await runPendingSetupEffects();

      expect(cleanupFn).not.toHaveBeenCalled();

      show.set(false);
      await runPendingSetupEffects();

      // At this point, it should be in pending teardowns.
      // We need to trigger the activate event to process teardowns.
      body.dispatchEvent(
        new window.CustomEvent('retend:activate', { bubbles: true })
      );

      expect(cleanupFn).toHaveBeenCalledTimes(1);
      body.replaceChildren();
    });
  });

  describe('VDom', () => {
    vDomSetup();
    runTests();
  });
});
