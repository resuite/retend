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
                {For(inspector.renderedByItems, (item) => {
                  return (
                    <div
                      class={[
                        classes.renderedByItem,
                        {
                          [classes.renderedByItemLast]: item.isLast,
                        },
                      ]}
                      style={{ '--indent': `${item.index * 0.75}rem` }}
                    >
                      <span class={classes.renderedByIcon}>
                        <ChevronRightIcon />
                      </span>
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
