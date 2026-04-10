import {
  Length,
  Alignment,
  Overflow,
  BorderStyle,
  Duration,
  AnimationFillMode,
  Easing,
} from 'retend-canvas';
import { afterEach, describe, expect, it, vi } from 'vitest';
import 'retend-canvas/jsx-runtime';
import { createCanvasAndRenderer, render, pixelAt } from './setup.tsx';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('rect rendering', () => {
  it('draws a filled rectangle', async () => {
    const { ctx } = await render(() => (
      <rect
        style={{
          width: Length.Px(100),
          height: Length.Px(50),
          backgroundColor: 'red',
        }}
      />
    ));

    const center = pixelAt(ctx, 50, 25);
    expect(center[0]).toBeGreaterThan(200);
    expect(center[1]).toBeLessThan(50);

    const outside = pixelAt(ctx, 150, 25);
    expect(outside[3]).toBe(0);
  });

  it('draws a rectangle at a specific position', async () => {
    const { ctx } = await render(() => (
      <rect
        style={{
          left: Length.Px(200),
          top: Length.Px(100),
          width: Length.Px(50),
          height: Length.Px(50),
          backgroundColor: 'blue',
        }}
      />
    ));

    const inside = pixelAt(ctx, 225, 125);
    expect(inside[2]).toBeGreaterThan(200);
    expect(inside[0]).toBeLessThan(50);

    const outside = pixelAt(ctx, 100, 100);
    expect(outside[3]).toBe(0);
  });

  it('draws a rectangle with percentage width', async () => {
    const { ctx } = await render(() => (
      <rect
        style={{
          width: Length.Pct(50),
          height: Length.Px(50),
          backgroundColor: 'red',
        }}
      />
    ));

    const center = pixelAt(ctx, 200, 25);
    expect(center[0]).toBeGreaterThan(200);

    const right = pixelAt(ctx, 200, 25);
    expect(right[3]).toBeGreaterThan(0);
  });

  it('recomputes path when replaceAll removes border radius', () => {
    const { renderer, ctx } = createCanvasAndRenderer();
    renderer.render(
      <rect
        style={{
          width: Length.Px(100),
          height: Length.Px(100),
          borderRadius: Length.Px(20),
          backgroundColor: 'red',
        }}
      />
    );

    const rect = renderer.root.children[0] as any;
    renderer.drawToScreen();
    expect(pixelAt(ctx, 0, 0)[3]).toBe(0);

    rect.updateStyles(
      {
        width: Length.Px(100),
        height: Length.Px(100),
        backgroundColor: 'red',
      },
      true
    );
    renderer.drawToScreen();

    expect(pixelAt(ctx, 0, 0)[0]).toBeGreaterThan(200);
  });
});

describe('circle rendering', () => {
  it('draws a filled circle', async () => {
    const { ctx } = await render(() => (
      <circle
        style={{
          width: Length.Px(100),
          height: Length.Px(100),
          backgroundColor: 'lime',
        }}
      />
    ));

    const center = pixelAt(ctx, 50, 50);
    expect(center[1]).toBeGreaterThan(100);
    expect(center[3]).toBeGreaterThan(0);

    const corner = pixelAt(ctx, 0, 0);
    expect(corner[3]).toBe(0);
  });
});

describe('path rendering', () => {
  it('reuses cached path nodes', () => {
    const { renderer } = createCanvasAndRenderer();
    renderer.render(
      <path
        d="M0 0 L100 0 L100 100 Z"
        style={{
          borderStyle: BorderStyle.Solid,
          borderWidth: Length.Px(1),
        }}
      />
    );

    const path = renderer.root.children[0] as any;
    let traceCalls = 0;
    const tracePath = path.tracePath.bind(path);
    path.tracePath = () => {
      traceCalls += 1;
      return tracePath();
    };

    renderer.drawToScreen();
    renderer.drawToScreen();

    expect(traceCalls).toBe(1);
  });
});

