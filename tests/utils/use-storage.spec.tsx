import { useLocalStorage, useSessionStorage } from 'retend-utils/hooks';
import { describe, expect, it } from 'vitest';
import { vDomSetup, browserSetup } from '../setup';
import { getGlobalContext } from 'retend/context';

const localStorageKey = 'test-local-storage';
const sessionStorageKey = 'test-session-storage';

const runTests = () => {
  it('should set and get value from local storage', () => {
    const storageCell = useLocalStorage<string>(
      localStorageKey,
      'initialValue'
    );
    const { window } = getGlobalContext();

    expect(storageCell.get()).toBe('initialValue');

    storageCell.set('newValue');

    expect(storageCell.get()).toBe('newValue');
    expect(window.localStorage.getItem(localStorageKey)).toBe('"newValue"');
  });

  it('should delete value from local storage', () => {
    const { window } = getGlobalContext();
    window.localStorage.setItem(localStorageKey, '"initialValue"');
    const storageCell = useLocalStorage<string | null>(
      localStorageKey,
      'initialValue'
    );

    expect(window.localStorage.getItem(localStorageKey)).toBe('"initialValue"');

    storageCell.set(null);

    expect(storageCell.get()).toBe(null);
    expect(window.localStorage.getItem(localStorageKey)).toBe('null'); // Note: localStorage stores null as "null" string
  });

  it('should set and get value from session storage', () => {
    const storageCell = useSessionStorage<string>(
      sessionStorageKey,
      'initialValue'
    );
    const { window } = getGlobalContext();

    expect(storageCell.get()).toBe('initialValue');

    storageCell.set('newValue');

    expect(storageCell.get()).toBe('newValue');
    expect(window.sessionStorage.getItem(sessionStorageKey)).toBe('"newValue"');
  });

  it('should delete value from session storage', () => {
    const { window } = getGlobalContext();
    window.sessionStorage.setItem(sessionStorageKey, '"initialValue"');
    const storageCell = useSessionStorage<string | null>(
      sessionStorageKey,
      'initialValue'
    );

    expect(window.sessionStorage.getItem(sessionStorageKey)).toBe(
      '"initialValue"'
    );

    storageCell.set(null);

    expect(storageCell.get()).toBe(null);
    expect(window.sessionStorage.getItem(sessionStorageKey)).toBe('null'); // Note: sessionStorage stores null as "null" string
  });
};

describe('useStorage', () => {
  describe('Browser', () => {
    browserSetup();
    runTests();

    it('should update when local storage changes from another window', () => {
      const storageCell = useLocalStorage(localStorageKey, 'initialValue');
      const { window } = getGlobalContext();

      expect(storageCell.get()).toBe(
        JSON.parse(window.localStorage.getItem(localStorageKey) as string)
      );

      window.dispatchEvent(
        new StorageEvent('storage', {
          key: localStorageKey,
          newValue: '"newValue"',
          storageArea: window.localStorage,
        })
      );

      expect(storageCell.get()).toBe('newValue');
    });

    it('should update when session storage changes from another window', () => {
      const storageCell = useSessionStorage(sessionStorageKey, 'initialValue');
      const { window } = getGlobalContext();

      expect(storageCell.get()).toBe(
        JSON.parse(window.sessionStorage.getItem(sessionStorageKey) as string)
      );

      window.dispatchEvent(
        new StorageEvent('storage', {
          key: sessionStorageKey,
          newValue: '"newValue"',
          storageArea: window.sessionStorage,
        })
      );

      expect(storageCell.get()).toBe('newValue');
    });
  });

  describe('VDom', () => {
    vDomSetup();
    runTests();
  });
});
