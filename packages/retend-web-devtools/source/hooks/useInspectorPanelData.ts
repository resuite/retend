import { Cell } from 'retend';

import { useDevToolsRenderer } from '@/core/DevToolsRendererScope';
import { getComponentName } from '@/utils/sourceMapUtils';

interface RenderedByItem {
  componentName: string;
  index: number;
  isLast: boolean;
}

interface InspectorPanelData {
  closeInspector: () => void;
  renderedByItems: ReturnType<typeof Cell.derived<RenderedByItem[]>>;
}

export function useInspectorPanelData(): InspectorPanelData {
  const devRenderer = useDevToolsRenderer();

  const closeInspector = () => {
    devRenderer.selectedNode.set(null);
  };

  const renderedByItems = Cell.derived(() => {
    const selectedNode = devRenderer.selectedNode.get();
    if (!selectedNode) {
      return [];
    }

    const renderedByNames: string[] = [];
    let parent = devRenderer.parentMap.get(selectedNode);
    while (parent) {
      renderedByNames.push(getComponentName(parent, devRenderer.nameCache));
      parent = devRenderer.parentMap.get(parent);
    }

    const reversedNames = renderedByNames.toReversed();
    return reversedNames.map((componentName, index) => ({
      componentName,
      index,
      isLast: index === reversedNames.length - 1,
    }));
  });

  return {
    closeInspector,
    renderedByItems,
  };
}
