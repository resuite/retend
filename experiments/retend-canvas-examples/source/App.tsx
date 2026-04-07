import type { JSX } from 'retend/jsx-runtime';

import { Alignment, Length } from 'retend-canvas';

import Stickers from './Stickers';

const App = () => {
  return (
    <rect style={style.container}>
      <Stickers />
    </rect>
  );
};

const style = {
  container: {
    backgroundColor: 'black',
    color: 'white',
    fontFamily: 'Jetbrains Mono',
    fontSize: Length.Px(54),
    height: Length.Vh(100),
  },
  text: {
    alignSelf: Alignment.Center,
    justifySelf: Alignment.Center,
  },
} satisfies Record<string, JSX.Style>;

export default App;
