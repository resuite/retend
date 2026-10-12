import { Cell, For, If, onSetup } from 'retend';

import { CheckIcon, CloseIcon, CodeIcon, ImageIcon } from '@/components/icons';
import { InspectorPropsTable } from '@/components/InspectorPropsTable';
import { RenderedByItem } from '@/components/RenderedByItem';
import { useDevToolsRenderer } from '@/core/DevToolsRendererScope';
import { useInspectorPanelData } from '@/hooks/useInspectorPanelData';
import classes from '@/styles/InspectorPanel.module.css';
import headerButtonClasses from '@/styles/PickerButton.module.css';
import { getComponentDefinition } from '@/utils/componentDefinition';
import { copyComponentScreenshot } from '@/utils/copyComponentScreenshot';
import { getComponentName } from '@/utils/sourceMapUtils';

export function InspectorPanel() {
  const devRenderer = useDevToolsRenderer();
  const inspector = useInspectorPanelData();
  const componentName = Cell.derived(() => {
    const selectedNode = devRenderer.selectedNode.get();
    return selectedNode
      ? getComponentName(selectedNode, devRenderer.nameCache)
      : '[Anonymous]';
  });
  const definition = Cell.derived(() => {
    const node = devRenderer.selectedNode.get();
    return node ? getComponentDefinition(node) : null;
  });
  const sourceTitle = Cell.derived(() => {
    const location = definition.get();
    return location
      ? `Open definition: ${location.fileName}:${location.lineNumber}`
      : 'Open component definition';
  });
  const sourceError = Cell.source<string | null>(null);
  const sourcePending = Cell.source(false);

  const viewSource = async () => {
    const location = definition.get();
    if (!location || sourcePending.get()) return;
    sourcePending.set(true);
    sourceError.set(null);
    try {
      const file = `${location.fileName}:${location.lineNumber}:${location.columnNumber}`;
      const response = await fetch(
        `/__open-in-editor?file=${encodeURIComponent(file)}`
      );
      if (!response.ok) {
        throw new Error(
          (await response.text()) || 'Could not open component definition'
        );
      }
    } catch (error) {
      sourceError.set(
        error instanceof Error
          ? error.message
          : 'Could not open component definition'
      );
    } finally {
      sourcePending.set(false);
    }
  };

  const screenshotError = Cell.source<string | null>(null);
  const hasCopiedScreenshot = Cell.source(false);
  const copyScreenshotTask = Cell.task(async () => {
    const selectedNode = devRenderer.selectedNode.get();
    if (!selectedNode) throw new Error('No component selected');
    await copyComponentScreenshot(selectedNode);
  });
  const screenshotLabel = Cell.derived(() => {
    if (hasCopiedScreenshot.get()) return 'Screenshot copied';
    if (copyScreenshotTask.pending.get()) return 'Copying screenshot';
    return 'Copy screenshot as PNG';
  });
  let copiedStateTimeout: ReturnType<typeof setTimeout> | null = null;

  const copyScreenshot = async () => {
    if (copyScreenshotTask.pending.get()) return;
    hasCopiedScreenshot.set(false);
    screenshotError.set(null);
    await copyScreenshotTask.runWith(undefined);
    if (copyScreenshotTask.error.get()) {
      screenshotError.set('Could not copy screenshot for selected component');
      return;
    }
    hasCopiedScreenshot.set(true);
    if (copiedStateTimeout) clearTimeout(copiedStateTimeout);
    copiedStateTimeout = setTimeout(() => {
      hasCopiedScreenshot.set(false);
      copiedStateTimeout = null;
    }, 1500);
  };

  onSetup(() => () => {
    if (copiedStateTimeout) clearTimeout(copiedStateTimeout);
  });

  const renderedByItems = Cell.derived(() =>
    inspector.renderedByItems.get().toReversed()
  );
  const hasParents = Cell.derived(() => renderedByItems.get().length > 0);
  const totalParents = Cell.derived(() => renderedByItems.get().length);

  return (
    <div class={classes.sideInspector}>
      <div class={classes.sideInspectorHeader}>
        <span class={classes.sideInspectorTitle}>Inspector</span>
        <div
          class={classes.inspectorActions}
          role="toolbar"
          aria-label="Component actions"
        >
          {If(definition, () => (
            <button
              type="button"
              class={headerButtonClasses.headerButton}
              onClick={() => void viewSource()}
              disabled={sourcePending}
              aria-label="Open component definition in editor"
              title={sourceTitle}
            >
              <CodeIcon />
            </button>
          ))}
          <button
            type="button"
            class={headerButtonClasses.headerButton}
            onClick={() => void copyScreenshot()}
            disabled={copyScreenshotTask.pending}
            aria-label={screenshotLabel}
            title={screenshotLabel}
          >
            {If(hasCopiedScreenshot, {
              true: () => <CheckIcon />,
              false: () => <ImageIcon />,
            })}
          </button>
          <button
            type="button"
            class={headerButtonClasses.headerButton}
            onClick={inspector.closeInspector}
            aria-label="Close inspector"
            title="Close inspector"
          >
            <CloseIcon />
          </button>
        </div>
      </div>
      <div class={classes.sideInspectorDetails}>
        {If(sourceError, () => (
          <p class={classes.inspectorActionError} role="alert">
            {sourceError}
          </p>
        ))}
        {If(screenshotError, () => (
          <p class={classes.inspectorActionError} role="alert">
            {screenshotError}
          </p>
        ))}
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
        {If(hasParents, () => (
          <details
            class={[classes.sideInspectorSection, classes.inspectorAncestry]}
          >
            <summary
              class={[
                classes.sideInspectorLabel,
                classes.inspectorAncestryToggle,
              ]}
            >
              Rendered by <span>{totalParents}</span>
            </summary>
            <div class={classes.sideInspectorValue}>
              <div class={classes.renderedByList}>
                {For(renderedByItems, (item) => (
                  <RenderedByItem item={item} totalParents={totalParents} />
                ))}
              </div>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
