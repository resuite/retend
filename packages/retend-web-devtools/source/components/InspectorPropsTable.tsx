import { For, If } from 'retend';
import { Link, Outlet } from 'retend/router';

import type { ComponentTreeNode } from '../core/devtools-renderer';

import classes from '../styles/Panel.module.css';
import { InspectorPropValue } from './InspectorPropValue';

interface InspectorPropsTableProps {
  node: ComponentTreeNode;
}

export function InspectorPropsTable(props: InspectorPropsTableProps) {
  const { node } = props;
  const isRouterLink = node.component === Link;
  const isRouterOutlet = node.component === Outlet;

  const rows: Array<{ key: string; value: unknown }> = [];
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
        rows.push({ key, value });
      }
    }
  }

  return (
    <>
      {If(rows.length > 0, {
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
