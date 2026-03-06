import type { __HMR_UpdatableFn } from 'retend';

import classes from '@/styles/ComponentTree.module.css';

interface ComponentNameProps {
  component: __HMR_UpdatableFn;
}

export function ComponentName(props: ComponentNameProps) {
  const { component } = props;
  const name = component.name || '[Anonymous]';

  return (
    <>
      <span class={classes.angleBrackets}>&lt;</span>
      {name}
      <span class={classes.angleBrackets}> /&gt;</span>
    </>
  );
}
