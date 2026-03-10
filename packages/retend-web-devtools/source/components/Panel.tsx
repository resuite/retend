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
    const color = devRenderer.highlightColor.get();
    let theme = {
      '--retend-devtools-tree-accent': 'var(--retend-devtools-palette-amber)',
      '--retend-devtools-tree-text': '#f3e6c8',
      '--retend-devtools-tree-muted': '#9e8455',
      '--retend-devtools-attributes': '#ffd37a',
      '--retend-devtools-row-hover': 'rgba(245, 158, 11, 0.16)',
      '--retend-devtools-row-active': 'rgba(245, 158, 11, 0.28)',
      '--retend-devtools-chevron': '#c9a86a',
      '--retend-devtools-leaf-dot': '#8d6b32',
      '--retend-devtools-internal-core': '#ffd37a',
      '--retend-devtools-web-core': '#ffb44f',
      '--retend-devtools-children-border': 'rgba(245, 158, 11, 0.18)',
      '--retend-devtools-scope-provider': '#ffd0a8',
      '--retend-devtools-inspector-bg': 'rgba(245, 158, 11, 0.08)',
      '--retend-devtools-inspector-border': 'rgba(245, 158, 11, 0.18)',
      '--retend-devtools-inspector-text': '#f3e6c8',
      '--retend-devtools-inspector-title': '#d8b879',
    };

    if (color === 'blue') {
      theme = {
        '--retend-devtools-tree-accent': 'var(--retend-devtools-palette-blue)',
        '--retend-devtools-tree-text': '#dbeafe',
        '--retend-devtools-tree-muted': '#6f8fb3',
        '--retend-devtools-attributes': '#8fd3ff',
        '--retend-devtools-row-hover': 'rgba(66, 153, 225, 0.16)',
        '--retend-devtools-row-active': 'rgba(66, 153, 225, 0.28)',
        '--retend-devtools-chevron': '#8db7e6',
        '--retend-devtools-leaf-dot': '#4670a0',
        '--retend-devtools-internal-core': '#93c5fd',
        '--retend-devtools-web-core': '#67e8f9',
        '--retend-devtools-children-border': 'rgba(66, 153, 225, 0.18)',
        '--retend-devtools-scope-provider': '#c4b5fd',
        '--retend-devtools-inspector-bg': 'rgba(66, 153, 225, 0.08)',
        '--retend-devtools-inspector-border': 'rgba(66, 153, 225, 0.18)',
        '--retend-devtools-inspector-text': '#dbeafe',
        '--retend-devtools-inspector-title': '#93c5fd',
      };
    }

    if (color === 'pink') {
      theme = {
        '--retend-devtools-tree-accent': 'var(--retend-devtools-palette-pink)',
        '--retend-devtools-tree-text': '#ffe4f1',
        '--retend-devtools-tree-muted': '#b07a98',
        '--retend-devtools-attributes': '#ffb3d9',
        '--retend-devtools-row-hover': 'rgba(236, 72, 153, 0.16)',
        '--retend-devtools-row-active': 'rgba(236, 72, 153, 0.28)',
        '--retend-devtools-chevron': '#e7a3c6',
        '--retend-devtools-leaf-dot': '#9a5177',
        '--retend-devtools-internal-core': '#f9a8d4',
        '--retend-devtools-web-core': '#fda4af',
        '--retend-devtools-children-border': 'rgba(236, 72, 153, 0.18)',
        '--retend-devtools-scope-provider': '#f5d0fe',
        '--retend-devtools-inspector-bg': 'rgba(236, 72, 153, 0.08)',
        '--retend-devtools-inspector-border': 'rgba(236, 72, 153, 0.18)',
        '--retend-devtools-inspector-text': '#ffe4f1',
        '--retend-devtools-inspector-title': '#f9a8d4',
      };
    }

    if (color === 'green') {
      theme = {
        '--retend-devtools-tree-accent': 'var(--retend-devtools-palette-green)',
        '--retend-devtools-tree-text': '#ddfbe8',
        '--retend-devtools-tree-muted': '#74a386',
        '--retend-devtools-attributes': '#86efac',
        '--retend-devtools-row-hover': 'rgba(34, 197, 94, 0.16)',
        '--retend-devtools-row-active': 'rgba(34, 197, 94, 0.28)',
        '--retend-devtools-chevron': '#8fd0a9',
        '--retend-devtools-leaf-dot': '#4b8964',
        '--retend-devtools-internal-core': '#bef264',
        '--retend-devtools-web-core': '#5eead4',
        '--retend-devtools-children-border': 'rgba(34, 197, 94, 0.18)',
        '--retend-devtools-scope-provider': '#bbf7d0',
        '--retend-devtools-inspector-bg': 'rgba(34, 197, 94, 0.08)',
        '--retend-devtools-inspector-border': 'rgba(34, 197, 94, 0.18)',
        '--retend-devtools-inspector-text': '#ddfbe8',
        '--retend-devtools-inspector-title': '#86efac',
      };
    }

    if (color === 'red') {
      theme = {
        '--retend-devtools-tree-accent': 'var(--retend-devtools-palette-red)',
        '--retend-devtools-tree-text': '#fee2e2',
        '--retend-devtools-tree-muted': '#b48282',
        '--retend-devtools-attributes': '#fca5a5',
        '--retend-devtools-row-hover': 'rgba(239, 68, 68, 0.16)',
        '--retend-devtools-row-active': 'rgba(239, 68, 68, 0.28)',
        '--retend-devtools-chevron': '#eba3a3',
        '--retend-devtools-leaf-dot': '#9f5a5a',
        '--retend-devtools-internal-core': '#fca5a5',
        '--retend-devtools-web-core': '#fdba74',
        '--retend-devtools-children-border': 'rgba(239, 68, 68, 0.18)',
        '--retend-devtools-scope-provider': '#fecaca',
        '--retend-devtools-inspector-bg': 'rgba(239, 68, 68, 0.08)',
        '--retend-devtools-inspector-border': 'rgba(239, 68, 68, 0.18)',
        '--retend-devtools-inspector-text': '#fee2e2',
        '--retend-devtools-inspector-title': '#fca5a5',
      };
    }

    const nextStyle = style.get();

    if (!nextStyle) {
      return theme;
    }

    return {
      ...theme,
      ...nextStyle,
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
