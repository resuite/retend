import { TerminalHost, TerminalRenderer, TerminalScreen } from "./renderer";
import { setActiveRenderer } from "retend";
import App from "./App";

// Initialize Terminal Screen (Custom Renderer)
const screen = new TerminalScreen();

// Create Host
const host = new TerminalHost(screen);
// setActiveRenderer(host); // Host is not a renderer

// Create Renderer
const renderer = new TerminalRenderer(host);
setActiveRenderer(renderer);

// Create Root Container
const container = renderer.createContainer("root", {});

// --- Execute App ---
// App is a functional component. When called, it uses the active renderer (set above).
// It returns nodes. We append them to our root container.
const appNodes = renderer.handleComponent(App as any, {});
renderer.append(container, appNodes as any[]);

// Initial Render
renderer.render();
