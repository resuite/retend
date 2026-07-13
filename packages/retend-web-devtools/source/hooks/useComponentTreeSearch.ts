import { Cell } from 'retend';

import type { ComponentTreeNode } from '@/core/devtools-renderer';

import { useDevToolsRenderer } from '@/core/DevToolsRendererScope';
import { getComponentName } from '@/utils/sourceMapUtils';

interface SearchResult {
  visible: Set<ComponentTreeNode>;
  matchCount: number;
}

interface UseComponentTreeSearchArgs {
  roots: Cell<Array<ComponentTreeNode>>;
  getNodeChildren: (node: ComponentTreeNode) => Cell<Array<ComponentTreeNode>>;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function collectAllNodes(
  roots: Array<ComponentTreeNode>,
  getChildren: (node: ComponentTreeNode) => Cell<Array<ComponentTreeNode>>
): Array<ComponentTreeNode> {
  const order: Array<ComponentTreeNode> = [];
  const stack = roots.toReversed();
  while (stack.length > 0) {
    const node = stack.pop();
    if (node) {
      order.push(node);
      const children = getChildren(node).get();
      for (let index = children.length - 1; index >= 0; index -= 1) {
        stack.push(children[index]);
      }
    }
  }
  return order;
}

function fuzzyMatch(name: string, query: string): boolean {
  let queryIndex = 0;
  for (const character of name) {
    if (character === query[queryIndex]) {
      queryIndex += 1;
      if (queryIndex === query.length) {
        return true;
      }
    }
  }
  return false;
}

export function useComponentTreeSearch(args: UseComponentTreeSearchArgs) {
  const { roots, getNodeChildren } = args;
  const devRenderer = useDevToolsRenderer();
  const searchQuery = Cell.source('');
  const normalizedSearchQuery = Cell.derived(() =>
    searchQuery.get().trim().toLowerCase()
  );
  const isSearching = Cell.derived(() => normalizedSearchQuery.get() !== '');
  const forceExpanded = isSearching;

  const initialNodes = collectAllNodes(roots.get(), getNodeChildren);
  const searchResult = Cell.source<SearchResult>({
    visible: new Set(initialNodes),
    matchCount: 0,
  });

  const asyncSearch = Cell.derivedAsync(async (get) => {
    const query = get(normalizedSearchQuery);
    const currentRoots = get(roots);
    if (query === '') {
      return {
        visible: new Set<ComponentTreeNode>(),
        matchCount: 0,
      } satisfies SearchResult;
    }

    await delay(80);

    const order = collectAllNodes(currentRoots, getNodeChildren);
    const visible = new Set<ComponentTreeNode>();
    const matchingBranch = new Set<ComponentTreeNode>();
    let matchCount = 0;

    for (let index = order.length - 1; index >= 0; index -= 1) {
      const node = order[index];
      const normalizedName = getComponentName(
        node,
        devRenderer.nameCache
      ).toLowerCase();
      const isDirectMatch = fuzzyMatch(normalizedName, query);

      let hasMatch = isDirectMatch;
      if (!hasMatch) {
        const children = getNodeChildren(node).get();
        for (const child of children) {
          if (matchingBranch.has(child)) {
            hasMatch = true;
            break;
          }
        }
      }

      if (hasMatch) {
        visible.add(node);
        matchingBranch.add(node);
      }
      if (isDirectMatch) {
        matchCount += 1;
      }
    }

    return { visible, matchCount } satisfies SearchResult;
  });

  asyncSearch.listen(async (result) => {
    const queryAtStart = normalizedSearchQuery.get();
    if (queryAtStart === '') return;

    const nextResult = await result;
    if (normalizedSearchQuery.get() === queryAtStart) {
      searchResult.set(nextResult);
    }
  });

  const visibleNodes = Cell.derived(() => {
    const query = normalizedSearchQuery.get();
    let visibleNodes: Set<ComponentTreeNode>;

    if (query === '') {
      visibleNodes = new Set(collectAllNodes(roots.get(), getNodeChildren));
    } else {
      visibleNodes = new Set(searchResult.get().visible);
    }

    let selectedNode = devRenderer.selectedNode.get();
    while (selectedNode) {
      visibleNodes.add(selectedNode);
      const parent = devRenderer.parentMap.get(selectedNode);
      if (!parent) {
        break;
      }
      selectedNode = parent;
    }

    return visibleNodes;
  });

  const matchCount = Cell.derived(() => {
    const query = normalizedSearchQuery.get();
    if (query === '') {
      return 0;
    }
    return searchResult.get().matchCount;
  });

  const onSearchInput = (event: Event) => {
    searchQuery.set((event.currentTarget as HTMLInputElement).value);
  };

  const clearSearch = () => {
    searchQuery.set('');
  };

  return {
    clearSearch,
    forceExpanded,
    isSearching,
    matchCount,
    onSearchInput,
    searchQuery,
    visibleNodes,
  };
}
