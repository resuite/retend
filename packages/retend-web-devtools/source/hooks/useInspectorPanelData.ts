import type { ComponentTreeNode } from '../core/devtools-renderer';

import { useDevToolsRenderer } from '../core/DevToolsRendererScope';

interface RenderedByItem {
  componentName: string;
  index: number;
  isLast: boolean;
}

interface InspectorPanelData {
  closeInspector: () => void;
  definitionLocation: string;
  definitionLocationEnd: string;
  definitionLocationMiddle: string;
  definitionLocationStart: string;
  openInEditor: () => void;
  renderedByItems: RenderedByItem[];
  showDefinitionLocation: boolean;
}

const MAX_LOCATION_LENGTH = 48;
const LOCATION_ELLIPSIS_TOKEN = ' /.../ ';
const ROOT_MARKER = '/retend/';

export function useInspectorPanelData(
  selectedNode: ComponentTreeNode
): InspectorPanelData {
  const devRenderer = useDevToolsRenderer();
  let editorTarget = '';

  const closeInspector = () => {
    devRenderer.selectedNode.set(null);
  };

  let definitionLocation = 'Unknown component definition';
  let showDefinitionLocation = false;
  const fileData = selectedNode.fileData;
  if (fileData) {
    showDefinitionLocation = true;
    editorTarget = `${fileData.fileName}:${fileData.lineNumber}:${fileData.columnNumber}`;
    let fileName = fileData.fileName;
    const rootMarkerIndex = fileData.fileName.lastIndexOf(ROOT_MARKER);
    if (rootMarkerIndex > -1) {
      fileName = fileData.fileName.slice(rootMarkerIndex + ROOT_MARKER.length);
    }
    definitionLocation = `${fileName}:${fileData.lineNumber}:${fileData.columnNumber}`;
  }

  let definitionLocationStart = definitionLocation;
  let definitionLocationMiddle = '';
  let definitionLocationEnd = '';
  if (definitionLocation.length > MAX_LOCATION_LENGTH) {
    const leftLength = Math.floor(
      (MAX_LOCATION_LENGTH - LOCATION_ELLIPSIS_TOKEN.length) / 2
    );
    const rightLength =
      MAX_LOCATION_LENGTH - leftLength - LOCATION_ELLIPSIS_TOKEN.length;
    definitionLocationStart = definitionLocation.slice(0, leftLength);
    definitionLocationMiddle = LOCATION_ELLIPSIS_TOKEN;
    definitionLocationEnd = definitionLocation.slice(
      definitionLocation.length - rightLength
    );
  }

  const openInEditor = () => {
    if (editorTarget === '') {
      return;
    }
    const endpoint = `/__open-in-editor?file=${encodeURIComponent(editorTarget)}`;
    window.fetch(endpoint).catch(() => {});
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
    definitionLocation,
    definitionLocationEnd,
    definitionLocationMiddle,
    definitionLocationStart,
    openInEditor,
    renderedByItems,
    showDefinitionLocation,
  };
}
