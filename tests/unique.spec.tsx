import { describe, expect, it, vi } from 'vitest';
import { browserSetup, getTextContent, vDomSetup } from './setup';
import {
  Cell,
  If,
  runPendingSetupEffects,
  Switch,
  useSetupEffect,
  createUnique,
  getActiveRenderer,
} from 'retend';
import type { VNode } from 'retend-server/v-dom';
import type { DOMRenderer } from 'retend-web';
import { ShadowRoot } from 'retend-web';

const runTests = () => {
  it('should render a Unique component', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const uuid = crypto.randomUUID();

    const UniqueContent = createUnique(() => {
      return <div>Unique Data</div>;
    });

    const doc = (
      <div>
        Hello world: <UniqueContent id={uuid} />
      </div>
    );

    const { body } = window.document;
    body.append(doc as Node & VNode);
    await runPendingSetupEffects();

    expect(getTextContent(body)).toBe('Hello world: Unique Data');
    body.replaceChildren();
  });

  it('should only render one Unique component', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const uuid = crypto.randomUUID();

    const UniqueContent = createUnique(() => {
      return <div>Unique Data</div>;
    });

    const doc = (
      <div>
        Hello world: <UniqueContent id={uuid} />
        Component 2?: <UniqueContent id={uuid} />
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

    it('should move the Unique component on change', async () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;
      const uuid = crypto.randomUUID();

      const UniqueContent = createUnique(() => {
        return <div>Unique Data</div>;
      });

      const { body } = window.document;
      const show = Cell.source(false);
      const element = (
        <div>
          Showing content: {show}, <UniqueContent id={uuid} /> ||
          {If(show, () => (
            <UniqueContent id={uuid} />
          ))}
        </div>
      ) as unknown as Node;

      body.append(element);
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

      const MainVideoPlayer = createUnique(() => {
        useSetupEffect(() => {
          setupFn();
          return cleanupFn;
        });

        return (
          <>
            Playing video:{' '}
            <video src="https://example.com/video.mp4">
              <track kind="captions" />
            </video>
          </>
        );
      });

      const ListView = () => {
        return (
          <>
            List View: <MainVideoPlayer id={uuid} />
          </>
        );
      };

      const MainView = () => {
        return (
          <>
            Main View: <MainVideoPlayer id={uuid} />
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
      body.append((<App />) as unknown as Element);
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

      const UniqueComponent = createUnique(() => {
        useSetupEffect(() => {
          setupFn();
          return cleanupFn;
        });
        return <div>[Unique Component]</div>;
      });

      const showFirstComponentInstance = Cell.source(false);
      const showSecondComponentInstance = Cell.source(false);

      const App = () => {
        return (
          <div>
            Unique Component Ctx:{' '}
            {If(showFirstComponentInstance, () => (
              <UniqueComponent id={uuid} />
            ))}{' '}
            Unique Component Ctx 2:{' '}
            {If(showSecondComponentInstance, () => (
              <UniqueComponent id={uuid} />
            ))}
          </div>
        );
      };

      const { body } = window.document;
      body.append((<App />) as unknown as Node);

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

      const PersistentMusicPlayer = createUnique(
        () => {
          useSetupEffect(() => {
            setupFn();
          });

          return (
            <>
              Music player:
              <audio src="music.mp3" controls>
                <track kind="captions" src="captions.vtt" />
              </audio>
            </>
          );
        },
        { onSave: saveState, onRestore: restoreState }
      );

      const page = Cell.source<'home' | 'about'>('home');
      const App = () => {
        return (
          <div>
            {Switch(page, {
              home: () => (
                <div>
                  <h1>Home </h1>
                  <PersistentMusicPlayer id={uuid} />
                </div>
              ),
              about: () => (
                <div>
                  <h1>About </h1>
                  <PersistentMusicPlayer id={uuid} />
                </div>
              ),
            })}
          </div>
        );
      };

      const { body } = window.document;
      const app = <App />;
      body.append(app as unknown as HTMLElement);
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

      const PersistentMusicPlayer = createUnique(() => {
        return (
          <ShadowRoot>
            <h2>Music player</h2>
          </ShadowRoot>
        );
      });

      const App = () => {
        return (
          <div>
            {Switch(page, {
              home: () => (
                <div>
                  <h1>Home </h1>
                  <PersistentMusicPlayer id="music-player" />
                </div>
              ),
              about: () => (
                <div>
                  <h1>About </h1>
                  <PersistentMusicPlayer id="music-player" />
                </div>
              ),
            })}
          </div>
        );
      };

      const { body } = window.document;
      const app = <App />;
      body.append(app as unknown as Element);
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

      const UniqueContent = createUnique(() => {
        return <div>Unique Data</div>;
      });

      const doc = (
        <div>
          Hello world: <UniqueContent id={uuid} />
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

      const UniqueContent = createUnique(() => {
        return <div>Unique Data</div>;
      });

      const { body } = window.document;
      const show = Cell.source(false);
      const element = (
        <div>
          Showing content: {show}, <UniqueContent id={uuid} /> ||
          {If(show, () => (
            <UniqueContent id={uuid} />
          ))}
        </div>
      );

      body.append(element as unknown as HTMLElement);
      await runPendingSetupEffects();

      const uniqueElement = body.querySelector('retend-unique-instance');
      expect(uniqueElement?.getAttribute('state')).toBe('new');

      show.set(true);
      await runPendingSetupEffects();

      const uniqueElements = body.querySelectorAll('retend-unique-instance');

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

      const UniqueContent = createUnique(() => <div>Unique Data</div>, {
        onSave: (el: HTMLElement) => {
          saveStates.push(el.getAttribute('state') || '');
          return {};
        },
      });

      const { body } = window.document;
      const show = Cell.source(true);
      const element = (
        <div>
          {If(show, () => (
            <UniqueContent id={uuid} />
          ))}
        </div>
      );

      body.append(element as unknown as Node);
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

      const UniqueContent = createUnique(() => {
        const derived = Cell.derived(() => {
          derivedComputes++;
          return sourceCell.get() * 2;
        });
        sourceCell.listen(() => {
          listenerCalls++;
        });

        return <div>{derived}</div>;
      });

      const page = Cell.source<'home' | 'about'>('home');
      const renderApp = Cell.source(true);

      const App = () => (
        <div>
          {If(renderApp, () =>
            Switch(page, {
              home: () => (
                <div>
                  <h1>Home</h1>
                  <UniqueContent id={uuid} />
                </div>
              ),
              about: () => (
                <div>
                  <h1>About</h1>
                  <UniqueContent id={uuid} />
                </div>
              ),
            })
          )}
        </div>
      );

      const { body } = window.document;
      body.append((<App />) as unknown as HTMLElement);
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

      const UniqueContent = createUnique(() => <div>Unique Data</div>, {
        onSave: (el: HTMLElement) => {
          saveStates.push(el.getAttribute('state') || '');
          return {};
        },
      });

      const { body } = window.document;
      const showFirst = Cell.source(true);
      const showSecond = Cell.source(false);

      const element = (
        <div>
          First:{' '}
          {If(showFirst, () => (
            <UniqueContent id={uuid} />
          ))}{' '}
          || Second:{' '}
          {If(showSecond, () => (
            <UniqueContent id={uuid} />
          ))}
        </div>
      );

      body.append(element as unknown as Node);
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

    it('should preserve and update attributes on the Unique wrapper', async () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;
      const uuid = crypto.randomUUID();
      const className = Cell.source('initial-class');

      const { body } = window.document;
      const Component = createUnique(() => <div>Content</div>, {
        container: { class: className },
      });

      body.append((<Component />) as unknown as Element);
      await runPendingSetupEffects();

      const uniqueEl = body.querySelector('retend-unique-instance');
      expect(uniqueEl?.className).toBe('initial-class');

      className.set('updated-class');
      await runPendingSetupEffects();
      expect(uniqueEl?.className).toBe('updated-class');
      body.replaceChildren();
    });

    it('should handle nested Unique components', async () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;
      const outerUuid = `outer-${crypto.randomUUID()}`;
      const innerUuid = `inner-${crypto.randomUUID()}`;
      const innerSetup = vi.fn();

      const Inner = createUnique(() => {
        useSetupEffect(() => {
          innerSetup();
        });
        return <div>Inner Content</div>;
      });

      const Outer = createUnique(() => (
        <div class="outer-box">
          <Inner id={innerUuid} />
        </div>
      ));

      const { body } = window.document;
      const show = Cell.source(true);
      body.append(
        (
          <div>
            {If(show, () => (
              <Outer id={outerUuid} />
            ))}
          </div>
        ) as unknown as Node
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

      const Content = createUnique(() => {
        useSetupEffect(() => {
          return cleanupFn;
        });
        return <div>Content</div>;
      });

      const { body } = window.document;
      const show = Cell.source(true);
      const app = (
        <div>
          {If(show, () => (
            <Content id={uuid} />
          ))}
        </div>
      );
      body.append(app as unknown as Node);
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

    it('should pass props as a reactive Cell', async () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;
      const uuid = crypto.randomUUID();
      let receivedProps: any = null;

      interface Props {
        name: string;
        value: number;
      }

      const UniqueWithProps = createUnique<Props>((props) => {
        receivedProps = props;
        return <div>Content</div>;
      });

      const { body } = window.document;
      body.append(
        (
          <UniqueWithProps id={uuid} name="test" value={42} />
        ) as unknown as Node
      );
      await runPendingSetupEffects();

      expect(receivedProps).not.toBeNull();
      expect(typeof receivedProps.get).toBe('function');
      expect(receivedProps.get().name).toBe('test');
      expect(receivedProps.get().value).toBe(42);
      body.replaceChildren();
    });

    it('should update props reactively when component is re-rendered with new props', async () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;
      const uuid = crypto.randomUUID();
      const propValues: string[] = [];

      interface Props {
        name: string;
      }

      const UniqueWithProps = createUnique<Props>((props) => {
        const name = Cell.derived(() => props.get().name);
        name.listen((value) => {
          propValues.push(value);
        });
        return <div>Name: {name}</div>;
      });

      const { body } = window.document;
      const currentName = Cell.source('Alice');

      const App = () => (
        <div>
          {If(currentName, (name) => (
            <UniqueWithProps id={uuid} name={name} />
          ))}
        </div>
      );

      body.append((<App />) as unknown as Node);
      await runPendingSetupEffects();

      expect(getTextContent(body)).toBe('Name: Alice');

      currentName.set('Bob');
      await runPendingSetupEffects();

      expect(getTextContent(body)).toBe('Name: Bob');
      expect(propValues).toContain('Bob');

      currentName.set('Charlie');
      await runPendingSetupEffects();

      expect(getTextContent(body)).toBe('Name: Charlie');
      expect(propValues).toContain('Charlie');

      body.replaceChildren();
    });

    it('should maintain prop reactivity when unique component moves between locations', async () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;
      const uuid = crypto.randomUUID();

      interface Props {
        count: Cell<number>;
        label: string;
      }

      const UniqueCounter = createUnique<Props>((props) => {
        const count = Cell.derived(() => props.get().count.get());
        const label = Cell.derived(() => props.get().label);
        return (
          <div>
            {label}: {count}
          </div>
        );
      });

      const { body } = window.document;
      const count = Cell.source(0);
      const showInFirst = Cell.source(true);
      const showInSecond = Cell.derived(() => !showInFirst.get());

      const App = () => (
        <div>
          <div class="first">
            {If(showInFirst, () => (
              <UniqueCounter id={uuid} count={count} label="First" />
            ))}
          </div>
          <div class="second">
            {If(showInSecond, () => (
              <UniqueCounter id={uuid} count={count} label="Second" />
            ))}
          </div>
        </div>
      );

      body.append((<App />) as unknown as Node);
      await runPendingSetupEffects();

      expect(getTextContent(body.querySelector('.first')!)).toBe('First: 0');

      // Update count while in first position
      count.set(5);
      await runPendingSetupEffects();
      expect(getTextContent(body.querySelector('.first')!)).toBe('First: 5');

      // Move to second position
      showInFirst.set(false);
      await runPendingSetupEffects();
      expect(getTextContent(body.querySelector('.second')!)).toBe('Second: 5');

      // Update count while in second position
      count.set(10);
      await runPendingSetupEffects();
      expect(getTextContent(body.querySelector('.second')!)).toBe('Second: 10');

      // Move back to first position
      showInFirst.set(true);
      await runPendingSetupEffects();
      expect(getTextContent(body.querySelector('.first')!)).toBe('First: 10');

      body.replaceChildren();
    });

    it('should handle complex prop objects reactively', async () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;
      const uuid = crypto.randomUUID();

      interface User {
        name: string;
        age: number;
      }

      interface UserCardProps {
        user: User;
      }

      const UserCard = createUnique<UserCardProps>((props) => {
        const user = Cell.derived(() => props.get().user);
        const name = Cell.derived(() => user.get().name);
        const age = Cell.derived(() => user.get().age);
        return (
          <div>
            {name} ({age})
          </div>
        );
      });

      const { body } = window.document;
      const user = Cell.source({ name: 'Alice', age: 25 });

      const App = () => (
        <div>
          {If(user, (user) => (
            <UserCard id={uuid} user={user} />
          ))}
        </div>
      );

      body.append((<App />) as unknown as Node);
      await runPendingSetupEffects();

      expect(getTextContent(body)).toBe('Alice (25)');

      user.set({ name: 'Bob', age: 30 });
      await runPendingSetupEffects();
      expect(getTextContent(body)).toBe('Bob (30)');

      user.set({ name: 'Charlie', age: 35 });
      await runPendingSetupEffects();
      expect(getTextContent(body)).toBe('Charlie (35)');

      body.replaceChildren();
    });

    it('should not recreate internal state when props change', async () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;
      const uuid = crypto.randomUUID();
      let setupCount = 0;

      interface StatefulComponentProps {
        label: string;
      }

      const StatefulComponent = createUnique<StatefulComponentProps>(
        (props) => {
          const internalState = Cell.source(0);

          useSetupEffect(() => {
            setupCount++;
            internalState.set(100); // Set some initial state
          });

          const label = Cell.derived(() => props.get().label);

          return (
            <div>
              {label}: {internalState}
            </div>
          );
        }
      );

      const { body } = window.document;
      const label = Cell.source('Label A');

      const App = () => (
        <div>
          {If(label, (label) => (
            <StatefulComponent id={uuid} label={label} />
          ))}
        </div>
      );

      body.append((<App />) as unknown as Node);
      await runPendingSetupEffects();

      expect(getTextContent(body)).toBe('Label A: 100');
      expect(setupCount).toBe(1);

      // Change props - should not recreate internal state or re-run setup
      label.set('Label B');
      await runPendingSetupEffects();

      expect(getTextContent(body)).toBe('Label B: 100'); // internal state preserved
      expect(setupCount).toBe(1); // setup not called again

      label.set('Label C');
      await runPendingSetupEffects();

      expect(getTextContent(body)).toBe('Label C: 100'); // internal state still preserved
      expect(setupCount).toBe(1); // setup still not called again

      body.replaceChildren();
    });
  });

  describe('VDom', () => {
    vDomSetup();
    runTests();
  });
});