describe('nested containers', () => {
  it('renders child inside parent', async () => {
    const { ctx } = await render(() => (
      <rect
        style={{
          width: Length.Px(200),
          height: Length.Px(200),
          backgroundColor: 'black',
        }}
      >
        <rect
          style={{
            width: Length.Px(50),
            height: Length.Px(50),
            backgroundColor: 'yellow',
          }}
        />
      </rect>
    ));

    const childCenter = pixelAt(ctx, 25, 25);
    expect(childCenter[0]).toBeGreaterThan(200);
    expect(childCenter[1]).toBeGreaterThan(200);

    const parentOnly = pixelAt(ctx, 100, 100);
    expect(parentOnly[0]).toBeLessThan(50);
    expect(parentOnly[3]).toBeGreaterThan(0);
  });

  it('renders deeply nested containers', async () => {
    const { ctx } = await render(() => (
      <rect
        style={{
          width: Length.Px(200),
          height: Length.Px(200),
          backgroundColor: 'black',
        }}
      >
        <rect
          style={{
            width: Length.Px(100),
            height: Length.Px(100),
            backgroundColor: 'black',
          }}
        >
          <rect
            style={{
              width: Length.Px(50),
              height: Length.Px(50),
              backgroundColor: 'red',
            }}
          />
        </rect>
      </rect>
    ));

    const deepest = pixelAt(ctx, 25, 25);
    expect(deepest[0]).toBeGreaterThan(200);
  });
});

describe('alignment', () => {
  it('centers a child with alignSelf and justifySelf', async () => {
    const { ctx } = await render(() => (
      <rect
        style={{
          width: Length.Px(200),
          height: Length.Px(200),
          backgroundColor: 'black',
        }}
      >
        <rect
          style={{
            width: Length.Px(50),
            height: Length.Px(50),
            alignSelf: Alignment.Center,
            justifySelf: Alignment.Center,
            backgroundColor: 'white',
          }}
        />
      </rect>
    ));

    const childCenter = pixelAt(ctx, 100, 100);
    expect(childCenter[0]).toBeGreaterThan(200);
    expect(childCenter[1]).toBeGreaterThan(200);

    const parentOnly = pixelAt(ctx, 25, 100);
    expect(parentOnly[3]).toBeGreaterThan(0);
    expect(parentOnly[0]).toBeLessThan(50);
  });
});

describe('overflow hidden', () => {
  it('clips overflowing children', async () => {
    const { ctx } = await render(() => (
      <rect
        style={{
          width: Length.Px(100),
          height: Length.Px(100),
          backgroundColor: 'black',
          overflow: Overflow.Hidden,
        }}
      >
        <rect
          style={{
            left: Length.Px(80),
            top: Length.Px(80),
            width: Length.Px(100),
            height: Length.Px(100),
            backgroundColor: 'red',
          }}
        />
      </rect>
    ));

    const inside = pixelAt(ctx, 90, 90);
    expect(inside[0]).toBeGreaterThan(200);

    const outside = pixelAt(ctx, 150, 150);
    expect(outside[3]).toBe(0);
  });

  it('reuses cached path for overflow clipping', () => {
    const { renderer } = createCanvasAndRenderer();
    renderer.render(
      <rect
        style={{
          width: Length.Px(100),
          height: Length.Px(100),
          overflow: Overflow.Hidden,
        }}
      />
    );

    const rect = renderer.root.children[0] as any;
    let traceCalls = 0;
    const tracePath = rect.tracePath.bind(rect);
    rect.tracePath = () => {
      traceCalls += 1;
      return tracePath();
    };

    renderer.drawToScreen();
    renderer.drawToScreen();

    expect(traceCalls).toBe(1);
  });

  it('does not clip children when overflow is visible', async () => {
    const { ctx } = await render(() => (
      <rect
        style={{
          width: Length.Px(50),
          height: Length.Px(50),
          backgroundColor: 'black',
        }}
      >
        <rect
          style={{
            left: Length.Px(40),
            top: Length.Px(40),
            width: Length.Px(50),
            height: Length.Px(50),
            backgroundColor: 'red',
          }}
        />
      </rect>
    ));

    const overflow = pixelAt(ctx, 70, 70);
    expect(overflow[0]).toBeGreaterThan(200);
  });
});

