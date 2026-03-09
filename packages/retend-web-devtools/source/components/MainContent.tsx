import type { DOMRenderer } from 'retend-web';
import type { JSX } from 'retend/jsx-runtime';

import { getActiveRenderer, setActiveRenderer } from 'retend';

import { useDevToolsRenderer } from '@/core/DevToolsRendererScope';

interface MainContentProps {
  children: JSX.Children;
}

export function MainContent(props: MainContentProps) {
  const { children } = props;
  const devRenderer = useDevToolsRenderer();

  const mainRenderer = getActiveRenderer() as DOMRenderer;
  setActiveRenderer(devRenderer);
  try {
    const renderOutput = devRenderer.render(children as JSX.Element);
    return renderOutput;
  } finally {
    setActiveRenderer(mainRenderer);
  }
}
