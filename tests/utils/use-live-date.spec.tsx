import { useLiveDate } from 'retend-utils/hooks';
import { Cell } from 'retend';
import { describe, expect, it } from 'vitest';
import { vDomSetup } from '../setup';

describe('useLiveDate', () => {
  vDomSetup();

  it('should return a Cell containing the current date and time', () => {
    const now = useLiveDate(100);
    expect(now).toBeInstanceOf(Cell);
    expect(now.get()).toBeInstanceOf(Date);
  });

  it('should update the date and time at the specified interval', async () => {
    const now = useLiveDate(100);
    const initialDate = now.get().getTime();

    // Wait for at least 150ms to allow the date to update
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(now.get().getTime()).toBeGreaterThan(initialDate);
  });
});
