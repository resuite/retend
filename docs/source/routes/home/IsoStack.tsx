import type { JSX } from 'retend/jsx-runtime';

import { For } from 'retend';

import { type Box, boxFaces, onTop, project, type Point3 } from './iso';

interface Tile {
  box: Box;
  label: string;
  dashed?: boolean;
}

interface IsoBoxProps {
  box: Box;
  dashed?: boolean;
  /** Drawn flat on the top face, centred on it. */
  children?: JSX.Template;
}

const SIZE = 0.92;
const GAP = 1.08;
const CUBE = 0.78;

/* Drawn back to front. The back tile is the one the core partly hides, so
   it holds the open-ended slot rather than a shipped renderer. */
const renderers: Tile[] = [
  {
    box: { x: 0, y: 0, z: 0, w: SIZE, d: SIZE, h: 0.3 },
    label: 'yours',
    dashed: true,
  },
  { box: { x: GAP, y: 0, z: 0, w: SIZE, d: SIZE, h: 0.3 }, label: 'desktop' },
  { box: { x: 0, y: GAP, z: 0, w: SIZE, d: SIZE, h: 0.3 }, label: 'server' },
  { box: { x: GAP, y: GAP, z: 0, w: SIZE, d: SIZE, h: 0.3 }, label: 'web' },
];

/* Layers are spread apart so each one stays readable under the next. */
const CORE_Z = 2.05;
const APP_Z = 3.55;

const core: Box = { x: 0, y: 0, z: CORE_Z, w: 2, d: 2, h: 0.34 };

const app: Box[] = [
  [0.11, 0.11],
  [1.11, 0.11],
  [0.11, 1.11],
  [1.11, 1.11],
].map(([x, y]) => ({ x, y, z: APP_Z, w: CUBE, d: CUBE, h: CUBE }));

/* Dashed guides drop from the visible corners of each layer to the next. */
const guides = [
  [2, 0],
  [0, 2],
  [2, 2],
].flatMap(([x, y]) => {
  const pairs: [Point3, Point3][] = [
    [
      [x, y, APP_Z],
      [x, y, CORE_Z + 0.34],
    ],
    [
      [x, y, CORE_Z],
      [x, y, 0.3],
    ],
  ];
  return pairs.map(([from, to]) => {
    const [x1, y1] = project(from);
    const [x2, y2] = project(to);
    return [x1, y1, x2, y2];
  });
});

/* The core's top face carries a small graph: Cells joined by edges. */
const graphNodes = [
  [-34, -22],
  [-34, 22],
  [6, 0],
  [40, -24],
  [40, 24],
];
const graphEdges = [
  [0, 2],
  [1, 2],
  [2, 3],
  [2, 4],
].map(([a, b]) => [
  graphNodes[a][0],
  graphNodes[a][1],
  graphNodes[b][0],
  graphNodes[b][1],
]);

const callouts = [
  { z: APP_Z + 0.4, title: 'Your app', body: 'Components, Cells, routes' },
  { z: CORE_Z + 0.17, title: 'retend', body: 'Tracks state, runs components' },
  { z: 0.15, title: 'Renderers', body: 'Web, desktop, server, yours' },
].map((callout) => {
  const [x, y] = project([2, 0, callout.z]);
  return { title: callout.title, body: callout.body, x, y };
});

/**
 * An exploded isometric drawing: your app sits on Retend, and Retend sits on
 * whichever renderer draws it.
 */
export function IsoStack() {
  return (
    <svg
      viewBox="-125 -300 500 440"
      role="img"
      aria-label="Your app sits on Retend, which hands its output to a renderer: web, desktop, server, or one you write."
      class="h-auto w-full overflow-visible"
    >
      <g
        fill="none"
        class="stroke-ink/50"
        stroke-width="1"
        stroke-dasharray="3 4"
      >
        {For(guides, ([x1, y1, x2, y2]) => (
          <line x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </g>

      {For(renderers, (tile) => (
        <IsoBox box={tile.box} dashed={tile.dashed}>
          <text
            text-anchor="middle"
            dominant-baseline="central"
            stroke="none"
            class="fill-ink-soft text-[11px]"
          >
            {tile.label}
          </text>
        </IsoBox>
      ))}

      <IsoBox box={core}>
        <g class="stroke-ink" stroke-width="1.25">
          {For(graphEdges, ([x1, y1, x2, y2]) => (
            <line x1={x1} y1={y1} x2={x2} y2={y2} />
          ))}
        </g>
        {For(graphNodes, ([cx, cy]) => (
          <circle cx={cx} cy={cy} r="7" class="fill-raised stroke-ink" />
        ))}
      </IsoBox>

      {For(app, (box) => (
        <IsoBox box={box}>
          <text
            text-anchor="middle"
            dominant-baseline="central"
            stroke="none"
            class="fill-ink font-mono text-[15px]"
          >
            {'</>'}
          </text>
        </IsoBox>
      ))}

      {For(callouts, (callout) => (
        <g>
          <line
            x1={callout.x + 8}
            y1={callout.y}
            x2={callout.x + 70}
            y2={callout.y}
            class="stroke-ink"
            stroke-width="1"
          />
          <circle cx={callout.x + 8} cy={callout.y} r="2.5" class="fill-ink" />
          <text
            x={callout.x + 80}
            y={callout.y - 3}
            class="fill-ink text-[15px]"
          >
            {callout.title}
          </text>
          <text
            x={callout.x + 80}
            y={callout.y + 15}
            class="fill-ink-faint text-[12px]"
          >
            {callout.body}
          </text>
        </g>
      ))}
    </svg>
  );
}

function IsoBox(props: IsoBoxProps) {
  const { box, dashed = false, children } = props;
  const faces = boxFaces(box);
  const dash = dashed ? '4 3' : 'none';

  return (
    <g
      class="stroke-ink"
      stroke-width="1.25"
      stroke-linejoin="round"
      stroke-dasharray={dash}
    >
      <polygon points={faces.left} class="fill-sunken" />
      <polygon points={faces.right} class="fill-paper" />
      <polygon points={faces.top} class="fill-raised" />
      <g transform={onTop(box)} stroke-dasharray="none">
        {children}
      </g>
    </g>
  );
}