describe('border', () => {
  it('draws a border around a rectangle', async () => {
    const { ctx } = await render(() => (
      <rect
        style={{
          width: Length.Px(100),
          height: Length.Px(100),
          borderStyle: BorderStyle.Solid,
          borderWidth: Length.Px(4),
          borderColor: 'red',
          backgroundColor: 'white',
        }}
      />
    ));

    const borderPixel = pixelAt(ctx, 2, 50);
    expect(borderPixel[0]).toBeGreaterThan(200);

    const fillPixel = pixelAt(ctx, 50, 50);
    expect(fillPixel[0]).toBeGreaterThan(200);
    expect(fillPixel[1]).toBeGreaterThan(200);
  });
});

describe('opacity', () => {
  it('renders semi-transparent container', async () => {
    const { ctx } = await render(() => (
      <rect
        style={{
          width: Length.Px(100),
          height: Length.Px(100),
          backgroundColor: 'black',
          opacity: 0.5,
        }}
      />
    ));

    const pixel = pixelAt(ctx, 50, 50);
    expect(pixel[3]).toBeGreaterThan(100);
    expect(pixel[3]).toBeLessThan(200);
  });

  it('renders fully opaque container by default', async () => {
    const { ctx } = await render(() => (
      <rect
        style={{
          width: Length.Px(100),
          height: Length.Px(100),
          backgroundColor: 'red',
        }}
      />
    ));

    const pixel = pixelAt(ctx, 50, 50);
    expect(pixel[3]).toBe(255);
  });
});

