import { Cell, If, onConnected } from 'retend';
import { ShadowRoot, Teleport } from 'retend-web';

import { ComponentTree } from '@/components/ComponentTree';
import { HighlightOverlay } from '@/components/HighlightOverlay';
import { InspectorPanel } from '@/components/InspectorPanel';
import { PanelHeaderTools } from '@/components/PanelHeaderTools';
import { useDevToolsRenderer } from '@/core/DevToolsRendererScope';
import { useFling } from '@/hooks/useFling';
import { usePanelState } from '@/hooks/usePanelState';
import classes from '@/styles/Panel.module.css';

const VITE_STYLE_ID = '__retend-web-devtools-styling';

export function Panel() {
  const devRenderer = useDevToolsRenderer();
  const panel = usePanelState();
  const divRef = Cell.source<HTMLElement | null>(null);
  const panelRef = Cell.source<HTMLDivElement | null>(null);
  const inspectorIsOpen = Cell.derived(
    () => devRenderer.selectedNode.get() !== null
  );

  const {
    isDragging,
    isFlinging,
    style,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    getShouldSkipClick,
    setShouldSkipClick,
  } = useFling(panel, panelRef);
  const panelStyle = Cell.derived(() => {
    let accent = 'var(--retend-devtools-palette-amber)';
    const color = devRenderer.highlightColor.get();

    if (color === 'blue') {
      accent = 'var(--retend-devtools-palette-blue)';
    }

    if (color === 'pink') {
      accent = 'var(--retend-devtools-palette-pink)';
    }

    if (color === 'green') {
      accent = 'var(--retend-devtools-palette-green)';
    }

    if (color === 'red') {
      accent = 'var(--retend-devtools-palette-red)';
    }

    const nextStyle = style.get();

    if (!nextStyle) {
      return { '--retend-devtools-accent': accent };
    }

    return {
      ...nextStyle,
      '--retend-devtools-accent': accent,
    };
  });

  const togglePanel = () => {
    if (getShouldSkipClick()) {
      setShouldSkipClick(false);
      return;
    }
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
      const styleTag = document.getElementById(VITE_STYLE_ID);
      if (!styleTag) return;
      const stylesheet = new CSSStyleSheet();
      stylesheet.replace(styleTag.innerHTML).then((sheet) => {
        div.shadowRoot?.adoptedStyleSheets.push(sheet);
      });
    });
  });

  return (
    <Teleport to="body">
      <retend-web-devtools ref={divRef} style={{ display: 'contents' }}>
        <ShadowRoot>
          <div
            ref={panelRef}
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
                [classes.isDragging]: isDragging,
                [classes.isFlinging]: isFlinging,
              },
            ]}
            style={panelStyle}
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
                  <div class={classes.bodyContainer}>
                    <div class={classes.body}>
                      <ComponentTree />
                    </div>
                    {If(inspectorIsOpen, () => (
                      <InspectorPanel />
                    ))}
                  </div>
                  <div class={classes.header}>
                    <span class={classes.title}>Component Tree</span>
                    <PanelHeaderTools panel={panel} />
                  </div>
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
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            >
              RT
            </button>
          </div>
        </ShadowRoot>
      </retend-web-devtools>
    </Teleport>
  );
}
