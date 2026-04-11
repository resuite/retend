import { describe, expect, it } from 'vitest';

// oxlint-disable-next-line typescript/consistent-type-imports
type CanvasModule = typeof import('retend-canvas');
type CanvasRenderer = InstanceType<CanvasModule['CanvasRenderer']>;
type Scenario = {
  name: string;
  build: (
    mod: CanvasModule,
    renderer: CanvasRenderer,
    interactive: boolean
  ) => void;
};

function createRenderer(mod: CanvasModule, width = 800, height = 600) {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create 2d context.');
  const host = new mod.CanvasHost(ctx, width, height);
  const renderer = new mod.CanvasRenderer(host, { width, height });
  return { renderer };
}

function addPointerHandler(
  renderer: CanvasRenderer,
  node: ReturnType<CanvasRenderer['createContainer']>,
  interactive: boolean
) {
  if (!interactive) return;
  renderer.setProperty(node, 'onPointerMove', () => {});
}

const scenarios: Scenario[] = [
  {
    name: 'flat_rect_grid',
    build(mod, renderer, interactive) {
      for (let i = 0; i < 1200; i += 1) {
        const rect = renderer.createContainer('rect');
        renderer.setProperty(rect, 'style', {
          left: mod.Length.Px((i % 40) * 20),
          top: mod.Length.Px(Math.floor(i / 40) * 20),
          width: mod.Length.Px(18),
          height: mod.Length.Px(18),
          backgroundColor: 'red',
        });
        addPointerHandler(renderer, rect, interactive);
        renderer.append(renderer.root, rect);
      }
    },
  },
  {
    name: 'nested_clipped_cards',
    build(mod, renderer, interactive) {
      for (let i = 0; i < 120; i += 1) {
        const card = renderer.createContainer('rect');
        renderer.setProperty(card, 'style', {
          left: mod.Length.Px((i % 12) * 64),
          top: mod.Length.Px(Math.floor(i / 12) * 64),
          width: mod.Length.Px(56),
          height: mod.Length.Px(56),
          backgroundColor: '#111',
          borderRadius: mod.Length.Px(8),
          overflow: mod.Overflow.Hidden,
        });
        addPointerHandler(renderer, card, interactive);
        renderer.append(renderer.root, card);

        for (let j = 0; j < 4; j += 1) {
          const stripe = renderer.createContainer('rect');
          let backgroundColor = '#222';
          if (j % 2 === 0) backgroundColor = '#00ff88';
          renderer.setProperty(stripe, 'style', {
            left: mod.Length.Px(j * 10 - 4),
            top: mod.Length.Px(j * 12),
            width: mod.Length.Px(64),
            height: mod.Length.Px(10),
            rotate: mod.Angle.Deg(15),
            backgroundColor,
          });
          renderer.append(card, stripe);
        }
      }
    },
  },
  {
    name: 'text_blocks',
    build(mod, renderer, interactive) {
      for (let i = 0; i < 180; i += 1) {
        const block = renderer.createContainer('text');
        renderer.setProperty(block, 'style', {
          left: mod.Length.Px((i % 6) * 132),
          top: mod.Length.Px(Math.floor(i / 6) * 24),
          width: mod.Length.Px(120),
          color: '#111',
          fontSize: mod.Length.Px(12),
          lineHeight: 1.2,
        });
        addPointerHandler(renderer, block, interactive);
        renderer.append(renderer.root, block);
        renderer.append(
          block,
          renderer.createText('Retend canvas benchmark text block ' + i + '.')
        );
      }
    },
  },
  {
    name: 'stroked_paths',
    build(mod, renderer, interactive) {
      for (let i = 0; i < 480; i += 1) {
        const path = renderer.createContainer('path');
        renderer.setProperty(path, 'd', 'M0 8 L8 0 L16 8 L8 16 Z');
        renderer.setProperty(path, 'style', {
          left: mod.Length.Px((i % 24) * 28),
          top: mod.Length.Px(Math.floor(i / 24) * 28),
          width: mod.Length.Px(16),
          height: mod.Length.Px(16),
          borderStyle: mod.BorderStyle.Solid,
          borderWidth: mod.Length.Px(2),
          borderColor: '#0055ff',
        });
        addPointerHandler(renderer, path, interactive);
        renderer.append(renderer.root, path);
      }
    },
  },
  {
    name: 'particles_field',
    build(mod, renderer, interactive) {
      for (let i = 0; i < 24; i += 1) {
        const particles = renderer.createContainer('particles');
        const positions = new Float32Array(240);
        for (let j = 0; j < positions.length; j += 2) {
          const point = j / 2;
          positions[j] = (point % 10) * 10;
          positions[j + 1] = Math.floor(point / 10) * 10;
        }
        renderer.setProperty(particles, 'style', {
          left: mod.Length.Px((i % 6) * 128),
          top: mod.Length.Px(Math.floor(i / 6) * 128),
          width: mod.Length.Px(100),
          height: mod.Length.Px(100),
          color: '#ff5500',
        });
        renderer.setProperty(particles, 'positions', positions);
        renderer.setProperty(particles, 'sizeMap', 3);
        addPointerHandler(renderer, particles, interactive);
        renderer.append(renderer.root, particles);
      }
    },
  },
  {
    name: 'shadowed_tiles',
    build(mod, renderer, interactive) {
      for (let i = 0; i < 180; i += 1) {
        const tile = renderer.createContainer('rect');
        renderer.setProperty(tile, 'style', {
          left: mod.Length.Px((i % 15) * 52),
          top: mod.Length.Px(Math.floor(i / 15) * 52),
          width: mod.Length.Px(40),
          height: mod.Length.Px(40),
          borderRadius: mod.Length.Px(10),
          backgroundColor: '#ffffff',
          boxShadow: [
            mod.BoxShadow.Drop(
              mod.Length.Px(0),
              mod.Length.Px(6),
              mod.Length.Px(12),
              'rgba(0,0,0,0.18)'
            ),
            mod.BoxShadow.Inset(
              mod.Length.Px(0),
              mod.Length.Px(1),
              mod.Length.Px(4),
              'rgba(0,0,0,0.08)'
            ),
          ],
        });
        addPointerHandler(renderer, tile, interactive);
        renderer.append(renderer.root, tile);
      }
    },
  },
];

