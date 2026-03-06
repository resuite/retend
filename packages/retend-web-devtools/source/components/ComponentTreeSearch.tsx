import { Cell, If } from 'retend';

import type { ComponentTreeNode } from '@/core/devtools-renderer';

import { CloseIcon, SearchIcon } from '@/components/icons';
import { TreeNode } from '@/components/TreeNode';
import { useDevToolsRenderer } from '@/core/DevToolsRendererScope';
import { useComponentTreeSearch } from '@/hooks/useComponentTreeSearch';
import classes from '@/styles/ComponentTree.module.css';

interface ComponentTreeSearchProps {
  root: ComponentTreeNode;
}

export function ComponentTreeSearch(props: ComponentTreeSearchProps) {
  const devRenderer = useDevToolsRenderer();
  const inspectorIsOpen = Cell.derived(() => {
    return devRenderer.selectedNode.get() !== null;
  });
  const search = useComponentTreeSearch({
    root: props.root,
    getNodeChildren: devRenderer.getNodeChildren.bind(devRenderer),
  });

  return (
    <>
      <div class={classes.searchRow}>
        <span class={classes.searchIconWrap}>
          <SearchIcon />
        </span>
        <input
          class={classes.searchInput}
          placeholder="Search…"
          value={search.searchQuery}
          onInput={search.onSearchInput}
        />
        {If(search.isSearching, () => (
          <div class={classes.searchTrailing}>
            <span class={classes.matchCount}>{search.matchCount}</span>
            <button
              type="button"
              class={classes.clearButton}
              onClick={search.clearSearch}
              aria-label="Clear search"
            >
              <CloseIcon />
            </button>
          </div>
        ))}
      </div>
      <div
        class={[
          classes.treeContent,
          { [classes.treeContentWithInspector]: inspectorIsOpen },
        ]}
      >
        <TreeNode
          node={props.root}
          depth={0}
          forceExpanded={search.forceExpanded}
          visibleNodes={search.visibleNodes}
        />
      </div>
    </>
  );
}