describe('transitions', () => {
  it('transitions a single property', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(0);
    const { renderer } = createCanvasAndRenderer();
    renderer.render(
      <rect
        style={{
          width: Length.Px(100),
          height: Length.Px(100),
          backgroundColor: 'red',
          opacity: 0,
          transitionProperty: 'opacity',
          transitionDuration: Duration.Ms(100),
          transitionTimingFunction: Easing.Linear,
        }}
      />
    );

    const rect = renderer.root.children[0] as any;
    renderer.drawToScreen();
    rect.updateStyles({ opacity: 1 });

    renderer.drawToScreen();
    expect(rect.computedStyles.opacity).toBe(0);

    now.mockReturnValue(50);
    renderer.drawToScreen();
    expect(rect.computedStyles.opacity).toBeCloseTo(0.5, 2);

    now.mockReturnValue(100);
    renderer.drawToScreen();
    expect(rect.computedStyles.opacity).toBe(1);
  });

  it('transitions multiple properties from transitionProperty arrays', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(0);
    const { renderer } = createCanvasAndRenderer();
    renderer.render(
      <rect
        style={{
          width: Length.Px(100),
          height: Length.Px(100),
          backgroundColor: 'red',
          left: Length.Px(0),
          opacity: 0,
          transitionProperty: ['left', 'opacity'],
          transitionDuration: Duration.Ms(100),
          transitionTimingFunction: Easing.Linear,
        }}
      />
    );

    const rect = renderer.root.children[0] as any;
    renderer.drawToScreen();
    rect.updateStyles({ left: Length.Px(100), opacity: 1 });

    now.mockReturnValue(50);
    renderer.drawToScreen();
    expect(rect.computedStyles.left.value).toBeCloseTo(50, 1);
    expect(rect.computedStyles.opacity).toBeCloseTo(0.5, 2);
  });

  it('updates unlisted properties immediately', () => {
    const { renderer } = createCanvasAndRenderer();
    renderer.render(
      <rect
        style={{
          width: Length.Px(100),
          height: Length.Px(100),
          backgroundColor: 'red',
          left: Length.Px(0),
          opacity: 0,
          transitionProperty: 'opacity',
          transitionDuration: Duration.Ms(100),
          transitionTimingFunction: Easing.Linear,
        }}
      />
    );

    const rect = renderer.root.children[0] as any;
    renderer.drawToScreen();
    rect.updateStyles({ left: Length.Px(100), opacity: 1 });
    renderer.drawToScreen();

    expect(rect.computedStyles.left.value).toBe(100);
    expect(rect.computedStyles.opacity).toBe(0);
  });

  it('restarts interrupted transitions from the current rendered value', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(0);
    const { renderer } = createCanvasAndRenderer();
    renderer.render(
      <rect
        style={{
          width: Length.Px(100),
          height: Length.Px(100),
          backgroundColor: 'red',
          opacity: 0,
          transitionProperty: 'opacity',
          transitionDuration: Duration.Ms(100),
          transitionTimingFunction: Easing.Linear,
        }}
      />
    );

    const rect = renderer.root.children[0] as any;
    renderer.drawToScreen();
    rect.updateStyles({ opacity: 1 });

    now.mockReturnValue(50);
    renderer.drawToScreen();
    expect(rect.computedStyles.opacity).toBeCloseTo(0.5, 2);

    rect.updateStyles({ opacity: 0.25 });
    renderer.drawToScreen();
    expect(rect.computedStyles.opacity).toBeCloseTo(0.5, 2);

    now.mockReturnValue(100);
    renderer.drawToScreen();
    expect(rect.computedStyles.opacity).toBeCloseTo(0.375, 2);
  });

  it('keeps unrelated property transitions running when one property changes', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(0);
    const { renderer } = createCanvasAndRenderer();
    renderer.render(
      <rect
        style={{
          width: Length.Px(100),
          height: Length.Px(100),
          backgroundColor: 'red',
          left: Length.Px(0),
          opacity: 0,
          transitionProperty: ['left', 'opacity'],
          transitionDuration: Duration.Ms(100),
          transitionTimingFunction: Easing.Linear,
        }}
      />
    );

    const rect = renderer.root.children[0] as any;
    renderer.drawToScreen();
    rect.updateStyles({ left: Length.Px(100), opacity: 1 });

    now.mockReturnValue(50);
    renderer.drawToScreen();
    expect(rect.computedStyles.left.value).toBeCloseTo(50, 1);
    expect(rect.computedStyles.opacity).toBeCloseTo(0.5, 2);

    rect.updateStyles({ opacity: 0.25 });
    renderer.drawToScreen();

    now.mockReturnValue(100);
    renderer.drawToScreen();
    expect(rect.computedStyles.left.value).toBe(100);
    expect(rect.computedStyles.opacity).toBeCloseTo(0.375, 2);
  });

  it('suppresses transitions for properties driven by explicit animations', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(0);
    const { renderer } = createCanvasAndRenderer();
    renderer.render(
      <rect
        style={{
          width: Length.Px(100),
          height: Length.Px(100),
          backgroundColor: 'red',
          opacity: 0,
          transitionProperty: 'opacity',
          transitionDuration: Duration.Ms(100),
          transitionTimingFunction: Easing.Linear,
        }}
      />
    );

    const rect = renderer.root.children[0] as any;
    renderer.drawToScreen();
    rect.updateStyles({
      opacity: 1,
      animationName: {
        from: { opacity: 0 },
        to: { opacity: 0.25 },
      },
      animationDuration: Duration.Ms(100),
      animationFillMode: AnimationFillMode.Both,
    });

    now.mockReturnValue(100);
    renderer.drawToScreen();
    expect(rect.computedStyles.opacity).toBe(0.25);
  });

  it('allows transitions after an explicit animation has finished', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(0);
    const { renderer } = createCanvasAndRenderer();
    renderer.render(
      <rect
        style={{
          width: Length.Px(100),
          height: Length.Px(100),
          backgroundColor: 'red',
          opacity: 0,
          transitionProperty: 'opacity',
          transitionDuration: Duration.Ms(100),
          transitionTimingFunction: Easing.Linear,
          animationName: {
            from: { opacity: 0 },
            to: { opacity: 1 },
          },
          animationDuration: Duration.Ms(100),
          animationFillMode: AnimationFillMode.Both,
        }}
      />
    );

    const rect = renderer.root.children[0] as any;
    renderer.drawToScreen();

    now.mockReturnValue(100);
    renderer.drawToScreen();
    expect(rect.computedStyles.opacity).toBe(1);

    rect.updateStyles({ opacity: 0.25 });
    renderer.drawToScreen();
    expect(rect.computedStyles.opacity).toBe(1);

    now.mockReturnValue(150);
    renderer.drawToScreen();
    expect(rect.computedStyles.opacity).toBeCloseTo(0.625, 2);
  });
});