function populateScene(
  mod: CanvasModule,
  renderer: CanvasRenderer,
  interactive: boolean,
  scenario: Scenario
) {
  scenario.build(mod, renderer, interactive);
}

function measureRenderer(
  mod: CanvasModule,
  interactive: boolean,
  scenario: Scenario
) {
  const { renderer } = createRenderer(mod);
  populateScene(mod, renderer, interactive, scenario);

  for (let i = 0; i < 3; i += 1) renderer.drawToScreen();

  const start = performance.now();
  for (let i = 0; i < 12; i += 1) renderer.drawToScreen();
  return performance.now() - start;
}

function measureScenario(
  mod: CanvasModule,
  scenario: Scenario,
  interactive: boolean
) {
  let total = 0;
  for (let i = 0; i < 2; i += 1) {
    total += measureRenderer(mod, interactive, scenario);
  }
  return total / 2;
}

async function loadBaselineRenderer() {
  try {
    return (await import('../../tmp/retend-canvas-baseline/source/index.ts')) as CanvasModule;
  } catch {
    return null;
  }
}

describe('canvas benchmark', () => {
  it('compares current renderer against a baseline entry', async () => {
    const baseline = await loadBaselineRenderer();
    if (!baseline) return;

    const current = await import('retend-canvas');
    const report = {
      scenarios: {} as Record<
        string,
        {
          current: { nonInteractive: number; interactive: number };
          baseline: { nonInteractive: number; interactive: number };
          delta: { nonInteractive: number; interactive: number };
        }
      >,
      totals: {
        current: { nonInteractive: 0, interactive: 0 },
        baseline: { nonInteractive: 0, interactive: 0 },
        delta: { nonInteractive: 0, interactive: 0 },
      },
    };

    for (const scenario of scenarios) {
      const currentNonInteractive = measureScenario(current, scenario, false);
      const currentInteractive = measureScenario(current, scenario, true);
      const baselineNonInteractive = measureScenario(baseline, scenario, false);
      const baselineInteractive = measureScenario(baseline, scenario, true);

      report.scenarios[scenario.name] = {
        current: {
          nonInteractive: currentNonInteractive,
          interactive: currentInteractive,
        },
        baseline: {
          nonInteractive: baselineNonInteractive,
          interactive: baselineInteractive,
        },
        delta: {
          nonInteractive: currentNonInteractive - baselineNonInteractive,
          interactive: currentInteractive - baselineInteractive,
        },
      };

      report.totals.current.nonInteractive += currentNonInteractive;
      report.totals.current.interactive += currentInteractive;
      report.totals.baseline.nonInteractive += baselineNonInteractive;
      report.totals.baseline.interactive += baselineInteractive;
    }

    report.totals.delta.nonInteractive =
      report.totals.current.nonInteractive -
      report.totals.baseline.nonInteractive;
    report.totals.delta.interactive =
      report.totals.current.interactive - report.totals.baseline.interactive;

    console.info(JSON.stringify(report, null, 2));

    expect(report.totals.current.nonInteractive).toBeGreaterThan(0);
    expect(report.totals.current.interactive).toBeGreaterThan(0);
    expect(report.totals.baseline.nonInteractive).toBeGreaterThan(0);
    expect(report.totals.baseline.interactive).toBeGreaterThan(0);
  });
});
