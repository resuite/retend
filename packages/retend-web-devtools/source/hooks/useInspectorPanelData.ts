import type { ComponentTreeNode } from '../core/devtools-renderer';

import { useDevToolsRenderer } from '../core/DevToolsRendererScope';

interface RenderedByItem {
  componentName: string;
  index: number;
  isLast: boolean;
}

interface InspectorPanelData {
  closeInspector: () => void;
  renderedByItems: RenderedByItem[];
}

export function useInspectorPanelData(
  selectedNode: ComponentTreeNode
): InspectorPanelData {
  const devRenderer = useDevToolsRenderer();

  const closeInspector = () => {
    devRenderer.selectedNode.set(null);
  };

  const renderedByNames: string[] = [];
  let parent = devRenderer.parentMap.get(selectedNode);
  while (parent) {
    let componentName = parent.component.name;
    if (componentName === '') {
      componentName = '[Anonymous]';
    }
    renderedByNames.push(componentName);
    parent = devRenderer.parentMap.get(parent);
  }

  const reversedNames = renderedByNames.toReversed();
  const renderedByItems = reversedNames.map((componentName, index) => ({
    componentName,
    index,
    isLast: index === reversedNames.length - 1,
  }));

  return {
    closeInspector,
    renderedByItems,
  };
}
