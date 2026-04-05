import type { JSX } from 'retend/jsx-runtime';

// import { Cell } from 'retend';
import {
  Alignment,
  BoxShadow,
  FontStyle,
  FontWeight,
  Length,
  TextAlign,
} from 'retend-canvas';

// interface ListItem {
//   id: number;
//   name: string;
// }

// const list = Cell.source<ListItem[]>([]);
//

const styles = {
  root: {
    fontFamily: 'Helvetica Neue',
    height: Length.Pct(100),
    backgroundColor: '#f5f5f5',
  },

  title: {
    fontSize: Length.Px(80),
    fontWeight: FontWeight.Light,
    width: Length.FitContent,
    color: '#b83f45',
    top: Length.Px(15),
    justifySelf: Alignment.Center,
  },

  inputContainer: {
    height: Length.Px(65),
    width: Length.Pct(70),
    maxWidth: Length.Px(400),
    top: Length.Px(130),
    justifySelf: Alignment.Center,
    backgroundColor: 'white',
    boxShadow: [
      BoxShadow.Drop(
        Length.Px(0),
        Length.Px(2),
        Length.Px(4),
        'rgba(0,0,0,.2)'
      ),
      BoxShadow.Drop(
        Length.Px(0),
        Length.Px(25),
        Length.Px(50),
        'rgba(0,0,0,.1)'
      ),
    ],
  },

  input: {
    color: '#0006',
    fontStyle: FontStyle.Italic,
    alignSelf: Alignment.Center,
    textAlign: TextAlign.Center,
    fontSize: Length.Px(24),
    fontWeight: 350,
  },
} satisfies Record<string, JSX.Style>;

const App = () => {
  return (
    <rect style={styles.root}>
      <rect style={styles.title}>todos</rect>
      <rect style={styles.inputContainer}>
        <rect style={styles.input}>What needs to be done?</rect>
      </rect>
    </rect>
  );
};

export default App;
