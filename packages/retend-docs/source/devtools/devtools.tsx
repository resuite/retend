import { __HMR_UpdatableFn, getActiveRenderer } from 'retend';
import { DOMRenderer } from 'retend-web';
import { JSX } from 'retend/jsx-runtime';

import { DevToolsDOMRenderer } from './devtools-renderer';
import { MainContent } from './MainContent';
import { Panel } from './Panel';

interface RetendDevToolsProps {
  children: JSX.Children;
}

export function RetendDevTools(props: RetendDevToolsProps) {
  const { children } = props;
  const mainRenderer = getActiveRenderer() as DOMRenderer;
  const devRenderer = new DevToolsDOMRenderer(mainRenderer.host);

  return (
    <>
      <MainContent devRenderer={devRenderer}>{children}</MainContent>
      <Panel devRenderer={devRenderer} />
    </>
  );
}
