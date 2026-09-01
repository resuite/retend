import assert from 'node:assert/strict';

import {
  ElementKind,
  NativeCommandHost,
  PropertyId,
} from '../dist/native/host.js';

const failureTimer = setTimeout(() => {
  console.error('Retend GPUI native window teardown did not complete.');
  process.exit(1);
}, 5_000);
failureTimer.unref();

const host = new NativeCommandHost({ headless: false });
assert.ok(host.windowId > 0, 'native window must have a window ID');
assert.ok(host.rootId > 0, 'native window must have a root node ID');

const panel = host.createNode(ElementKind.Container);
const label = host.createText('Retend GPUI native Phase 2');
host.setProperty(panel, PropertyId.Width, '75%');
host.setProperty(panel, PropertyId.BackgroundColor, '#eef2ffff');
host.setProperty(panel, PropertyId.Color, '#172554ff');
host.setProperty(panel, PropertyId.FontSize, 24);
host.insertChild(panel, label);
host.insertChild(host.rootId, panel);
host.flush();

await new Promise((resolve) => setTimeout(resolve, 32));
host.close();
assert.throws(
  () => host.createText('after close'),
  /closed Retend GPUI renderer/
);
console.log('Retend GPUI native window lifecycle smoke test passed.');
