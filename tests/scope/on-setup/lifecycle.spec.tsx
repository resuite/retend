import {
  branchState,
  onSetup,
  runPendingSetupEffects,
  withState,
} from 'retend';
import { describe, expect, it, vi } from 'vitest';

import { browserSetup } from '../../setup.tsx';

describe('effect lifecycle modes', () => {
  browserSetup();

  it('activates deferred branches only when called directly', async () => {
    const cleanupFn = vi.fn();
    const setupFn = vi.fn(() => cleanupFn);
    const snapshot = branchState('deferred');

    withState(snapshot, () => onSetup(setupFn));
    await runPendingSetupEffects();
    expect(setupFn).not.toHaveBeenCalled();

    await snapshot.node.activate();
    await snapshot.node.activate();

    expect(setupFn).toHaveBeenCalledTimes(1);
    expect(cleanupFn).not.toHaveBeenCalled();

    snapshot.node.dispose();
    expect(cleanupFn).toHaveBeenCalledTimes(1);
  });

  it('does not reactivate descendants after an ancestor disposes them', async () => {
    const setupFn = vi.fn();
    const parent = branchState();
    const child = withState(parent, () => branchState());

    withState(child, () => onSetup(setupFn));
    parent.node.dispose();
    await child.node.activate();

    expect(setupFn).not.toHaveBeenCalled();
  });

  it('allows directly disposed branches to activate new setup effects', async () => {
    const firstSetup = vi.fn();
    const secondSetup = vi.fn();
    const snapshot = branchState();

    withState(snapshot, () => onSetup(firstSetup));
    await runPendingSetupEffects();
    expect(firstSetup).toHaveBeenCalledTimes(1);

    snapshot.node.dispose();
    withState(snapshot, () => onSetup(secondSetup));
    await snapshot.node.activate();

    expect(firstSetup).toHaveBeenCalledTimes(1);
    expect(secondSetup).toHaveBeenCalledTimes(1);
  });

  it('only disposes retained branches when called directly', async () => {
    const cleanupFn = vi.fn();
    const parent = branchState();
    const retained = withState(parent, () => branchState('retained'));

    withState(retained, () => onSetup(() => cleanupFn));
    await runPendingSetupEffects();
    expect(cleanupFn).not.toHaveBeenCalled();

    parent.node.dispose();
    expect(cleanupFn).not.toHaveBeenCalled();

    retained.node.dispose();
    expect(cleanupFn).toHaveBeenCalledTimes(1);
  });
});
