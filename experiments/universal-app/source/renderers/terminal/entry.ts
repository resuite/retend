import { TerminalHost, TerminalRenderer, TerminalScreen } from './renderer';
import { runPendingSetupEffects, setActiveRenderer } from 'retend';
import App from '../../App';

const screen = new TerminalScreen();

// Create Host
const host = new TerminalHost(screen);
const renderer = new TerminalRenderer(host);
setActiveRenderer(renderer);

const container = renderer.createContainer('root', {});
renderer.append(container, renderer.handleComponent(App, {}));

renderer.render();
runPendingSetupEffects();