import { describe, expect, it, vi } from 'vitest';
import { browserSetup, getTextContent, vDomSetup } from './setup';
import { getGlobalContext } from 'retend/context';
import { Unique } from 'retend/unique';
import type { VNode } from 'retend/v-dom';
import {
  Cell,
  If,
  runPendingSetupEffects,
  Switch,
  useSetupEffect,
} from 'retend';
import { ShadowRoot } from 'retend/shadowroot';

const runTests = () => {
  it('should render a <Unique/> component', async () => {
    const { window } = getGlobalContext();
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
    const { window } = getGlobalContext();
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
      const { window } = getGlobalContext();
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
      const { window } = getGlobalContext();
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
      const { window } = getGlobalContext();
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
      const { window } = getGlobalContext();
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
      const { window } = getGlobalContext();
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
  });

  describe('VDom', () => {
    vDomSetup();
    runTests();
  });
});
