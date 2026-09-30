import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { startProductionApp } from '../source/runtime/production';

describe('production bootstrap', () => {
  it('fails when the packaged native addon is missing instead of resolving another one', async () => {
    const missing = path.join(
      os.tmpdir(),
      'retend-gpui-missing-package',
      'native',
      'retend-gpui-native.darwin-arm64.node'
    );

    await expect(
      startProductionApp({
        Application: class {
          readonly context = {};
          init(): void {}
          cleanup(): void {}
        },
        Root: () => null,
        appName: 'Test',
        identifier: 'dev.retend.test',
        options: { width: 800, height: 600, title: 'Test', location: '/' },
        nativeAddonPath: missing,
      })
    ).rejects.toThrow(
      'could not find the packaged native addon retend-gpui-native.darwin-arm64.node'
    );
  });
});
