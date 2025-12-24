// Workaround: Retend types seem to be missing the factory exports in index.d.ts
// We import the implementation but define types locally or cast them.

// @ts-ignore
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from 'retend/jsx-runtime';

export const jsx: any = _jsx;
export const jsxs: any = _jsxs;
export const Fragment: any = _Fragment;
