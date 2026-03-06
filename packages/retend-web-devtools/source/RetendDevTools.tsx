/// <reference types="vite/client" />
import { __HMR_UpdatableFn, getActiveRenderer } from 'retend';
import { DOMRenderer } from 'retend-web';
import { JSX } from 'retend/jsx-runtime';

import { MainContent } from '@/components/MainContent';
import { Panel } from '@/components/Panel';
import '@/styles/DevToolsTheme.css';
import { DevToolsDOMRenderer } from '@/core/devtools-renderer';
import { DevToolsRendererScope } from '@/core/DevToolsRendererScope';

interface RetendDevToolsProps {
  children: JSX.Children;
}

export function RetendDevTools(props: RetendDevToolsProps) {
  const { children } = props;
  const mainRenderer = getActiveRenderer() as DOMRenderer;
  const devRenderer = new DevToolsDOMRenderer(mainRenderer.host);

  return (
    <DevToolsRendererScope.Provider value={devRenderer}>
      <MainContent>{children}</MainContent>
      <Panel />
    </DevToolsRendererScope.Provider>
  );
}
