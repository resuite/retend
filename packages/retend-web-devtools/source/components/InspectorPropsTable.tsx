import { Cell, For, If } from 'retend';
import { Link, Outlet } from 'retend/router';

import { InspectorPropValue } from '@/components/InspectorPropValue';
import { useDevToolsRenderer } from '@/core/DevToolsRendererScope';
import classes from '@/styles/InspectorPanel.module.css';
export function InspectorPropsTable() {
  const devRenderer = useDevToolsRenderer();
  const rows = Cell.derived(() => {
    const node = devRenderer.selectedNode.get();
    if (!node) {
      return [];
    }

    const isRouterLink = node.component === Link;
    const isRouterOutlet = node.component === Outlet;
    const nextRows: Array<{ key: string; value: unknown }> = [];

    if (Array.isArray(node.props)) {
      const propsData = node.props[0];
      if (propsData) {
        const entries = Object.entries(propsData as Record<string, unknown>);
        for (const [key, value] of entries) {
          if (key === 'children') {
            continue;
          }
          if (isRouterLink) {
            if (key === 'onClick') {
              continue;
            }
            if (key === 'active') {
              continue;
            }
          }
          if (isRouterOutlet) {
            if (key === 'data-path') {
              continue;
            }
          }
          nextRows.push({ key, value });
        }
      }
    }

    return nextRows;
  });
  const hasRows = Cell.derived(() => {
    return rows.get().length > 0;
  });

  return (
    <>
      {If(hasRows, {
        true: () => (
          <table class={classes.propsTable}>
            <tbody>
              {For(
                rows,
                (row) => (
                  <tr class={classes.propsRow}>
                    <th class={classes.propKey}>{row.key}</th>
                    <td class={classes.propValueCell}>
                      <InspectorPropValue value={row.value} />
                    </td>
                  </tr>
                ),
                { key: 'key' }
              )}
            </tbody>
          </table>
        ),
        false: () => <span class={classes.propsEmpty}>No props</span>,
      })}
    </>
  );
}
