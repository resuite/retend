// import { Cell } from 'retend';
import { Length } from 'retend-canvas';

// interface ListItem {
//   id: number;
//   name: string;
// }

// const list = Cell.source<ListItem[]>([]);

const App = () => {
  return (
    <>
      <rect
        style={{
          fontSize: Length.Px(80),
          width: Length.FitContent,
        }}
      >
        todos
      </rect>
    </>
  );
};

export default App;
