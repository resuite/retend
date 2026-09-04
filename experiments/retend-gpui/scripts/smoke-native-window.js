import assert from 'node:assert/strict';

import { RetendGpuiRenderer } from '../dist/gpui-renderer.js';

const failureTimer = setTimeout(() => {
  console.error('Retend GPUI native window teardown did not complete.');
  process.exit(1);
}, 5_000);
failureTimer.unref();

const renderer = new RetendGpuiRenderer();
renderer.init({ title: 'Retend GPUI smoke', width: 640, height: 420 });
assert.ok(renderer.host.rootId > 0, 'native window must have a root node ID');

const panel = renderer.createContainer('div');
const label = renderer.createText('Retend GPUI native Phase 2');
renderer.setProperty(panel, 'style', {
  width: '75%',
  backgroundColor: '#eef2ff',
  color: '#172554',
  fontSize: 24,
});
renderer.append(panel, label);
renderer.render(() => panel);
renderer.flush();

const tree = renderer.host.debugTree();
assert.equal(
  tree.nodes.find((node) => node.id === panel.id)?.parent,
  tree.root_id
);
assert.equal(
  tree.nodes.find((node) => node.id === label.id)?.text,
  'Retend GPUI native Phase 2'
);

renderer.host.setWindowTitle('Retend GPUI smoke updated');
await new Promise((resolve) => setTimeout(resolve, 32));
renderer.dispose();
assert.throws(
  () => renderer.init(),
  /cannot be initialized again/,
  'renderer disposal must be terminal'
);
console.log('Retend GPUI migrated native renderer smoke test passed.');
