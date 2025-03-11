import { Modes, setGlobalContext } from '@adbl/unfinished';
import { VWindow } from '@adbl/unfinished/v-dom';

export const routerSetup = () => {
  const window = new VWindow();
  window.document.body.append(
    window.document.createElement('unfinished-router-outlet')
  );

  setGlobalContext({
    mode: Modes.VDom,
    window,
    consistentValues: new Map(),
    teleportIdCounter: { value: 0 },
  });
};
