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
  const positionTopLeft = Cell.derived(
    () => panel.panelPosition.get() === 'top-left'
  );
  const positionTopRight = Cell.derived(
    () => panel.panelPosition.get() === 'top-right'
  );
  const positionBottomLeft = Cell.derived(
    () => panel.panelPosition.get() === 'bottom-left'
  );
  const positionBottomRight = Cell.derived(
    () => panel.panelPosition.get() === 'bottom-right'
  );

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

  // The host can connect before its ShadowRoot is attached.
  onConnected(panelRef, (panelElement) => {
    const root = panelElement.getRootNode();
    if (!(root instanceof window.ShadowRoot)) return;
    const host = root.host;
    if (!(host instanceof HTMLElement)) return;

    // Modal dialogs make elements outside them inert, including other popovers.
    // A manual popover inside the current modal stays interactive in the top layer.
    let pendingFrame: number | null = null;
    const syncTopLayer = () => {
      pendingFrame = null;
      const modals =
        document.querySelectorAll<HTMLDialogElement>('dialog:modal');
      const container = modals.item(modals.length - 1) ?? document.body;
      if (!host.isConnected) {
        // The previous container was removed with us in it (e.g. an HMR
        // range replacement deleted the open dialog). Re-attach instead
        // of vanishing.
        container.append(host);
      } else {
        if (host.matches(':popover-open')) host.hidePopover();
        if (host.parentElement !== container) container.append(host);
      }
      if (!host.matches(':popover-open')) host.showPopover();
    };
    const scheduleSync = () => {
      if (pendingFrame !== null) return;
      pendingFrame = requestAnimationFrame(syncTopLayer);
    };
    syncTopLayer();

    const observer = new MutationObserver((records) => {
      if (
        records.some(
          ({ target, removedNodes, type }) =>
            target instanceof HTMLDialogElement ||
            (type === 'childList' &&
              Array.from(removedNodes).some(
                (node) =>
                  node instanceof HTMLDialogElement ||
                  node === host ||
                  (node instanceof Element && node.contains(host))
              ))
        )
      ) {
        scheduleSync();
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['open'],
      subtree: true,
      childList: true,
    });
    const onToggle = (event: Event) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target !== host &&
        target.hasAttribute('popover')
      ) {
        scheduleSync();
      }
    };
    document.addEventListener('toggle', onToggle, true);

    const styleFrame = requestAnimationFrame(() => {
      const styleTag = document.getElementById(VITE_STYLE_ID);
      if (!styleTag) return;
      const stylesheet = new CSSStyleSheet();
      stylesheet.replace(styleTag.innerHTML).then((sheet) => {
        if (host.isConnected) root.adoptedStyleSheets.push(sheet);
      });
    });

    return () => {
      observer.disconnect();
      document.removeEventListener('toggle', onToggle, true);
      cancelAnimationFrame(styleFrame);
      if (pendingFrame !== null) cancelAnimationFrame(pendingFrame);
      if (host.matches(':popover-open')) host.hidePopover();
    };
  });

  return (
    <Teleport to="body">
      <retend-web-devtools popover="manual">
        <ShadowRoot>
          <div
            ref={panelRef}
            data-retend-devtools
            class={[
              classes.panel,
              {
                [classes.positionTopLeft]: positionTopLeft,
                [classes.positionTopRight]: positionTopRight,
                [classes.positionBottomLeft]: positionBottomLeft,
                [classes.positionBottomRight]: positionBottomRight,
                [classes.isDragging]: isDragging,
                [classes.isFlinging]: isFlinging,
              },
            ]}
            style={panelStyle}
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
                  data-picker-is-active={devRenderer.isPickerActive}
                  class={classes.content}
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
                    <PanelHeaderTools panel={panel} />
                  </div>
                </div>
              </div>
            ))}
            <HighlightOverlay />
            <button
              type="button"
              aria-label="Toggle Retend DevTools"
              title="Toggle Retend DevTools"
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
