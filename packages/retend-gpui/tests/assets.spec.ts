import { expect, it } from 'vitest';

import { resolveAssetSource, setAssetBase } from '../source/assets.js';

it('passes remote, data, and file sources through unchanged', () => {
  setAssetBase('/tmp/resources');
  expect(resolveAssetSource('https://example.com/a.png')).toBe(
    'https://example.com/a.png'
  );
  expect(resolveAssetSource('data:image/png;base64,AAAA')).toBe(
    'data:image/png;base64,AAAA'
  );
  expect(resolveAssetSource('file:///tmp/a.png')).toBe('file:///tmp/a.png');
});

it('resolves root-relative asset URLs against the asset base', () => {
  setAssetBase('/Applications/Demo.app/Contents/Resources');
  expect(resolveAssetSource('/assets/icon-abc.svg')).toBe(
    'file:///Applications/Demo.app/Contents/Resources/assets/icon-abc.svg'
  );
});

it('leaves sources alone when no base is set or the path is relative', () => {
  setAssetBase(undefined);
  expect(resolveAssetSource('/assets/icon.svg')).toBe('/assets/icon.svg');

  setAssetBase('/tmp/resources');
  expect(resolveAssetSource('relative.png')).toBe('relative.png');
});
