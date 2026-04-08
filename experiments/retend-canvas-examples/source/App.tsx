import { Alignment, type CanvasStyle, Length } from 'retend-canvas';

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
    fontFamily: 'Maple Mono',
    fontSize: Length.Px(12),
    height: Length.Vh(100),
  },
  text: {
    alignSelf: Alignment.Center,
    justifySelf: Alignment.Center,
  },
} satisfies Record<string, CanvasStyle>;

export default App;
