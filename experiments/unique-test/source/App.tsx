import type { JSX } from 'retend/jsx-runtime';

import {
  Cell,
  createUnique,
  For,
  If,
  onConnected,
  onSetup,
  type SourceCell,
} from 'retend';
import { UniqueTransition } from 'retend-utils/components';

const appStyles: JSX.StyleValue = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '20px',
  height: '100dvh',
  paddingInline: '20px',
  justifyContent: 'center',
  alignItems: 'center',
  placeContent: 'center',
};

const contentStyles: JSX.StyleValue = {
  height: '100%',
  aspectRatio: '1',
};

const innerContentStyles: JSX.StyleValue = {
  height: '100%',
  width: '100%',
  display: 'grid',
  placeItems: 'center',
  fontSize: '3rem',
  backgroundColor: '#467497',
  color: 'white',
  borderRadius: '13px',
};

const buttonStyles: JSX.StyleValue = {
  display: 'grid',
  placeItems: 'center',
  background: 'transparent',
  minHeight: '9rem',
  aspectRatio: '1',
  border: '2px dashed',
  cursor: 'pointer',
  borderRadius: '15px',
  padding: '0',
};

const paragraphStyles: JSX.StyleValue = {
  margin: '0',
};

const Box = createUnique(() => {
  const count = Cell.source(0);
  const ref = Cell.source<HTMLElement | null>(null);

  onConnected(ref, (div) => {
    div.animate(
      { rotate: ['0deg', '360deg'] },
      { duration: 600, iterations: Infinity }
    );
  });

  onSetup(() => {
    const intervalId = setInterval(() => {
      count.set(count.get() + 1);
    }, 1000);
    return () => clearInterval(intervalId);
  });

  return (
    <UniqueTransition
      transitionDuration="250ms"
      transitionTimingFunction="ease-in-out"
    >
      <p class={paragraphStyles}>Stray Element.</p>
      <div style={contentStyles}>
        <div ref={ref} style={innerContentStyles}>
          {count}
        </div>
      </div>
    </UniqueTransition>
  );
});

const Container = (props: {
  index: Cell<number>;
  selected: SourceCell<number>;
}) => {
  const { index, selected } = props;
  const isSelected = Cell.derived(() => index.get() === selected.get());
  const handleClick = () => selected.set(index.get());

  return (
    <button type="button" style={buttonStyles} onClick={handleClick}>
      {If(isSelected, () => (
        <Box />
      ))}
    </button>
  );
};

const App = () => {
  const containers = Array.from({ length: 8 }).fill(null);
  const selected = Cell.source(0);

  return (
    <div style={appStyles}>
      {For(containers, (_, index) => (
        <Container selected={selected} index={index} />
      ))}
    </div>
  );
};

export default App;
