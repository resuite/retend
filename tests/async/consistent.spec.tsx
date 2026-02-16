import { describe, it, expect, beforeEach } from 'vitest';
import { useConsistent, setConsistentValues, getConsistentValues } from 'retend-server/consistent';
import { vDomSetup, timeout } from '../setup.tsx';
import { getGlobalContext } from 'retend/context';

describe('useConsistent', () => {
  vDomSetup();

  it('should generate a value if it does not exist', async () => {
    const value = await useConsistent('test-key', () => 'generated-value');
    expect(value).toBe('generated-value');
  });

  it('should retrieve an existing value and then delete it', async () => {
    await useConsistent('test-key', () => 'initial-value');
    
    // Check that it's in globalData (internal check)
    const { globalData } = getGlobalContext();
    const map = globalData.get(Symbol.for('retend:consistent-values'));
    expect(map.get('test-key')).toBe('initial-value');

    const retrieved = await useConsistent('test-key', () => 'new-value');
    expect(retrieved).toBe('initial-value');

    // Should be deleted after retrieval
    expect(map.has('test-key')).toBe(false);
    
    const third = await useConsistent('test-key', () => 'third-value');
    expect(third).toBe('third-value');
  });

  it('should handle async generators', async () => {
    const value = await useConsistent('async-key', async () => {
      await timeout(10);
      return 'async-value';
    });
    expect(value).toBe('async-value');
  });

  it('should support setConsistentValues and getConsistentValues', () => {
    const initialMap = new Map([['key1', 'val1'], ['key2', 'val2']]);
    setConsistentValues(initialMap);

    const currentValues = getConsistentValues();
    expect(currentValues.get('key1')).toBe('val1');
    expect(currentValues.get('key2')).toBe('val2');
    expect(currentValues.size).toBe(2);
  });
});
