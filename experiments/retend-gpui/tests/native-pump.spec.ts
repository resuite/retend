import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

it.runIf(process.platform === 'darwin')(
  'does not let a queued callback stop a replacement pump',
  () => {
    const addonUrl = new URL('../dist/native/addon.js', import.meta.url).href;
    const output = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `
          import assert from 'node:assert/strict';
          import { loadNativeAddon } from ${JSON.stringify(addonUrl)};
          const addon = loadNativeAddon();
          let previousCalls = 0;
          addon.startEventPump(() => previousCalls++);
          // Let CoreVideo enqueue a tick before Node can drain the callback.
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
          addon.stopEventPump();
          await new Promise(resolve => addon.startEventPump(resolve));
          assert.equal(previousCalls, 1);
          console.log('restarted');
        `,
      ],
      { encoding: 'utf8', timeout: 10_000, killSignal: 'SIGKILL' }
    );
    expect(output.trim()).toBe('restarted');
  },
  15_000
);
