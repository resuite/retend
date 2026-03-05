/// <reference types="vite/client" />
import type { JSX } from 'retend/jsx-runtime';

import type { PanelPosition } from './core/devtools-renderer';

interface RetendDevToolsProps {
  children: JSX.Children;
  initialPosition?: PanelPosition;
}

export function RetendDevTools(props: RetendDevToolsProps): JSX.Template {
  return <>{props.children}</>;
}
