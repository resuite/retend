// import { Cell } from 'retend';
import { Alignment, FontWeight, Length } from 'retend-canvas';

// interface ListItem {
//   id: number;
//   name: string;
// }

// const list = Cell.source<ListItem[]>([]);

const App = () => {
  return (
    <rect
      style={{
        fontFamily: 'Helvetica Neue',
        height: Length.Pct(100),
        backgroundColor: '#f5f5f5',
      }}
    >
      <rect
        style={{
          fontSize: Length.Px(80),
          fontWeight: FontWeight.Light,
          width: Length.FitContent,
          color: '#b83f45',
          top: Length.Px(15),
          justifySelf: Alignment.Center,
        }}
      >
        todos
      </rect>
    </rect>
  );
};

export default App;
