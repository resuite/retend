import { For, If, type Cell } from 'retend';

import type { ComponentTreeNode } from '@/core/devtools-renderer';

import { CloseIcon, SearchIcon } from '@/components/icons';
import { TreeNode } from '@/components/TreeNode';
import { useDevToolsRenderer } from '@/core/DevToolsRendererScope';
import { useComponentTreeSearch } from '@/hooks/useComponentTreeSearch';
import classes from '@/styles/ComponentTree.module.css';

interface ComponentTreeSearchProps {
  roots: Cell<Array<ComponentTreeNode>>;
}

export function ComponentTreeSearch(props: ComponentTreeSearchProps) {
  const devRenderer = useDevToolsRenderer();
  const search = useComponentTreeSearch({
    roots: props.roots,
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

      {For(props.roots, (root) => (
        <TreeNode
          node={root}
          depth={0}
          forceExpanded={search.forceExpanded}
          visibleNodes={search.visibleNodes}
        />
      ))}
    </>
  );
}
