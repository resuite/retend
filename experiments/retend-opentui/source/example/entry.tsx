import { createCliRenderer } from '@opentui/core';
import { runPendingSetupEffects, setActiveRenderer } from 'retend';

import { OpenTuiRenderer } from '../cli-renderer';
import { TodoList } from './TodoList';

function App() {
  return (
    <box width="100%" height="100%" alignItems="center" justifyContent="center">
      <TodoList />
    </box>
  );
}

const coreRenderer = await createCliRenderer({
  exitOnCtrlC: true,
  openConsoleOnError: true,
});
const tuiRenderer = new OpenTuiRenderer(coreRenderer);
setActiveRenderer(tuiRenderer);

tuiRenderer.render(<App />);
await runPendingSetupEffects();
