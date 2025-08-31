import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { useSetupEffect, If, Cell, For, Switch } from 'retend';
import { createWebRouter, defineRoutes, useRouter } from 'retend/router';
import { getGlobalContext, resetGlobalContext } from 'retend/context';
import { routerSetupBrowser, getTextContent, browserSetup } from '../setup.ts';

describe('useSetupEffect', () => {
  describe('with components', () => {
    browserSetup();
    afterAll(() => {
      resetGlobalContext();
    });

    it('works in an If() branch', () => {
      const show = Cell.source(false);
      const setupFn = vi.fn();
      const cleanupFn = vi.fn();

      const ComponentWithEffect = () => {
        useSetupEffect(() => {
          setupFn();
          return () => {
            cleanupFn();
          };
        });
        return <div>Component</div>;
      };

      const App = () => {
        return (
          <div>
            {If(show, () => (
              <ComponentWithEffect />
            ))}
          </div>
        );
      };

      const result = App() as HTMLElement;

      expect(setupFn).not.toHaveBeenCalled();
      expect(cleanupFn).not.toHaveBeenCalled();
      expect(getTextContent(result)).toBe('');

      show.set(true);
      expect(setupFn).toHaveBeenCalledTimes(1);
      expect(cleanupFn).not.toHaveBeenCalled();
      expect(getTextContent(result)).toBe('Component');

      show.set(false);
      expect(setupFn).toHaveBeenCalledTimes(1);
      expect(cleanupFn).toHaveBeenCalledTimes(1);
      expect(getTextContent(result)).toBe('');

      show.set(true);
      expect(setupFn).toHaveBeenCalledTimes(2);
      expect(cleanupFn).toHaveBeenCalledTimes(1);
      expect(getTextContent(result)).toBe('Component');
    });

    it('works in a For() loop', () => {
      const list = Cell.source([
        { id: 1, text: 'A' },
        { id: 2, text: 'B' },
      ]);
      const setupFns = new Map<number, ReturnType<typeof vi.fn>>();
      const cleanupFns = new Map<number, ReturnType<typeof vi.fn>>();

      const ComponentWithEffect = ({
        item,
      }: {
        item: { id: number; text: string };
      }) => {
        if (!setupFns.has(item.id)) {
          setupFns.set(item.id, vi.fn());
          cleanupFns.set(item.id, vi.fn());
        }

        useSetupEffect(() => {
          setupFns.get(item.id)!();
          return () => {
            cleanupFns.get(item.id)!();
          };
        });
        return <div>{item.text}</div>;
      };

      const App = () => {
        return (
          <div>
            {For(
              list,
              (item) => (
                <ComponentWithEffect item={item} />
              ),
              {
                key: 'id',
              }
            )}
          </div>
        );
      };

      const result = App() as HTMLElement;

      expect(getTextContent(result)).toBe('AB');
      expect(setupFns.get(1)!).toHaveBeenCalledTimes(1);
      expect(setupFns.get(2)!).toHaveBeenCalledTimes(1);
      expect(cleanupFns.get(1)!).not.toHaveBeenCalled();
      expect(cleanupFns.get(2)!).not.toHaveBeenCalled();

      list.set([{ id: 1, text: 'A' }]);
      expect(getTextContent(result)).toBe('A');
      expect(setupFns.get(1)!).toHaveBeenCalledTimes(1);
      expect(setupFns.get(2)!).toHaveBeenCalledTimes(1);
      expect(cleanupFns.get(1)!).not.toHaveBeenCalled();
      expect(cleanupFns.get(2)!).toHaveBeenCalledTimes(1);

      list.set([
        { id: 1, text: 'A' },
        { id: 3, text: 'C' },
      ]);
      expect(getTextContent(result)).toBe('AC');
      expect(setupFns.get(1)!).toHaveBeenCalledTimes(1);
      expect(setupFns.get(3)!).toBeDefined();
      expect(setupFns.get(3)!).toHaveBeenCalledTimes(1);
      expect(cleanupFns.get(1)!).not.toHaveBeenCalled();
      expect(cleanupFns.get(3)!).not.toHaveBeenCalled();

      list.set([]);
      expect(getTextContent(result)).toBe('');
      expect(cleanupFns.get(1)!).toHaveBeenCalledTimes(1);
      expect(cleanupFns.get(2)!).toHaveBeenCalledTimes(1);
      expect(cleanupFns.get(3)!).toHaveBeenCalledTimes(1);
    });

    it('works in a Switch() statement', () => {
      const state = Cell.source<'A' | 'B' | 'C'>('A');
      const setupFn = vi.fn();
      const cleanupFn = vi.fn();

      const ComponentWithEffect = () => {
        useSetupEffect(() => {
          setupFn();
          return () => {
            cleanupFn();
          };
        });
        return <div>Effect Component</div>;
      };

      const App = () => {
        return (
          <div>
            {Switch(state, {
              A: () => <div>Case A</div>,
              B: () => <ComponentWithEffect />,
              C: () => <div>Case C</div>,
            })}
          </div>
        );
      };

      const result = App() as HTMLElement;

      expect(getTextContent(result)).toBe('Case A');
      expect(setupFn).not.toHaveBeenCalled();
      expect(cleanupFn).not.toHaveBeenCalled();

      state.set('B');
      expect(getTextContent(result)).toBe('Effect Component');
      expect(setupFn).toHaveBeenCalledTimes(1);
      expect(cleanupFn).not.toHaveBeenCalled();

      state.set('C');
      expect(getTextContent(result)).toBe('Case C');
      expect(setupFn).toHaveBeenCalledTimes(1);
      expect(cleanupFn).toHaveBeenCalledTimes(1);

      state.set('B');
      expect(getTextContent(result)).toBe('Effect Component');
      expect(setupFn).toHaveBeenCalledTimes(2);
      expect(cleanupFn).toHaveBeenCalledTimes(1);

      state.set('A');
      expect(getTextContent(result)).toBe('Case A');
      expect(setupFn).toHaveBeenCalledTimes(2);
      expect(cleanupFn).toHaveBeenCalledTimes(2);
    });
  });

  // describe('with routing', () => {
  //   beforeEach(() => {
  //     routerSetupBrowser();
  //   });

  //   afterAll(() => {
  //     resetGlobalContext();
  //   });

  //   const setupFn = vi.fn();
  //   const cleanupFn = vi.fn();

  //   const EffectComponent = () => {
  //     useSetupEffect(() => {
  //       setupFn();
  //       return cleanupFn;
  //     });
  //     return <div>Effect Component</div>;
  //   };

  //   const OtherComponent = () => <div>Other Component</div>;

  //   const App = (props: { keepAlive?: boolean }) => {
  //     const { Outlet } = useRouter();
  //     return (
  //       <div>
  //         <Outlet keepAlive={props.keepAlive} />
  //       </div>
  //     );
  //   };

  //   const routes = (props: { keepAlive?: boolean }) =>
  //     defineRoutes([
  //       {
  //         path: '/',
  //         component: () => <App {...props} />,
  //         children: [
  //           { path: 'effect', component: EffectComponent },
  //           { path: 'other', component: OtherComponent },
  //         ],
  //       },
  //     ]);

  //   it('should run setup and cleanup on navigation (keepAlive=false)', async () => {
  //     const { window } = getGlobalContext();
  //     setupFn.mockClear();
  //     cleanupFn.mockClear();

  //     const router = createWebRouter({ routes: routes({ keepAlive: false }) });
  //     router.setWindow(window);
  //     router.attachWindowListeners();

  //     await router.navigate('/effect');
  //     expect(getTextContent(window.document.body)).toBe('Effect Component');
  //     expect(setupFn).toHaveBeenCalledTimes(1);
  //     expect(cleanupFn).not.toHaveBeenCalled();

  //     await router.navigate('/other');
  //     expect(getTextContent(window.document.body)).toBe('Other Component');
  //     expect(setupFn).toHaveBeenCalledTimes(1);
  //     expect(cleanupFn).toHaveBeenCalledTimes(1);

  //     await router.navigate('/effect');
  //     expect(getTextContent(window.document.body)).toBe('Effect Component');
  //     expect(setupFn).toHaveBeenCalledTimes(2);
  //     expect(cleanupFn).toHaveBeenCalledTimes(1);
  //   });

  //   it('should dispose and re-run effects with keepAlive=true', async () => {
  //     const { window } = getGlobalContext();
  //     setupFn.mockClear();
  //     cleanupFn.mockClear();

  //     const router = createWebRouter({ routes: routes({ keepAlive: true }) });
  //     router.setWindow(window);
  //     router.attachWindowListeners();

  //     await router.navigate('/effect');
  //     expect(getTextContent(window.document.body)).toBe('Effect Component');
  //     expect(setupFn).toHaveBeenCalledTimes(1);
  //     expect(cleanupFn).not.toHaveBeenCalled();

  //     await router.navigate('/other');
  //     expect(getTextContent(window.document.body)).toBe('Other Component');
  //     expect(setupFn).toHaveBeenCalledTimes(1);
  //     expect(cleanupFn).toHaveBeenCalledTimes(1);

  //     await router.navigate('/effect');
  //     expect(getTextContent(window.document.body)).toBe('Effect Component');
  //     expect(setupFn).toHaveBeenCalledTimes(2);
  //     expect(cleanupFn).toHaveBeenCalledTimes(1);
  //   });
  // });
});
