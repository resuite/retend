import type { GpuiColor, GpuiStyle } from 'retend-gpui';

import { Cell, For, If, onSetup } from 'retend';

const features = [
  ['RENDERER', 'Retend-owned JS → Rust bridge'],
  ['LAYOUT', 'Block, flex, sizing, spacing, positioning'],
  ['TEXT', 'Native GPUI Text with inherited styling'],
  ['REACTIVITY', 'Cells publish text and style updates'],
  ['IMAGES', 'HTTP(S) source loading through GPUI'],
] as const;

const palette = [
  '#d9ff43',
  '#ff513c',
  '#59d8ff',
  '#c59cff',
] as const satisfies readonly GpuiColor[];

const styles = {
  root: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
    padding: 32,
    backgroundColor: '#0b0c0f',
    color: '#f4f4ef',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 24,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: 700,
    color: '#7d818a',
  },
  title: {
    fontSize: 48,
    fontWeight: 700,
    lineHeight: 52,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    color: '#9297a1',
  },
  liveBadge: {
    paddingTop: 8,
    paddingRight: 12,
    paddingBottom: 8,
    paddingLeft: 12,
    borderRadius: 999,
    borderWidth: 1,
    fontSize: 12,
    fontWeight: 700,
  },
  main: {
    display: 'flex',
    gap: 24,
    flexGrow: 1,
  },
  preview: {
    width: '62%',
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#292d35',
    borderRadius: 20,
    backgroundColor: '#12151a',
  },
  image: {
    width: '100%',
    height: 240,
    borderRadius: 14,
    backgroundColor: '#1c2027',
  },
  metrics: {
    display: 'flex',
    gap: 12,
  },
  metric: {
    flexGrow: 1,
    padding: 14,
    borderWidth: 1,
    borderColor: '#292d35',
    borderRadius: 12,
    backgroundColor: '#171a20',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: '#707681',
  },
  metricValue: {
    marginTop: 5,
    fontSize: 24,
    fontWeight: 700,
  },
  pulseTrack: {
    width: '100%',
    height: 10,
    borderRadius: 999,
    backgroundColor: '#242831',
  },
  side: {
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  feature: {
    padding: 14,
    borderWidth: 1,
    borderColor: '#292d35',
    borderRadius: 12,
    backgroundColor: '#12151a',
  },
  featureName: {
    fontSize: 10,
    fontWeight: 700,
    color: '#717783',
  },
  featureDescription: {
    marginTop: 5,
    fontSize: 13,
    color: '#d7d8d2',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    paddingTop: 2,
    fontSize: 11,
    color: '#707681',
  },
} satisfies Record<string, GpuiStyle>;

interface MetricProps {
  label: string;
  value: Cell<string> | string;
}

function Metric(props: MetricProps) {
  const { label, value } = props;
  return (
    <div style={styles.metric}>
      <div style={styles.metricLabel}>{label}</div>
      <div style={styles.metricValue}>{value}</div>
    </div>
  );
}

export default function App() {
  const tick = Cell.source(0);
  const phase = Cell.derived(() => tick.get() % palette.length);
  const accent = Cell.derived<GpuiColor>(() => palette[phase.get()]);
  const accentSoft = Cell.derived<GpuiColor>(
    () => `${accent.get()}33` as GpuiColor
  );
  const pulseWidth = Cell.derived(() => `${24 + phase.get() * 22}%` as const);
  const status = Cell.derived(() =>
    tick.get() % 2 === 0 ? 'LIVE' : 'UPDATING'
  );
  const batch = Cell.derived(() => String(tick.get()).padStart(4, '0'));
  const phaseLabel = Cell.derived(() => `${phase.get() + 1} / 4`);
  const firstBranch = Cell.derived(() => phase.get() < 2);
  const reactiveStyle = Cell.derived<GpuiStyle>(() => ({
    width: pulseWidth.get(),
    height: 10,
    borderRadius: 999,
    backgroundColor: accent.get(),
  }));
  const badgeStyle = Cell.derived<GpuiStyle>(() => ({
    ...styles.liveBadge,
    color: accent.get(),
    borderColor: accent.get(),
    backgroundColor: accentSoft.get(),
  }));

  onSetup(() => {
    const timer = setInterval(() => tick.set(tick.get() + 1), 700);
    return () => clearInterval(timer);
  });

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <div>
          <div style={styles.eyebrow}>RETEND × GPUI / PHASE 2 SHOWCASE</div>
          <div style={styles.title}>Native renderer is alive.</div>
          <div style={styles.subtitle}>
            This screen uses only the currently implemented renderer surface.
          </div>
        </div>
        <div style={badgeStyle}>{status}</div>
      </div>

      <div style={styles.main}>
        <div style={styles.preview}>
          <img
            src="https://raw.githubusercontent.com/github/explore/main/topics/typescript/typescript.png"
            objectFit="contain"
            style={styles.image}
          />

          <div style={styles.metrics}>
            <Metric label="BATCH" value={batch} />
            <Metric label="ACCENT" value={accent} />
            <Metric label="PHASE" value={phaseLabel} />
          </div>

          <div>
            <div style={styles.eyebrow}>REACTIVE STYLE SNAPSHOT</div>
            <div style={{ ...styles.pulseTrack, marginTop: 9 }}>
              <div style={reactiveStyle} />
            </div>
          </div>

          {If(firstBranch, {
            true: () => (
              <div style={{ color: accent, fontSize: 14 }}>
                Control flow is currently rendering the first branch.
              </div>
            ),
            false: () => (
              <div style={{ color: accent, fontSize: 14 }}>
                The same retained range has switched to its second branch.
              </div>
            ),
          })}
        </div>

        <div style={styles.side}>
          {For(features, ([name, description]) => (
            <div style={styles.feature}>
              <div style={styles.featureName}>{name}</div>
              <div style={styles.featureDescription}>{description}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={styles.footer}>
        <div>Edit source/app.tsx to test HMR.</div>
        <div>Events and controls intentionally not used yet.</div>
      </div>
    </div>
  );
}
