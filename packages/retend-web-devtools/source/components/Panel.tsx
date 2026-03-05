import { If } from 'retend';
import { Teleport } from 'retend-web';

import { useDevToolsRenderer } from '../core/DevToolsRendererScope';
import { usePanelState } from '../hooks/usePanelState';
import classes from '../styles/Panel.module.css';
import { ComponentTree } from './ComponentTree';
import { HighlightOverlay } from './HighlightOverlay';
import { InspectorPanel } from './InspectorPanel';
import { PanelHeaderTools } from './PanelHeaderTools';

export function Panel() {
  const devRenderer = useDevToolsRenderer();
  const panel = usePanelState();

  return (
    <Teleport to="body">
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
          class={[classes.button, { [classes.buttonOpen]: panel.panelIsOpen }]}
          onClick={panel.togglePanel}
        >
          RT
        </button>
      </div>
    </Teleport>
  );
}
