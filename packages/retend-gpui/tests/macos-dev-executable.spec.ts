import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { createMacosDevelopmentExecutable } from '../source/runtime/macos-dev-executable.js';

const describeSymlinks =
  process.platform === 'win32' ? describe.skip : describe;

describeSymlinks('macOS development executable identity', () => {
  it('launches through a minimal app bundle and removes it after disposal', () => {
    const executable = createMacosDevelopmentExecutable(
      'Retend GPUI',
      'dev.retend.gpui',
      process.execPath
    );
    const directory = path.dirname(executable.bundlePath);
    const plist = fs.readFileSync(
      path.join(executable.bundlePath, 'Contents', 'Info.plist'),
      'utf8'
    );

    expect(path.basename(executable.bundlePath)).toBe('Retend GPUI.app');
    expect(path.basename(executable.path)).toBe('Retend GPUI');
    expect(fs.lstatSync(executable.path).isSymbolicLink()).toBe(true);
    expect(fs.realpathSync(executable.path)).toBe(
      fs.realpathSync(process.execPath)
    );
    expect(plist).toContain(
      '<key>CFBundleExecutable</key>\n  <string>Retend GPUI</string>'
    );
    expect(plist).toContain('<string>Retend GPUI</string>');
    expect(plist).toContain('<string>dev.retend.gpui</string>');

    executable.dispose();
    expect(fs.existsSync(directory)).toBe(false);
    expect(() => executable.dispose()).not.toThrow();
  });

  it('escapes bundle metadata', () => {
    const executable = createMacosDevelopmentExecutable(
      'A & B <Dev>',
      'dev.retend.a&b',
      process.execPath
    );
    const plist = fs.readFileSync(
      path.join(executable.bundlePath, 'Contents', 'Info.plist'),
      'utf8'
    );
    expect(plist).toContain('A &amp; B &lt;Dev&gt;');
    expect(plist).toContain('dev.retend.a&amp;b');
    executable.dispose();
  });

  it.each([
    ['', 'dev.retend.app'],
    ['Retend', ''],
    ['bad\0name', 'dev.retend.app'],
    ['Nested/App', 'dev.retend.app'],
    ['Retend', 'bad\0identifier'],
  ])('rejects invalid identity values', (appName, identifier) => {
    expect(() => createMacosDevelopmentExecutable(appName, identifier)).toThrow(
      'invalid macOS development application identity'
    );
  });
});
