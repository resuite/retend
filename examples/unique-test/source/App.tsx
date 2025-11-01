import { Cell, For, If, type SourceCell } from 'retend';
import { UniqueTransition } from 'retend-utils/components';
import type { JSX } from 'retend/jsx-runtime';

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
  display: 'grid',
  placeItems: 'center',
  height: '100%',
  aspectRatio: '1',
  fontSize: '3rem',
  backgroundColor: '#467497',
  color: 'white',
  borderRadius: '13px',
};

const uniqueStyles: JSX.StyleValue = {
  display: 'block',
  width: '100%',
  height: '100%',
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

const BoxContent = () => {
  const count = Cell.source(0);
  return <div style={contentStyles}>{count}</div>;
};

const Box = () => {
  return (
    <UniqueTransition
      name="box"
      style={uniqueStyles}
      transitionDuration="250ms"
      transitionTimingFunction="ease-in-out"
    >
      {BoxContent}
    </UniqueTransition>
  );
};

const Container = (props: {
  index: Cell<number>;
  selected: SourceCell<number>;
}) => {
  const { index, selected } = props;
  const isSelected = Cell.derived(() => index.get() === selected.get());
  const handleClick = () => selected.set(index.get());

  return (
    <button type="button" style={buttonStyles} onClick={handleClick}>
      {If(isSelected, Box)}
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
