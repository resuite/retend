import { For, If } from 'retend';

import type { ComponentTreeNode } from '../core/devtools-renderer';

import { useInspectorPanelData } from '../hooks/useInspectorPanelData';
import classes from '../styles/Panel.module.css';
import { ComponentName } from './ComponentName';
import { CloseIcon, ChevronRightIcon } from './icons';
import { InspectorPropsTable } from './InspectorPropsTable';

interface InspectorPanelProps {
  selectedNode: ComponentTreeNode;
}

export function InspectorPanel(props: InspectorPanelProps) {
  const { selectedNode } = props;
  const inspector = useInspectorPanelData(selectedNode);
  const hasRenderedBy = inspector.renderedByItems.length > 0;

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
          <ComponentName component={selectedNode.component} />
        </div>
      </div>
      <div class={classes.sideInspectorSection}>
        <div class={classes.sideInspectorLabel}>Props</div>
        <div class={classes.sideInspectorValue}>
          <InspectorPropsTable node={selectedNode} />
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
