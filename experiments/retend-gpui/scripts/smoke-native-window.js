import assert from 'node:assert/strict';

import { NativeCommandHost } from '../dist/native/host.js';

const failureTimer = setTimeout(() => {
  console.error('Retend GPUI native window teardown did not complete.');
  process.exit(1);
}, 5_000);
failureTimer.unref();

const host = new NativeCommandHost({ headless: false });
assert.ok(host.windowId > 0, 'native window must have a window ID');
assert.ok(host.rootId > 0, 'native window must have a root node ID');

await new Promise((resolve) => setTimeout(resolve, 32));
host.close();
assert.throws(
  () => host.createText('after close'),
  /closed Retend GPUI renderer/
);
console.log('Retend GPUI native window smoke test passed.');
