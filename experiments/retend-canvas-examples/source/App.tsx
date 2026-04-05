import type { JSX } from 'retend/jsx-runtime';

import {
  Alignment,
  BoxShadow,
  FontStyle,
  FontWeight,
  Length,
  TextAlign,
} from 'retend-canvas';

const App = () => {
  return (
    <rect style={styles.root}>
      <text style={styles.title}>todos</text>
      <rect style={styles.inputContainer}>
        <text style={styles.input}>What needs to be done?</text>
      </rect>
      <rect style={styles.credit}>
        <text style={styles.creditTextInstr}>Double-click to edit a todo</text>
        <text style={styles.creditText}>Created by the TodoMVC Team</text>
        <text style={styles.creditData}>Part of TodoMVC</text>
      </rect>
    </rect>
  );
};

const styles = {
  root: {
    fontFamily: 'Helvetica Neue',
    height: Length.Pct(100),
    backgroundColor: '#f5f5f5',
  },

  title: {
    fontSize: Length.Px(80),
    fontWeight: FontWeight.Light,
    color: '#b83f45',
    top: Length.Px(15),
    justifySelf: Alignment.Center,
  },

  inputContainer: {
    height: Length.Px(65),
    width: Length.Pct(70),
    maxWidth: Length.Px(800),
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
    left: Length.Px(60),
    fontWeight: 350,
  },

  credit: {
    top: Length.Px(245),
    color: '#4d4d4d',
    fontSize: Length.Px(11),
    fontWeight: 300,
  },

  creditTextInstr: {
    justifySelf: Alignment.Center,
  },

  creditText: {
    justifySelf: Alignment.Center,
    top: Length.Lh(1.5),
  },

  creditData: {
    justifySelf: Alignment.Center,
    top: Length.Lh(3),
  },
} satisfies Record<string, JSX.Style>;

export default App;
