import { Cell, For, If } from 'retend';

import { CloseIcon, ChevronRightIcon } from '@/components/icons';
import { InspectorPropsTable } from '@/components/InspectorPropsTable';
import { useDevToolsRenderer } from '@/core/DevToolsRendererScope';
import { useInspectorPanelData } from '@/hooks/useInspectorPanelData';
import classes from '@/styles/InspectorPanel.module.css';

export function InspectorPanel() {
  const devRenderer = useDevToolsRenderer();
  const inspector = useInspectorPanelData();
  const componentName = Cell.derived(() => {
    const selectedNode = devRenderer.selectedNode.get();
    if (!selectedNode) {
      return '[Anonymous]';
    }

    const name = selectedNode.component.name;
    if (name === '') {
      return '[Anonymous]';
    }

    return name;
  });
  const hasRenderedBy = Cell.derived(() => {
    return inspector.renderedByItems.get().length > 0;
  });

  const reversedRenderedByItems = Cell.derived(() => {
    return inspector.renderedByItems.get().slice().reverse();
  });
  const totalParents = Cell.derived(() => reversedRenderedByItems.get().length);

  return (
    <div class={classes.sideInspector}>
      <div class={classes.sideInspectorHeader}>
        <span class={classes.sideInspectorTitle}>Inspector</span>
        <button
          type="button"
          class={classes.sideInspectorClose}
          onClick={inspector.closeInspector}
          aria-label="Close inspector"
          title="Close inspector"
        >
          <CloseIcon />
        </button>
      </div>
      <div class={classes.sideInspectorSection}>
        <div class={classes.sideInspectorLabel}>Component</div>
        <div
          class={[
            classes.sideInspectorValue,
            classes.sideInspectorComponentName,
          ]}
        >
          {componentName}
        </div>
      </div>
      <div class={classes.sideInspectorSection}>
        <div class={classes.sideInspectorLabel}>Props</div>
        <div class={classes.sideInspectorValue}>
          <InspectorPropsTable />
        </div>
      </div>
      {If(hasRenderedBy, () => {
        return (
          <div class={classes.sideInspectorSection}>
            <div class={classes.sideInspectorLabel}>Rendered by</div>
            <div class={classes.sideInspectorValue}>
              <div class={classes.renderedByList}>
                {For(reversedRenderedByItems, (item) => {
                  const isFirstVisual = item.isLast;
                  return (
                    <div
                      class={[
                        classes.renderedByItem,
                        {
                          [classes.renderedByItemFirst]: isFirstVisual,
                        },
                      ]}
                      style={{
                        opacity: `max(0.3, ${item.index + 1} / ${totalParents.get()})`,
                      }}
                    >
                      {If(!isFirstVisual, () => (
                        <span
                          class={classes.renderedBySeparator}
                          style="transform: rotate(180deg)"
                        >
                          <ChevronRightIcon />
                        </span>
                      ))}
                      <span class={classes.renderedByName}>
                        {item.componentName}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
