import { Cell, If, onConnected } from 'retend';
import { ShadowRoot, Teleport } from 'retend-web';

import { ComponentTree } from '@/components/ComponentTree';
import { HighlightOverlay } from '@/components/HighlightOverlay';
import { InspectorPanel } from '@/components/InspectorPanel';
import { PanelHeaderTools } from '@/components/PanelHeaderTools';
import { useDevToolsRenderer } from '@/core/DevToolsRendererScope';
import { usePanelState } from '@/hooks/usePanelState';
import classes from '@/styles/Panel.module.css';

const VITE_STYLE_KEY = '[data-vite-dev-id*="retend-web-devtools"]';

export function Panel() {
  const devRenderer = useDevToolsRenderer();
  const panel = usePanelState();
  const divRef = Cell.source<HTMLElement | null>(null);
  const inspectorIsOpen = Cell.derived(
    () => devRenderer.selectedNode.get() !== null
  );

  const togglePanel = () => {
    const nextState = !panel.panelIsOpen.get();
    panel.togglePanel();
    if (!nextState) {
      Cell.batch(() => {
        devRenderer.hoveredNode.set(null);
        devRenderer.selectedNode.set(null);
        devRenderer.pickerCursorPosition.set(null);
        devRenderer.pickerHoveredElement.set(null);
        devRenderer.isPickerActive.set(false);
      });
    }
  };

  onConnected(divRef, (div) => {
    requestAnimationFrame(() => {
      const styleTags = document.querySelectorAll(VITE_STYLE_KEY);
      for (const styleTag of styleTags) {
        const stylesheet = new CSSStyleSheet();
        stylesheet.replace(styleTag.innerHTML).then((sheet) => {
          div.shadowRoot?.adoptedStyleSheets.push(sheet);
        });
      }
    });
  });

  return (
    <Teleport to="body">
      <retend-web-devtools ref={divRef} style={{ display: 'contents' }}>
        <ShadowRoot>
          <div
            class={[
              classes.panel,
              {
                [classes.positionTopLeft]: Cell.derived(
                  () => panel.panelPosition.get() === 'top-left'
                ),
                [classes.positionTopRight]: Cell.derived(
                  () => panel.panelPosition.get() === 'top-right'
                ),
                [classes.positionBottomLeft]: Cell.derived(
                  () => panel.panelPosition.get() === 'bottom-left'
                ),
                [classes.positionBottomRight]: Cell.derived(
                  () => panel.panelPosition.get() === 'bottom-right'
                ),
              },
            ]}
            data-retend-devtools
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
                <div
                  class={classes.content}
                  data-picker-is-active={devRenderer.isPickerActive}
                >
                  <div class={classes.header}>
                    <span class={classes.title}>Component Tree</span>
                    <PanelHeaderTools panel={panel} />
                  </div>
                  <div class={classes.body}>
                    <ComponentTree />
                  </div>
                  {If(inspectorIsOpen, () => (
                    <InspectorPanel />
                  ))}
                </div>
              </div>
            ))}
            <HighlightOverlay />
            <button
              type="button"
              class={[
                classes.button,
                { [classes.buttonOpen]: panel.panelIsOpen },
              ]}
              onClick={togglePanel}
            >
              RT
            </button>
          </div>
        </ShadowRoot>
      </retend-web-devtools>
    </Teleport>
  );
}
