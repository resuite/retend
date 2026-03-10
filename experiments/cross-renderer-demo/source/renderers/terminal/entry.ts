import { runPendingSetupEffects, setActiveRenderer } from 'retend';

import App from '../../App';
import { TerminalHost, TerminalRenderer, TerminalScreen } from './renderer';

const screen = new TerminalScreen();

// Create Host
const host = new TerminalHost(screen);
const renderer = new TerminalRenderer(host);
setActiveRenderer(renderer);

renderer.append(renderer.root, renderer.render(App()));
runPendingSetupEffects();
