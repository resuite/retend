import { Cell, For, If } from 'retend';

import { CloseIcon } from '@/components/icons';
import { InspectorPropsTable } from '@/components/InspectorPropsTable';
import { RenderedByItem } from '@/components/RenderedByItem';
import { useDevToolsRenderer } from '@/core/DevToolsRendererScope';
import { useInspectorPanelData } from '@/hooks/useInspectorPanelData';
import classes from '@/styles/InspectorPanel.module.css';
import { getComponentName } from '@/utils/sourceMapUtils';

export function InspectorPanel() {
  const devRenderer = useDevToolsRenderer();
  const inspector = useInspectorPanelData();
  const componentName = Cell.derived(() => {
    const selectedNode = devRenderer.selectedNode.get();
    if (!selectedNode) return '[Anonymous]';
    return getComponentName(selectedNode, devRenderer.nameCache);
  });
  const hasRenderedBy = Cell.derived(() => {
    return inspector.renderedByItems.get().length > 0;
  });

  const reversedRenderedByItems = Cell.derived(() => {
    return inspector.renderedByItems.get().toReversed();
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
      {If(hasRenderedBy, () => (
        <div class={classes.sideInspectorSection}>
          <div class={classes.sideInspectorLabel}>Rendered by</div>
          <div class={classes.sideInspectorValue}>
            <div class={classes.renderedByList}>
              {For(reversedRenderedByItems, (item) => (
                <RenderedByItem item={item} totalParents={totalParents} />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
