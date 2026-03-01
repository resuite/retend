import { Await, Cell, For, If, Switch, getActiveRenderer } from 'retend';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type NodeLike,
  browserSetup,
  getTextContent,
  timeout,
  vDomSetup,
} from '../setup.tsx';

const runTests = () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render fallback until async children resolve', async () => {
    const renderer = getActiveRenderer();
    const asyncText = Cell.derivedAsync(async () => {
      await timeout(10);
      return 'Loaded';
    });

    const App = () => (
      <Await fallback={<span>Loading</span>}>
        <div>{asyncText}</div>
      </Await>
    );
    const result = renderer.render(App) as NodeLike;

    expect(getTextContent(result)).toBe('Loading');

    await vi.advanceTimersByTimeAsync(20);

    expect(getTextContent(result)).toBe('Loaded');
  });

  it('should wait for all async children before rendering', async () => {
    const renderer = getActiveRenderer();
    const first = Cell.derivedAsync(async () => {
      await timeout(10);
      return 'First';
    });
    const second = Cell.derivedAsync(async () => {
      await timeout(25);
      return 'Second';
    });

    const App = () => (
      <Await fallback={<span>Loading</span>}>
        <div>
          {first} {second}
        </div>
      </Await>
    );
    const result = renderer.render(App) as NodeLike;

    expect(getTextContent(result)).toBe('Loading');

    await vi.advanceTimersByTimeAsync(15);
    expect(getTextContent(result)).toBe('Loading');

    await vi.advanceTimersByTimeAsync(20);
    expect(getTextContent(result)).toBe('First Second');
  });

  it('should not re-render fallback after initial resolution', async () => {
    const renderer = getActiveRenderer();
    const trigger = Cell.source('First');
    const asyncText = Cell.derivedAsync(async (get) => {
      const value = get(trigger);
      await timeout(10);
      return value;
    });

    const App = () => (
      <Await fallback={<span>Loading</span>}>
        <div>{asyncText}</div>
      </Await>
    );
    const result = renderer.render(App) as NodeLike;

    expect(getTextContent(result)).toBe('Loading');

    await vi.advanceTimersByTimeAsync(20);
    expect(getTextContent(result)).toBe('First');

    trigger.set('Second');

    await vi.advanceTimersByTimeAsync(5);
    expect(getTextContent(result)).toBe('First');

    await vi.advanceTimersByTimeAsync(20);
    expect(getTextContent(result)).toBe('Second');
  });

  it('should suspend when async attributes are pending', async () => {
    const renderer = getActiveRenderer();
    const asyncId = Cell.derivedAsync(async () => {
      await timeout(10);
      return 'ready-id';
    });

    const App = () => (
      <Await fallback={<span>Loading</span>}>
        <div id={asyncId}>Ready</div>
      </Await>
    );
    const result = renderer.render(App) as NodeLike;

    expect(getTextContent(result)).toBe('Loading');

    await vi.advanceTimersByTimeAsync(20);

    expect(getTextContent(result)).toBe('Ready');
  });

  it('should suspend for async class attributes with Await', async () => {
    const renderer = getActiveRenderer();
    const asyncClass = Cell.derivedAsync(async () => {
      await timeout(10);
      return 'loaded';
    });

    const App = () => (
      <div id="root">
        <Await fallback={<span>Loading</span>}>
          <div id="target" class={asyncClass}>
            Ready
          </div>
        </Await>
      </div>
    );
    const result = renderer.render(App) as unknown as Element;

    expect(getTextContent(result)).toBe('Loading');

    await vi.advanceTimersByTimeAsync(20);

    const target = result.querySelector('#target');
    expect(target?.getAttribute('class')).toBe('loaded');
    expect(getTextContent(result)).toBe('Ready');
  });

  it('should wait for async values across component boundaries', async () => {
    const renderer = getActiveRenderer();
    const name = Cell.derivedAsync(async () => {
      await timeout(10);
      return 'Ada';
    });
    const role = Cell.derivedAsync(async () => {
      await timeout(25);
      return 'Engineer';
    });

    const Title = () => <span>{name}</span>;
    const Role = () => <span>{role}</span>;

    const App = () => (
      <Await fallback={<span>Loading</span>}>
        <div>
          <Title />
          {' - '}
          <Role />
        </div>
      </Await>
    );
    const result = renderer.render(App) as NodeLike;

    expect(getTextContent(result)).toBe('Loading');

    await vi.advanceTimersByTimeAsync(15);
    expect(getTextContent(result)).toBe('Loading');

    await vi.advanceTimersByTimeAsync(20);
    expect(getTextContent(result)).toBe('Ada - Engineer');
  });

  it('should suspend for async If conditions', async () => {
    const renderer = getActiveRenderer();
    const condition = Cell.derivedAsync(async () => {
      await timeout(10);
      return true;
    });

    const App = () => (
      <Await fallback={<span>Loading</span>}>
        <div>
          {If(
            condition,
            () => (
              <span>Yes</span>
            ),
            () => (
              <span>No</span>
            )
          )}
        </div>
      </Await>
    );
    const result = renderer.render(App) as NodeLike;

    expect(getTextContent(result)).toBe('Loading');

    await vi.advanceTimersByTimeAsync(20);

    expect(getTextContent(result)).toBe('Yes');
  });

  it('should await async content rendered after an async If resolves', async () => {
    const renderer = getActiveRenderer();
    const condition = Cell.derivedAsync(async () => {
      await timeout(10);
      return true;
    });

    const NestedComponent = () => {
      const delayed = Cell.derivedAsync(async () => {
        await timeout(25);
        return 'Deep';
      });

      return <span>{delayed}</span>;
    };

    const App = () => (
      <Await fallback={<span>Loading</span>}>
        <div>
          {If(condition, {
            true: NestedComponent,
            false: () => <span>No</span>,
          })}
        </div>
      </Await>
    );
    const result = renderer.render(App) as NodeLike;

    expect(getTextContent(result)).toBe('Loading');

    await vi.advanceTimersByTimeAsync(15);
    expect(getTextContent(result)).toBe('Loading');

    await vi.advanceTimersByTimeAsync(20);
    expect(getTextContent(result)).toBe('Deep');
  });

  it('should suspend for async For lists', async () => {
    const renderer = getActiveRenderer();
    const items = Cell.derivedAsync(async () => {
      await timeout(10);
      return ['A', 'B', 'C'];
    });

    const App = () => (
      <Await fallback={<span>Loading</span>}>
        <div>
          {For(items, (item) => (
            <span>{item}</span>
          ))}
        </div>
      </Await>
    );
    const result = renderer.render(App) as NodeLike;

    expect(getTextContent(result)).toBe('Loading');

    await vi.advanceTimersByTimeAsync(20);

    expect(getTextContent(result)).toBe('ABC');
  });

  it('should suspend for async values rendered in Switch cases', async () => {
    const renderer = getActiveRenderer();
    const status = Cell.source('loading');
    const message = Cell.derivedAsync(async () => {
      await timeout(10);
      return 'Loaded';
    });

    const App = () => (
      <Await fallback={<span>Loading</span>}>
        <div>
          {Switch(status, {
            loading: () => <span>{message}</span>,
            done: () => <span>Done</span>,
          })}
        </div>
      </Await>
    );
    const result = renderer.render(App) as NodeLike;

    expect(getTextContent(result)).toBe('Loading');

    await vi.advanceTimersByTimeAsync(20);

    expect(getTextContent(result)).toBe('Loaded');
  });

  it('should suspend when async cell is created inside component body', async () => {
    const renderer = getActiveRenderer();

    const App = () => {
      const asyncText = Cell.derivedAsync(async () => {
        await timeout(10);
        return 'Inner';
      });

      return (
        <Await fallback={<span>Loading</span>}>
          <div>{asyncText}</div>
        </Await>
      );
    };

    const result = renderer.render(App) as NodeLike;

    expect(getTextContent(result)).toBe('Loading');

    await vi.advanceTimersByTimeAsync(20);

    expect(getTextContent(result)).toBe('Inner');
  });

  it('should suspend for async If when created inside a child component', async () => {
    const renderer = getActiveRenderer();

    const Child = () => {
      const condition = Cell.derivedAsync(async () => {
        await timeout(10);
        return true;
      });

      return If(
        condition,
        () => <span>Yes</span>,
        () => <span>No</span>
      );
    };

    const App = () => (
      <Await fallback={<span>Loading</span>}>
        <div>
          <Child />
        </div>
      </Await>
    );

    const result = renderer.render(App) as NodeLike;

    expect(getTextContent(result)).toBe('Loading');

    await vi.advanceTimersByTimeAsync(20);

    expect(getTextContent(result)).toBe('Yes');
  });

  it('should suspend for async For when list is created inside a component', async () => {
    const renderer = getActiveRenderer();

    const List = () => {
      const items = Cell.derivedAsync(async () => {
        await timeout(10);
        return ['X', 'Y'];
      });

      return (
        <>
          {For(items, (item) => (
            <span>{item}</span>
          ))}
        </>
      );
    };

    const App = () => (
      <Await fallback={<span>Loading</span>}>
        <div>
          <List />
        </div>
      </Await>
    );

    const result = renderer.render(App) as NodeLike;

    expect(getTextContent(result)).toBe('Loading');

    await vi.advanceTimersByTimeAsync(20);

    expect(getTextContent(result)).toBe('XY');
  });

  it('should suspend for async Switch when created inside a component', async () => {
    const renderer = getActiveRenderer();

    const Case = () => {
      const message = Cell.derivedAsync(async () => {
        await timeout(10);
        return 'Ready';
      });

      return Switch('loading', {
        loading: () => <span>{message}</span>,
      });
    };

    const App = () => (
      <Await fallback={<span>Loading</span>}>
        <div>
          <Case />
        </div>
      </Await>
    );

    const result = renderer.render(App) as NodeLike;

    expect(getTextContent(result)).toBe('Loading');

    await vi.advanceTimersByTimeAsync(20);

    expect(getTextContent(result)).toBe('Ready');
  });

  it('should suspend when async fragment content is created inside a component', async () => {
    const renderer = getActiveRenderer();

    const Fragmented = () => {
      const word = Cell.derivedAsync(async () => {
        await timeout(10);
        return 'World';
      });

      return (
        <>
          <span>Hello</span>
          <span>{word}</span>
        </>
      );
    };

    const App = () => (
      <Await fallback={<span>Loading</span>}>
        <div>
          <Fragmented />
        </div>
      </Await>
    );

    const result = renderer.render(App) as NodeLike;

    expect(getTextContent(result)).toBe('Loading');

    await vi.advanceTimersByTimeAsync(20);

    expect(getTextContent(result)).toBe('HelloWorld');
  });

  it('should handle fragments with mixed async and static children', async () => {
    const renderer = getActiveRenderer();
    const asyncWord = Cell.derivedAsync(async () => {
      await timeout(10);
      return 'World';
    });

    const App = () => (
      <Await fallback={<span>Loading</span>}>
        <>
          <span>Hello {asyncWord}</span>
          <span>!</span>
        </>
      </Await>
    );
    const result = renderer.render(App) as NodeLike;

    expect(getTextContent(result)).toBe('Loading');

    await vi.advanceTimersByTimeAsync(20);

    expect(getTextContent(result)).toBe('Hello World!');
  });

  it('should allow nested Await boundaries with independent fallbacks', async () => {
    const renderer = getActiveRenderer();
    const outerText = Cell.derivedAsync(async () => {
      await timeout(10);
      return 'Outer';
    });
    const innerText = Cell.derivedAsync(async () => {
      await timeout(25);
      return 'Inner';
    });

    const App = () => (
      <Await fallback={<span>Outer Loading</span>}>
        <div>
          {outerText}{' '}
          <Await fallback={<span>Inner Loading</span>}>
            <span>{innerText}</span>
          </Await>
        </div>
      </Await>
    );
    const result = renderer.render(App) as NodeLike;

    expect(getTextContent(result)).toBe('Outer Loading');

    await vi.advanceTimersByTimeAsync(15);
    expect(getTextContent(result)).toBe('Outer Inner Loading');

    await vi.advanceTimersByTimeAsync(20);
    expect(getTextContent(result)).toBe('Outer Inner');
  });

  it('should support multiple sibling Await boundaries', async () => {
    const renderer = getActiveRenderer();
    const first = Cell.derivedAsync(async () => {
      await timeout(10);
      return 'First';
    });
    const second = Cell.derivedAsync(async () => {
      await timeout(25);
      return 'Second';
    });

    const App = () => (
      <div>
        <Await fallback={<span>Loading A</span>}>
          <span>{first}</span>
        </Await>
        {' | '}
        <Await fallback={<span>Loading B</span>}>
          <span>{second}</span>
        </Await>
      </div>
    );
    const result = renderer.render(App) as NodeLike;

    expect(getTextContent(result)).toBe('Loading A | Loading B');

    await vi.advanceTimersByTimeAsync(15);
    expect(getTextContent(result)).toBe('First | Loading B');

    await vi.advanceTimersByTimeAsync(20);
    expect(getTextContent(result)).toBe('First | Second');
  });
};

describe('Await', () => {
  describe('Browser', () => {
    browserSetup();
    runTests();
  });

  describe('VDom', () => {
    vDomSetup();
    runTests();
  });
});
