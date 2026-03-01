import { Cell, If } from 'retend';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type NodeLike,
  browserSetup,
  getTextContent,
  render,
  timeout,
  vDomSetup,
} from '../setup.tsx';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const runTests = () => {
  it('should start with pending as false', () => {
    const task = Cell.task(async (input: number) => {
      return input * 2;
    });

    expect(task.pending.get()).toBe(false);
    expect(task.error.get()).toBe(null);
  });

  it('should execute when runWith is called', async () => {
    const task = Cell.task(async (input: number) => {
      await timeout(10);
      return input * 2;
    });

    const promise = task.runWith(5);
    expect(task.pending.get()).toBe(true);

    await vi.advanceTimersByTimeAsync(10);
    const result = await promise;
    expect(result).toBe(10);
    expect(task.pending.get()).toBe(false);
  });

  it('should set pending to true while running', async () => {
    const pendingStates: boolean[] = [];
    const task = Cell.task(async (input: number) => {
      await timeout(20);
      return input;
    });

    task.pending.listen((val) => pendingStates.push(val));

    const promise = task.runWith(1);
    await vi.advanceTimersByTimeAsync(5);
    expect(task.pending.get()).toBe(true);

    await vi.advanceTimersByTimeAsync(20);
    await promise;
    expect(task.pending.get()).toBe(false);
    expect(pendingStates).toContain(true);
    expect(pendingStates).toContain(false);
  });

  it('should set error when task throws', async () => {
    const task = Cell.task(async () => {
      await timeout(10);
      throw new Error('Task failed');
    });

    const promise = task.runWith(undefined);
    await vi.advanceTimersByTimeAsync(10);
    await promise;

    expect(task.error.get()).toBeInstanceOf(Error);
    expect(task.error.get()?.message).toBe('Task failed');
    expect(task.pending.get()).toBe(false);
  });

  it('should clear error on successful run after failure', async () => {
    let shouldFail = true;
    const task = Cell.task(async () => {
      await timeout(10);
      if (shouldFail) {
        throw new Error('Task failed');
      }
      return 'success';
    });

    const firstAttempt = task.runWith(undefined);
    await vi.advanceTimersByTimeAsync(10);
    await firstAttempt;
    expect(task.error.get()).toBeInstanceOf(Error);

    shouldFail = false;
    const secondAttempt = task.runWith(undefined);
    await vi.advanceTimersByTimeAsync(10);
    await secondAttempt;
    expect(task.error.get()).toBe(null);
  });

  it('should pass input to the task function', async () => {
    const task = Cell.task(async (data: { name: string; age: number }) => {
      await timeout(10);
      return `${data.name} is ${data.age}`;
    });

    const promise = task.runWith({ name: 'Alice', age: 30 });
    await vi.advanceTimersByTimeAsync(10);
    const result = await promise;
    expect(result).toBe('Alice is 30');
  });

  it('should provide an AbortSignal', async () => {
    let receivedSignal: AbortSignal | null = null;

    const task = Cell.task(async (input: number, signal: AbortSignal) => {
      receivedSignal = signal;
      await timeout(10);
      return input;
    });

    const promise = task.runWith(1);
    await vi.advanceTimersByTimeAsync(10);
    await promise;
    expect(receivedSignal).toBeInstanceOf(AbortSignal);
  });

  it('should not auto-execute when created', async () => {
    const fn = vi.fn().mockResolvedValue('result');
    Cell.task(fn);

    await vi.advanceTimersByTimeAsync(20);
    expect(fn).not.toHaveBeenCalled();
  });

  it('should execute each runWith call independently', async () => {
    const fn = vi.fn().mockImplementation(async (input: number) => {
      await timeout(10);
      return input * 2;
    });

    const task = Cell.task(fn);

    const first = task.runWith(1);
    await vi.advanceTimersByTimeAsync(10);
    await first;

    const second = task.runWith(2);
    await vi.advanceTimersByTimeAsync(10);
    await second;

    const third = task.runWith(3);
    await vi.advanceTimersByTimeAsync(10);
    await third;

    expect(fn).toHaveBeenCalledTimes(3);
    expect(fn).toHaveBeenNthCalledWith(1, 1, expect.any(AbortSignal));
    expect(fn).toHaveBeenNthCalledWith(2, 2, expect.any(AbortSignal));
    expect(fn).toHaveBeenNthCalledWith(3, 3, expect.any(AbortSignal));
  });

  it('should work with If for pending state', async () => {
    const task = Cell.task(async (input: string) => {
      await timeout(20);
      return input.toUpperCase();
    });

    const App = () => (
      <div>
        {If(task.pending, {
          true: () => <span>Loading...</span>,
          false: () => <span>Ready</span>,
        })}
      </div>
    );
    const result = render(App) as NodeLike;

    expect(getTextContent(result)).toBe('Ready');

    const promise = task.runWith('hello');
    await vi.advanceTimersByTimeAsync(5);
    expect(getTextContent(result)).toBe('Loading...');

    await vi.advanceTimersByTimeAsync(20);
    await promise;
    expect(getTextContent(result)).toBe('Ready');
  });

  it('should work with If for error state', async () => {
    const task = Cell.task(async () => {
      await timeout(10);
      throw new Error('Something went wrong');
    });

    const App = () => (
      <div>
        {If(task.error, (err) => (
          <span>Error: {err.message}</span>
        ))}
      </div>
    );
    const result = render(App) as NodeLike;

    expect(getTextContent(result)).toBe('');

    const promise = task.runWith(undefined);
    await vi.advanceTimersByTimeAsync(10);
    await promise;
    expect(getTextContent(result)).toBe('Error: Something went wrong');
  });

  it('should handle concurrent calls', async () => {
    const results: number[] = [];
    const task = Cell.task(async (input: number) => {
      await timeout(10);
      results.push(input);
      return input;
    });

    const p1 = task.runWith(1);
    const p2 = task.runWith(2);
    const p3 = task.runWith(3);

    await vi.advanceTimersByTimeAsync(10);
    await Promise.all([p1, p2, p3]);
    expect(results).toEqual([1, 2, 3]);
  });

  it('should return null from get() before first run', async () => {
    const task = Cell.task(async (input: number) => {
      return input * 2;
    });

    const result = await task.get();
    expect(result).toBe(null);
  });

  it('should return result from get() after run', async () => {
    const task = Cell.task(async (input: number) => {
      await timeout(10);
      return input * 2;
    });

    const promise = task.runWith(5);
    await vi.advanceTimersByTimeAsync(10);
    await promise;
    const result = await task.get();
    expect(result).toBe(10);
  });

  it('should handle void return type', async () => {
    let sideEffect = 0;
    const task = Cell.task(async (increment: number) => {
      await timeout(10);
      sideEffect += increment;
    });

    const first = task.runWith(5);
    await vi.advanceTimersByTimeAsync(10);
    await first;
    expect(sideEffect).toBe(5);

    const second = task.runWith(3);
    await vi.advanceTimersByTimeAsync(10);
    await second;
    expect(sideEffect).toBe(8);
  });

  it('should handle complex input types', async () => {
    interface FormData {
      email: string;
      password: string;
      remember: boolean;
    }

    const task = Cell.task(async (data: FormData) => {
      await timeout(10);
      return { success: true, email: data.email };
    });

    const promise = task.runWith({
      email: 'test@example.com',
      password: 'secret',
      remember: true,
    });
    await vi.advanceTimersByTimeAsync(10);
    const result = await promise;

    expect(result).toEqual({ success: true, email: 'test@example.com' });
  });
};

describe('Cell.task()', () => {
  describe('Browser', () => {
    browserSetup();
    runTests();
  });

  describe('VDom', () => {
    vDomSetup();
    runTests();
  });
});
