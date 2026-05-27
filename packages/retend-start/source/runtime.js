import { createRequire } from 'node:module';
import process from 'node:process';

import CONFIG from '../config.json' with { type: 'json' };

export { CONFIG };

export const require = createRequire(import.meta.url);
export const args = process.argv.slice(2);
export const isBun = process.versions.bun;
export const npmUserAgent = process.env.npm_config_user_agent ?? '';
export const isPnpm = npmUserAgent.startsWith('pnpm/');
