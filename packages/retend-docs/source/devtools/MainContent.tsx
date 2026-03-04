import type { JSX } from 'retend/jsx-runtime';

import { getActiveRenderer, setActiveRenderer } from 'retend';
import { DOMRenderer } from 'retend-web';

import type { DevToolsDOMRenderer } from './devtools-renderer';

interface MainContentProps {
  devRenderer: DevToolsDOMRenderer;
  children: JSX.Children;
}

export function MainContent(props: MainContentProps) {
  const { children, devRenderer } = props;

  const mainRenderer = getActiveRenderer() as DOMRenderer;
  setActiveRenderer(devRenderer);
  try {
    return <>{children}</>;
  } finally {
    setActiveRenderer(mainRenderer);
  }
}
