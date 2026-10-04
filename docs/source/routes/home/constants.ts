import type { JSX } from 'retend/jsx-runtime';

export const GITHUB_URL = 'https://github.com/resuite/retend';
export const GPUI_DOCS_URL = '/docs/gpui-overview';
export const CREATE_COMMAND = 'pnpm dlx retend-start@latest my-app';

export type ClassValue = JSX.ValueOrCell<string | string[] | object>;

/** Horizontal padding shared by every section inside the page frame. */
export const FRAME_PAD = 'px-5 sm:px-8 md:px-10';
