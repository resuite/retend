import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { createMacosDevelopmentExecutable } from '../source/runtime/macos-dev-executable.js';

const describeSymlinks =
  process.platform === 'win32' ? describe.skip : describe;

describeSymlinks('macOS development executable identity', () => {
  it('launches through an app-named symlink and removes it after disposal', () => {
    const executable = createMacosDevelopmentExecutable(
      'Retend GPUI',
      process.execPath
    );
    const directory = path.dirname(executable.path);

    expect(path.basename(executable.path)).toBe('Retend GPUI');
    expect(fs.lstatSync(executable.path).isSymbolicLink()).toBe(true);
    expect(fs.realpathSync(executable.path)).toBe(
      fs.realpathSync(process.execPath)
    );

    executable.dispose();
    expect(fs.existsSync(directory)).toBe(false);
    expect(() => executable.dispose()).not.toThrow();
  });

  it.each(['.', '..', 'Nested/App', 'bad\0name'])(
    'rejects a path-unsafe app name: %s',
    (appName) => {
      expect(() => createMacosDevelopmentExecutable(appName)).toThrow(
        'app.name cannot be used as a macOS development application name'
      );
    }
  );
});
