import { createRequire } from 'node:module';
import process from 'node:process';

import CONFIG from '../config.json' with { type: 'json' };
import PACKAGE from '../package.json' with { type: 'json' };

// Retend packages are released in lockstep, so a scaffolded project depends on
// the exact release of this scaffolder. Hand-maintained ranges drift: `^0.0.x`
// matches only that one patch, so a stale entry silently installs an old
// release.
for (const group of [CONFIG.dependencies, CONFIG.devDependencies]) {
  for (const name of Object.keys(group)) {
    if (name === 'retend' || name.startsWith('retend-')) {
      /** @type {Record<string, string>} */ (group)[name] = PACKAGE.version;
    }
  }
}

export { CONFIG };

export const require = createRequire(import.meta.url);
export const args = process.argv.slice(2);
export const isBun = process.versions.bun;
export const npmUserAgent = process.env.npm_config_user_agent ?? '';
export const isPnpm = npmUserAgent.startsWith('pnpm/');