describe('duration', () => {
  it('returns milliseconds for duration helpers', () => {
    expect(Duration.Ms(150)).toBe(150);
    expect(Duration.Sec(0.2)).toBe(200);
  });
});

describe('pointer events', () => {
  it('dispatches click event at a point', async () => {
    let clicked = false;
    const { renderer } = await render(() => (
      <rect
        style={{
          width: Length.Px(100),
          height: Length.Px(100),
          backgroundColor: 'red',
        }}
        onClick={() => {
          clicked = true;
        }}
      />
    ));

    renderer.dispatchEvent('click', 50, 50);
    expect(clicked).toBe(true);
  });

  it('does not dispatch click event outside a shape', async () => {
    let clicked = false;
    const { renderer } = await render(() => (
      <rect
        style={{
          width: Length.Px(100),
          height: Length.Px(100),
          backgroundColor: 'red',
        }}
        onClick={() => {
          clicked = true;
        }}
      />
    ));

    renderer.dispatchEvent('click', 200, 200);
    expect(clicked).toBe(false);
  });
});

describe('zIndex', () => {
  it('paints higher zIndex on top', async () => {
    const { ctx } = await render(() => (
      <rect style={{ width: Length.Px(100), height: Length.Px(100) }}>
        <rect
          style={{
            width: Length.Px(100),
            height: Length.Px(100),
            backgroundColor: 'red',
          }}
        />
        <rect
          style={{
            width: Length.Px(100),
            height: Length.Px(100),
            backgroundColor: 'blue',
          }}
        />
      </rect>
    ));

    const noZIndex = pixelAt(ctx, 50, 50);
    expect(noZIndex[2]).toBeGreaterThan(200);

    const { ctx: ctx2 } = await render(() => (
      <rect style={{ width: Length.Px(100), height: Length.Px(100) }}>
        <rect
          style={{
            width: Length.Px(100),
            height: Length.Px(100),
            backgroundColor: 'red',
            zIndex: 1,
          }}
        />
        <rect
          style={{
            width: Length.Px(100),
            height: Length.Px(100),
            backgroundColor: 'blue',
          }}
        />
      </rect>
    ));

    const withZIndex = pixelAt(ctx2, 50, 50);
    expect(withZIndex[0]).toBeGreaterThan(200);
  });

  it('updates paint order after write removes a child', () => {
    const { ctx, renderer } = createCanvasAndRenderer(100, 100);
    const group = renderer.createGroup();
    const handle = renderer.createGroupHandle(group);
    renderer.append(renderer.root, group);
    const red = renderer.createContainer('rect');
    const blue = renderer.createContainer('rect');

    renderer.setProperty(red, 'style', {
      width: Length.Px(100),
      height: Length.Px(100),
      backgroundColor: 'red',
      zIndex: 0,
    });
    renderer.setProperty(blue, 'style', {
      width: Length.Px(100),
      height: Length.Px(100),
      backgroundColor: 'blue',
      zIndex: 1,
    });

    renderer.write(handle, [red, blue]);
    renderer.drawToScreen();

    const before = pixelAt(ctx, 50, 50);
    expect(before[2]).toBeGreaterThan(200);

    renderer.write(handle, [red]);
    renderer.drawToScreen();

    const after = pixelAt(ctx, 50, 50);
    expect(after[0]).toBeGreaterThan(200);
  });
});
