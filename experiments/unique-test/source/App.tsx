/// <reference types="retend-web/jsx-runtime" />
import type { JSX } from 'retend/jsx-runtime';

import { Cell, createUnique, For, If, onSetup, type SourceCell } from 'retend';
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
  height: '80%',
  aspectRatio: '1',
  borderRadius: '13px',
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

const Box = createUnique(() => {
  const count = Cell.source(0);

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
      <style>
        {`
        .div {
          animation: rotate 4s linear infinite, pulse 3s linear infinite;
        }

        .content {
          animation: bloom 10s linear;
        }

        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes pulse {
          from { background-color: orange }
          50% { background-color: yellow }
          to { background-color: orange }
        }

        @keyframes bloom {
          from { transform: scale(0.8); }
          50% { transform: scale(1.2); }
          to { transform: scale(1); }
        }
        `}
      </style>
      <div style={contentStyles}>
        <div class="content" style={innerContentStyles}>
          <div class="div">{count}</div>
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
