import { Cell } from 'retend';

export const Counter = () => {
  const count = Cell.source(0);

  return (
    <main>
      <p>Count: {count}</p>
      <button onClick={() => count.set(count.get() + 1)}>Increment</button>
    </main>
  );
};
