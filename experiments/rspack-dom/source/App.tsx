import { Cell } from 'retend';

const App = () => {
  const count = Cell.source(0);

  return (
    <main>
      <h1>Rspack DOM test</h1>
      <p>Count: {count}</p>
      <button onClick={() => count.set(count.get() + 1)}>Increment</button>
    </main>
  );
};

export default App;
