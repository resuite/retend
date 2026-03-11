import { renderToCLI } from '../../index.js';
import { TodoList } from './TodoList.js';

function App() {
  return (
    <box width="100%" height="100%" alignItems="center" justifyContent="center">
      <TodoList />
    </box>
  );
}

await renderToCLI(App, {
  exitOnCtrlC: true,
  openConsoleOnError: true,
});
