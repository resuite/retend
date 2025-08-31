import { describe, it, expect, vi, afterAll } from 'vitest';
import { useSetupEffect, For, Cell } from 'retend';
import { resetGlobalContext } from 'retend/context';
import { getTextContent, browserSetup } from '../../setup.ts';

describe('useSetupEffect with For', () => {
  browserSetup();
  afterAll(() => {
    resetGlobalContext();
  });

  it('works in a For() loop', () => {
    const list = Cell.source([
      { id: 1, text: 'A' },
      { id: 2, text: 'B' },
    ]);
    const setupFns = new Map<number, ReturnType<typeof vi.fn>>();
    const cleanupFns = new Map<number, ReturnType<typeof vi.fn>>();

    interface ComponentWithEffectProps {
      item: {
        id: number;
        text: string;
      };
    }

    const ComponentWithEffect = (props: ComponentWithEffectProps) => {
      const { item } = props;
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
            { key: 'id' }
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
});
