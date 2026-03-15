import type { DOMRenderer } from 'retend-web';

import {
  Await,
  Cell,
  If,
  Switch,
  createUnique,
  getActiveRenderer,
  onMove,
  onSetup,
  runPendingSetupEffects,
} from 'retend';
import { ShadowRoot } from 'retend-web';
import { describe, expect, it, vi } from 'vitest';

import {
  browserSetup,
  getTextContent,
  render,
  timeout,
  vDomSetup,
} from './setup';

const runTests = () => {
  it('should render a Unique component', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const uuid = crypto.randomUUID();

    const UniqueContent = createUnique(() => {
      return <div>Unique Data</div>;
    });

    const doc = render(
      <div>
        Hello world: <UniqueContent id={uuid} />
      </div>
    );

    const { body } = window.document;
    body.append(doc);
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

    const doc = render(
      <div>
        Hello world: <UniqueContent id={uuid} />
        Component 2?: <UniqueContent id={uuid} />
      </div>
    );

    const { body } = window.document;
    body.append(doc);

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
      const element = render(
        <div>
          Showing content: {show}, <UniqueContent id={uuid} /> ||
          {If(show, () => (
            <UniqueContent id={uuid} />
          ))}
        </div>
      );

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

    it('should not rerun onSetup when a Unique component moves repeatedly', async () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;
      const uuid = crypto.randomUUID();
      const setupFn = vi.fn();
      const cleanupFn = vi.fn();

      const UniqueContent = createUnique(() => {
        onSetup(() => {
          setupFn();
          return cleanupFn;
        });
        return <div>Unique Data</div>;
      });

      const { body } = window.document;
      const showFirst = Cell.source(true);
      const showSecond = Cell.source(false);
      const element = render(
        <div>
          <div class="first">
            {If(showFirst, () => (
              <UniqueContent id={uuid} />
            ))}
          </div>
          <div class="second">
            {If(showSecond, () => (
              <UniqueContent id={uuid} />
            ))}
          </div>
        </div>
      );

      body.append(element);
      await runPendingSetupEffects();

      expect(setupFn).toHaveBeenCalledTimes(1);
      expect(cleanupFn).not.toHaveBeenCalled();

      showFirst.set(false);
      showSecond.set(true);
      await runPendingSetupEffects();

      expect(getTextContent(body.querySelector('.first')!)).toBe('');
      expect(getTextContent(body.querySelector('.second')!)).toBe(
        'Unique Data'
      );
      expect(setupFn).toHaveBeenCalledTimes(1);
      expect(cleanupFn).not.toHaveBeenCalled();

      showSecond.set(false);
      showFirst.set(true);
      await runPendingSetupEffects();

      expect(getTextContent(body.querySelector('.first')!)).toBe('Unique Data');
      expect(getTextContent(body.querySelector('.second')!)).toBe('');
      expect(setupFn).toHaveBeenCalledTimes(1);
      expect(cleanupFn).not.toHaveBeenCalled();

      body.replaceChildren();
    });

    it('should move a Unique component that returns multiple elements', async () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;
      const uuid = crypto.randomUUID();

      const UniqueContent = createUnique(() => {
        return (
          <>
            <span>Unique</span>
            <span> Data</span>
          </>
        );
      });

      const { body } = window.document;
      const show = Cell.source(false);
      const element = render(
        <div>
          Showing content: {show}, <UniqueContent id={uuid} /> ||
          {If(show, () => (
            <UniqueContent id={uuid} />
          ))}
        </div>
      );

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
      body.replaceChildren();
    });

    it('should move a Unique component that returns a string', async () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;
      const uuid = crypto.randomUUID();

      const UniqueContent = createUnique(() => {
        return 'Unique Data';
      });

      const { body } = window.document;
      const show = Cell.source(false);
      const element = render(
        <div>
          Showing content: {show}, <UniqueContent id={uuid} /> ||
          {If(show, () => (
            <UniqueContent id={uuid} />
          ))}
        </div>
      );

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
      body.replaceChildren();
    });

    it('should move a Unique component that returns nothing', async () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;
      const uuid = crypto.randomUUID();
      const showContent = Cell.source(false);

      const UniqueContent = createUnique(() => {
        return If(showContent, () => 'Unique Data');
      });

      const { body } = window.document;
      const showFirst = Cell.source(true);
      const showSecond = Cell.source(false);
      const element = render(
        <div>
          First:
          {If(showFirst, () => (
            <UniqueContent id={uuid} />
          ))}
          |Second:
          {If(showSecond, () => (
            <UniqueContent id={uuid} />
          ))}
        </div>
      );

      body.append(element);
      await runPendingSetupEffects();

      expect(getTextContent(body)).toBe('First:|Second:');

      showFirst.set(false);
      showSecond.set(true);
      await runPendingSetupEffects();

      expect(getTextContent(body)).toBe('First:|Second:');

      showContent.set(true);
      await runPendingSetupEffects();

      expect(getTextContent(body)).toBe('First:|Second:Unique Data');
      body.replaceChildren();
    });

    it('should not move a Unique component into Await before it resolves', async () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;
      const uuid = crypto.randomUUID();
      let resolveReady = () => {};
      const ready = Cell.derivedAsync(async () => {
        await new Promise<void>((resolve) => {
          resolveReady = resolve;
        });
        return 'Ready';
      });

      const UniqueContent = createUnique(() => {
        return <div>Unique Data</div>;
      });

      const { body } = window.document;
      body.append(
        render(
          <div>
            <div class="outside">
              <span>Outside:</span>
              <UniqueContent id={uuid} />
            </div>
            <Await fallback={<span>Loading</span>}>
              <div class="inside">
                <span>Inside:</span>
                <UniqueContent id={uuid} />
                <span>{ready}</span>
              </div>
            </Await>
          </div>
        )
      );
      await runPendingSetupEffects();

      expect(getTextContent(body.querySelector('.outside')!)).toBe(
        'Outside:Unique Data'
      );
      expect(getTextContent(body)).toContain('Loading');

      resolveReady();
      await timeout();
      body.replaceChildren();
    });

    it('should resolve a pending Await subtree to the last matching Unique instance', async () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;
      const uuid = crypto.randomUUID();
      let resolveReady = () => {};
      const ready = Cell.derivedAsync(async () => {
        await new Promise<void>((resolve) => {
          resolveReady = resolve;
        });
        return 'Ready';
      });

      const UniqueContent = createUnique(() => {
        return <div>Unique Data</div>;
      });

      const { body } = window.document;
      body.append(
        render(
          <div>
            <div class="outside">
              <span>Outside:</span>
              <UniqueContent id={uuid} />
            </div>
            <Await fallback={<span>Loading</span>}>
              <div class="inside-a">
                <span>First:</span>
                <UniqueContent id={uuid} />
              </div>
              <div class="inside-b">
                <span>Second:</span>
                <UniqueContent id={uuid} />
              </div>
              <span>{ready}</span>
            </Await>
          </div>
        )
      );
      await runPendingSetupEffects();

      resolveReady();
      await timeout();

      expect(getTextContent(body.querySelector('.outside')!)).toBe('Outside:');
      expect(getTextContent(body.querySelector('.inside-a')!)).toBe('First:');
      expect(getTextContent(body.querySelector('.inside-b')!)).toBe(
        'Second:Unique Data'
      );
      body.replaceChildren();
    });

    it('should not move a Unique component after its pending Await subtree is removed', async () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;
      const uuid = crypto.randomUUID();
      const showAwait = Cell.source(true);
      const showFirst = Cell.source(true);
      const showSecond = Cell.source(false);
      let resolveReady = () => {};
      const ready = Cell.derivedAsync(async () => {
        await new Promise<void>((resolve) => {
          resolveReady = resolve;
        });
        return 'Ready';
      });

      const UniqueContent = createUnique(() => {
        return <div>Unique Data</div>;
      });

      const { body } = window.document;
      body.append(
        render(
          <div>
            <div class="outside-a">
              <span>Outside A:</span>
              {If(showFirst, () => (
                <UniqueContent id={uuid} />
              ))}
            </div>
            <div class="outside-b">
              <span>Outside B:</span>
              {If(showSecond, () => (
                <UniqueContent id={uuid} />
              ))}
            </div>
            {If(showAwait, () => (
              <Await fallback={<span>Loading</span>}>
                <div class="inside">
                  <span>Inside:</span>
                  <UniqueContent id={uuid} />
                  <span>{ready}</span>
                </div>
              </Await>
            ))}
          </div>
        )
      );
      await runPendingSetupEffects();

      showAwait.set(false);
      showFirst.set(false);
      showSecond.set(true);
      await runPendingSetupEffects();
      resolveReady();
      await timeout();

      expect(getTextContent(body.querySelector('.outside-a')!)).toBe(
        'Outside A:'
      );
      expect(getTextContent(body.querySelector('.outside-b')!)).toBe(
        'Outside B:Unique Data'
      );
      expect(body.querySelector('.inside')).toBeNull();
      body.replaceChildren();
    });

    it('should move a Unique component synchronously after Await has already resolved', async () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;
      const uuid = crypto.randomUUID();
      let resolveReady = () => {};
      const ready = Cell.derivedAsync(async () => {
        await new Promise<void>((resolve) => {
          resolveReady = resolve;
        });
        return 'Ready';
      });

      const UniqueContent = createUnique(() => {
        return <div>Unique Data</div>;
      });

      const { body } = window.document;
      const showFirst = Cell.source(true);
      const showSecond = Cell.source(false);
      body.append(
        render(
          <Await fallback={<span>Loading</span>}>
            <span>{ready}</span>
            <div class="first">
              <span>First:</span>
              {If(showFirst, () => (
                <UniqueContent id={uuid} />
              ))}
            </div>
            <div class="second">
              <span>Second:</span>
              {If(showSecond, () => (
                <UniqueContent id={uuid} />
              ))}
            </div>
          </Await>
        )
      );
      await runPendingSetupEffects();

      resolveReady();
      await timeout();

      showFirst.set(false);
      showSecond.set(true);

      expect(getTextContent(body.querySelector('.first')!)).toBe('First:');
      expect(getTextContent(body.querySelector('.second')!)).toBe(
        'Second:Unique Data'
      );
      body.replaceChildren();
    });

    it('should not let a discarded pending Await steal from a later committed Unique', async () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;
      const uuid = crypto.randomUUID();
      const showSecondAwait = Cell.source(true);
      let resolveFirst = () => {};
      let resolveSecond = () => {};
      const firstReady = Cell.derivedAsync(async () => {
        await new Promise<void>((resolve) => {
          resolveFirst = resolve;
        });
        return 'First';
      });
      const secondReady = Cell.derivedAsync(async () => {
        await new Promise<void>((resolve) => {
          resolveSecond = resolve;
        });
        return 'Second';
      });

      const UniqueContent = createUnique(() => {
        return <div>Unique Data</div>;
      });

      const { body } = window.document;
      body.append(
        render(
          <div>
            <div class="outside">
              <span>Outside:</span>
              <UniqueContent id={uuid} />
            </div>
            <Await fallback={<span>Loading A</span>}>
              <div class="first-await">
                <span>First Await:</span>
                <UniqueContent id={uuid} />
                <span>{firstReady}</span>
              </div>
            </Await>
            {If(showSecondAwait, () => (
              <Await fallback={<span>Loading B</span>}>
                <div class="second-await">
                  <span>Second Await:</span>
                  <UniqueContent id={uuid} />
                  <span>{secondReady}</span>
                </div>
              </Await>
            ))}
          </div>
        )
      );
      await runPendingSetupEffects();

      resolveFirst();
      await timeout();

      expect(getTextContent(body.querySelector('.outside')!)).toBe('Outside:');
      expect(getTextContent(body.querySelector('.first-await')!)).toBe(
        'First Await:Unique DataFirst'
      );

      showSecondAwait.set(false);
      await runPendingSetupEffects();
      resolveSecond();
      await timeout();

      expect(body.querySelector('.second-await')).toBeNull();
      expect(getTextContent(body.querySelector('.first-await')!)).toBe(
        'First Await:Unique DataFirst'
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
        onSetup(() => {
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
      body.append(render(<App />));
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
        onSetup(() => {
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
      body.append(render(<App />));

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

      const saveState = (_el: HTMLElement) => {
        saveFn();
        return { name: 'John Doe' };
      };

      const restoreState = (el: HTMLElement, data: { name: string }) => {
        expect(data.name).toBe('John Doe');
        restoreFn();
      };

      const PersistentMusicPlayer = createUnique(() => {
        onSetup(() => {
          setupFn();
        });
        onMove(() => {
          const data = saveState(document.body as HTMLElement);
          return () => restoreState(document.body as HTMLElement, data);
        });

        return (
          <>
            Music player:
            <audio src="music.mp3" controls>
              <track kind="captions" src="captions.vtt" />
            </audio>
          </>
        );
      });

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
      const app = render(<App />);
      body.append(app);
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
          <div class="shadow-host">
            <ShadowRoot>
              <h2>Music player</h2>
            </ShadowRoot>
          </div>
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
      const app = render(<App />);
      body.append(app);
      await runPendingSetupEffects();
      expect(getTextContent(body)).toBe('Home ');
      const unique = body.querySelector('.shadow-host');
      expect(unique?.shadowRoot).toBeInstanceOf(window.ShadowRoot);

      page.set('about');
      await runPendingSetupEffects();
      const unique2 = body.querySelector('.shadow-host');
      expect(unique2?.shadowRoot).toBeInstanceOf(window.ShadowRoot);

      body.replaceChildren();
    });

    it('should not render a Unique wrapper when first rendered', async () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;
      const uuid = crypto.randomUUID();

      const UniqueContent = createUnique(() => {
        return <div>Unique Data</div>;
      });

      const doc = render(
        <div>
          Hello world: <UniqueContent id={uuid} />
        </div>
      );

      const { body } = window.document;
      body.append(doc);
      await runPendingSetupEffects();

      const uniqueElement = body.querySelector('retend-unique-instance');
      expect(uniqueElement).toBeNull();
      body.replaceChildren();
    });

    it('should move without rendering a Unique wrapper', async () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;
      const uuid = crypto.randomUUID();

      const UniqueContent = createUnique(() => {
        return <div>Unique Data</div>;
      });

      const { body } = window.document;
      const show = Cell.source(false);
      const element = render(
        <div>
          Showing content: {show}, <UniqueContent id={uuid} /> ||
          {If(show, () => (
            <UniqueContent id={uuid} />
          ))}
        </div>
      );

      body.append(element);
      await runPendingSetupEffects();

      expect(body.querySelector('retend-unique-instance')).toBeNull();

      show.set(true);
      await runPendingSetupEffects();

      expect(body.querySelector('retend-unique-instance')).toBeNull();
      expect(getTextContent(body)).toBe(
        'Showing content: true,  ||Unique Data'
      );

      body.replaceChildren();
    });

    it('should call onMove when component is unmounted', async () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;
      const uuid = crypto.randomUUID();
      let moved = 0;

      const UniqueContent = createUnique(() => {
        onMove(() => {
          moved += 1;
        });
        return <div>Unique Data</div>;
      });

      const { body } = window.document;
      const show = Cell.source(true);
      const element = render(
        <div>
          {If(show, () => (
            <UniqueContent id={uuid} />
          ))}
        </div>
      );

      body.append(element);
      await runPendingSetupEffects();

      // Remove the component completely
      show.set(false);
      await runPendingSetupEffects();

      expect(moved).toBe(1);

      // The element should be removed from DOM
      const uniqueElement = body.querySelector('retend-unique-instance');
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
      body.append(render(<App />));
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

    it('should run onMove save and restore callbacks through the lifecycle', async () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;
      const uuid = crypto.randomUUID();
      const states: string[] = [];

      const UniqueContent = createUnique(() => {
        onMove(() => {
          states.push('moved');
          return () => {
            states.push('restored');
          };
        });
        return <div>Unique Data</div>;
      });

      const { body } = window.document;
      const showFirst = Cell.source(true);
      const showSecond = Cell.source(false);

      const element = render(
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

      body.append(element);
      await runPendingSetupEffects();

      showFirst.set(false);
      showSecond.set(true);
      await runPendingSetupEffects();

      showSecond.set(false);
      showFirst.set(true);
      await runPendingSetupEffects();

      showFirst.set(false);
      await runPendingSetupEffects();

      showFirst.set(true);
      await runPendingSetupEffects();

      expect(states).toEqual([
        'moved',
        'restored',
        'moved',
        'restored',
        'moved',
      ]);

      body.replaceChildren();
    });

    it('should call onMove when moving back to a previously visited handle', async () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;
      const uuid = crypto.randomUUID();
      const moveCount = Cell.source(0);

      const UniqueContent = createUnique(() => {
        onMove(() => {
          moveCount.set(moveCount.get() + 1);
        });
        return <div>Unique Data</div>;
      });

      const { body } = window.document;
      const showFirst = Cell.source(true);
      const showSecond = Cell.source(false);

      const element = render(
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

      body.append(element);
      await runPendingSetupEffects();

      // Initial state: component in first location, onMove not called yet
      expect(moveCount.get()).toBe(0);

      // Move from first to second
      showFirst.set(false);
      showSecond.set(true);
      await runPendingSetupEffects();
      expect(moveCount.get()).toBe(1);

      // Move back to first (previously visited location)
      // This is the bug scenario - onMove should be called
      showSecond.set(false);
      showFirst.set(true);
      await runPendingSetupEffects();
      expect(moveCount.get()).toBe(2);

      // Move to second again
      showFirst.set(false);
      showSecond.set(true);
      await runPendingSetupEffects();
      expect(moveCount.get()).toBe(3);

      // Move back to first again
      showSecond.set(false);
      showFirst.set(true);
      await runPendingSetupEffects();
      expect(moveCount.get()).toBe(4);

      body.replaceChildren();
    });

    it('should call onMove when both instances rendered then second is removed', async () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;
      const uuid = crypto.randomUUID();
      const moveCount = Cell.source(0);

      const UniqueContent = createUnique(() => {
        onMove(() => {
          moveCount.set(moveCount.get() + 1);
        });
        return <div>Unique Data</div>;
      });

      const { body } = window.document;
      const showSecond = Cell.source(true);

      // First instance always rendered, second instance initially visible
      const element = render(
        <div>
          First: <UniqueContent id={uuid} /> || Second:{' '}
          {If(showSecond, () => (
            <UniqueContent id={uuid} />
          ))}
        </div>
      );

      body.append(element);
      await runPendingSetupEffects();

      // Both instances rendered on same loop, component is at second location (last wins)
      // onMove is not called because nothing was removed yet
      expect(moveCount.get()).toBe(0);

      // Remove the second location
      showSecond.set(false);
      await runPendingSetupEffects();

      // onMove should be called as component is removed from second location
      // and moves back to first location
      expect(moveCount.get()).toBe(1);

      // Ping pong: show second again
      // Component was stable at first location, now moves to second location
      // onMove IS called because the component moved from a stable position
      showSecond.set(true);
      await runPendingSetupEffects();
      expect(moveCount.get()).toBe(2);

      // Remove second again - onMove IS called (component moves back to first)
      showSecond.set(false);
      await runPendingSetupEffects();
      expect(moveCount.get()).toBe(3);

      // Ping pong again: show second
      // Component was stable at first location, now moves to second location
      // onMove IS called because the component moved from a stable position
      showSecond.set(true);
      await runPendingSetupEffects();
      expect(moveCount.get()).toBe(4);

      // Remove second again - onMove IS called (component moves back to first)
      showSecond.set(false);
      await runPendingSetupEffects();
      expect(moveCount.get()).toBe(5);

      // Verify component is still in first location
      expect(getTextContent(body)).toContain('Unique Data');

      body.replaceChildren();
    });

    it('should preserve and update attributes on the rendered element', async () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;
      const className = Cell.source('initial-class');

      const { body } = window.document;
      const Component = createUnique(() => (
        <div class={className}>Content</div>
      ));

      body.append(render(<Component />));
      await runPendingSetupEffects();

      const uniqueEl = body.querySelector('div');
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
        onSetup(() => {
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
        render(
          <div>
            {If(show, () => (
              <Outer id={outerUuid} />
            ))}
          </div>
        )
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
      expect(innerSetup).toHaveBeenCalledTimes(1);
      body.replaceChildren();
    });

    it('should dispose when not remounted before activate', async () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;
      const uuid = crypto.randomUUID();
      const cleanupFn = vi.fn();

      const Content = createUnique(() => {
        onSetup(() => {
          return cleanupFn;
        });
        return <div>Content</div>;
      });

      const { body } = window.document;
      const show = Cell.source(true);
      const app = render(
        <div>
          {If(show, () => (
            <Content id={uuid} />
          ))}
        </div>
      );
      body.append(app);
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
      body.append(render(<UniqueWithProps id={uuid} name="test" value={42} />));
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

      body.append(render(<App />));
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

      body.append(render(<App />));
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

    it('should update plain props after a Unique component moves', async () => {
      const renderer = getActiveRenderer() as DOMRenderer;
      const { host: window } = renderer;
      const uuid = crypto.randomUUID();

      interface Props {
        label: string;
      }

      const UniqueContent = createUnique<Props>((props) => {
        const label = Cell.derived(() => props.get().label);
        return <div>{label}</div>;
      });

      const { body } = window.document;
      const label = Cell.source('Alpha');
      const showFirst = Cell.source(true);
      const showSecond = Cell.derived(() => !showFirst.get());

      const App = () => (
        <div>
          <div class="first">
            {If(label, (label) =>
              If(showFirst, () => <UniqueContent id={uuid} label={label} />)
            )}
          </div>
          <div class="second">
            {If(label, (label) =>
              If(showSecond, () => <UniqueContent id={uuid} label={label} />)
            )}
          </div>
        </div>
      );

      body.append(render(<App />));
      await runPendingSetupEffects();

      expect(getTextContent(body.querySelector('.first')!)).toBe('Alpha');

      showFirst.set(false);
      await runPendingSetupEffects();
      expect(getTextContent(body.querySelector('.second')!)).toBe('Alpha');

      label.set('Beta');
      await runPendingSetupEffects();
      expect(getTextContent(body.querySelector('.second')!)).toBe('Beta');

      showFirst.set(true);
      await runPendingSetupEffects();
      expect(getTextContent(body.querySelector('.first')!)).toBe('Beta');

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

      body.append(render(<App />));
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

          onSetup(() => {
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

      body.append(render(<App />));
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
