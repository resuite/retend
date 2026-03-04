import { Teleport } from 'retend-web';

import type { DevToolsDOMRenderer } from './devtools-renderer';

import classes from './Panel.module.css';

interface PanelProps {
  devRenderer: DevToolsDOMRenderer;
}

export function Panel(props: PanelProps) {
  props;
  // const { devRenderer } = props;

  return (
    <Teleport to="body">
      <div>
        <button class={classes.button} title="Open Devtools">
          RT
        </button>
      </div>
    </Teleport>
  );
}
