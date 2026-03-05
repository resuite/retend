import { Cell, If, onConnected } from 'retend';
import { ShadowRoot, Teleport } from 'retend-web';

import { useDevToolsRenderer } from '../core/DevToolsRendererScope';
import { usePanelState } from '../hooks/usePanelState';
import classes from '../styles/Panel.module.css';
import { ComponentTree } from './ComponentTree';
import { HighlightOverlay } from './HighlightOverlay';
import { InspectorPanel } from './InspectorPanel';
import { PanelHeaderTools } from './PanelHeaderTools';

const VITE_STYLE_KEY = '[data-vite-dev-id*="retend-web-devtools"]';

export function Panel() {
  const devRenderer = useDevToolsRenderer();
  const panel = usePanelState();
  const divRef = Cell.source<HTMLElement | null>(null);

  onConnected(divRef, (div) => {
    requestAnimationFrame(() => {
      const styleTags = document.querySelectorAll(VITE_STYLE_KEY);
      for (const styleTag of styleTags) div.shadowRoot?.prepend(styleTag);
    });
  });

  return (
    <Teleport to="body">
      <div ref={divRef} style={{ display: 'contents' }}>
        <ShadowRoot>
          <div
            class={[
              classes.panel,
              {
                [classes.positionBottomRight]: panel.isBottomRight,
                [classes.positionBottomLeft]: panel.isBottomLeft,
                [classes.positionTopRight]: panel.isTopRight,
                [classes.positionTopLeft]: panel.isTopLeft,
              },
            ]}
            data-retend-devtools=""
          >
            {If(panel.panelIsOpen, () => (
              <div
                class={[
                  classes.panelWorkspace,
                  {
                    [classes.inspectorLeft]: panel.isInspectorLeft,
                    [classes.inspectorRight]: panel.isInspectorRight,
                  },
                ]}
              >
                <div class={classes.content}>
                  <div class={classes.header}>
                    <span class={classes.title}>Component Tree</span>
                    <PanelHeaderTools />
                  </div>
                  <div class={classes.body}>
                    <ComponentTree />
                  </div>
                </div>
                {If(devRenderer.selectedNode, (selectedNode) => (
                  <InspectorPanel selectedNode={selectedNode} />
                ))}
              </div>
            ))}
            <HighlightOverlay />
            <button
              type="button"
              class={[
                classes.button,
                { [classes.buttonOpen]: panel.panelIsOpen },
              ]}
              onClick={panel.togglePanel}
            >
              RT
            </button>
          </div>
        </ShadowRoot>
      </div>
    </Teleport>
  );
}
