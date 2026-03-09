/// <reference types="vite/client" />
import type { JSX } from 'retend/jsx-runtime';

interface RetendDevToolsProps {
  children: JSX.Children;
}

export function RetendDevTools(props: RetendDevToolsProps): JSX.Template {
  return <>{props.children}</>;
}
