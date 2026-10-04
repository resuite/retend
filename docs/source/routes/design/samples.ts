export const COUNTER_SAMPLE = `import { Cell } from 'retend';

const App = () => {
  const count = Cell.source(0);

  return (
    <button type="button" onClick={() => count.set(count.get() + 1)}>
      Count: {count}
    </button>
  );
};`;

export const IF_SAMPLE = `import { If, Cell } from 'retend';

function ToggleMessage() {
  const show = Cell.source(false);
  const toggle = () => show.set(!show.get());

  return (
    <div>
      <button type="button" onClick={toggle}>
        Toggle Message
      </button>

      {If(show, {
        true: () => <p>The message is visible!</p>,
        false: () => <p>The message is hidden.</p>,
      })}
    </div>
  );
}`;

export const WEB_SAMPLE = `import { renderToDOM } from 'retend-web';

renderToDOM(document.getElementById('app')!, App);`;

export const SERVER_SAMPLE = `retendSSG({
  pages: ['/'],
  routerModulePath: './source/router.tsx',
  rootSelector: '#root',
})`;
