import { Cell, For } from 'retend';
import {
  Alignment,
  Angle,
  AnimationFillMode,
  type AnimationDefinition,
  type CanvasStyle,
  type CanvasStyleValue,
  Length,
  TextAlign,
} from 'retend-canvas';
import { useRouter } from 'retend/router';

const animations: {
  name: string;
  definition: AnimationDefinition;
  duration: number;
  timingFunction?: [number, number, number, number];
}[] = [
  {
    name: 'Pulse',
    definition: {
      from: { scale: 1, opacity: 1 },
      '50%': { scale: 1.15, opacity: 0.7 },
      to: { scale: 1, opacity: 1 },
    },
    duration: 1500,
  },
  {
    name: 'Bounce',
    definition: {
      from: { translate: [Length.Px(0), Length.Px(0)] },
      '40%': { translate: [Length.Px(0), Length.Px(-60)] },
      '60%': { translate: [Length.Px(0), Length.Px(-60)] },
      to: { translate: [Length.Px(0), Length.Px(0)] },
    },
    duration: 800,
    timingFunction: [0.33, 1, 0.68, 1],
  },
  {
    name: 'Spin',
    definition: {
      from: { rotate: Angle.Deg(0) },
      to: { rotate: Angle.Deg(360) },
    },
    duration: 2000,
  },
  {
    name: 'Fade',
    definition: {
      from: { opacity: 0 },
      '50%': { opacity: 1 },
      to: { opacity: 0 },
    },
    duration: 2000,
  },
];

function useAnimationState() {
  const selectedIndex = Cell.source(0);
  const playing = Cell.source(false);
  const looping = Cell.source(true);
  const restartCounter = Cell.source(0);

  const currentAnimation = Cell.derived(() => {
    return animations[selectedIndex.get()];
  });

  const animatedStyle = Cell.derived((): CanvasStyleValue => {
    const anim = currentAnimation.get();
    if (!playing.get()) {
      return { ...style.demo };
    }
    restartCounter.get();
    const definition: AnimationDefinition = {};
    for (const k in anim.definition) {
      (definition as Record<string, unknown>)[k] = (
        anim.definition as Record<string, unknown>
      )[k];
    }
    return {
      ...style.demo,
      animationName: definition,
      animationDuration: anim.duration,
      animationIterationCount: looping.get() ? Infinity : 1,
      animationFillMode: AnimationFillMode.Both,
      ...(anim.timingFunction
        ? { animationTimingFunction: anim.timingFunction }
        : {}),
    };
  });

  const demoName = Cell.derived(() => currentAnimation.get().name);
  const playLabel = Cell.derived(() => (playing.get() ? 'Pause' : 'Play'));
  const loopLabel = Cell.derived(
    () => 'Loop: ' + (looping.get() ? 'On' : 'Off')
  );

  const play = () => {
    playing.set(true);
    restartCounter.set(restartCounter.get() + 1);
  };

  const pause = () => {
    playing.set(false);
  };

  const restart = () => {
    restartCounter.set(restartCounter.get() + 1);
  };

  const togglePlay = () => {
    if (playing.get()) pause();
    else play();
  };

  const toggleLoop = () => {
    looping.set(!looping.get());
  };

  const selectAnimation = (i: number) => {
    selectedIndex.set(i);
    if (playing.get()) {
      restartCounter.set(restartCounter.get() + 1);
    }
  };

  const tabStyleFor = (i: number) =>
    Cell.derived(
      (): CanvasStyleValue => ({
        ...(i === selectedIndex.get() ? style.tabActive : style.tab),
        translate: [Length.Px(-135 + i * 90), Length.Px(180)],
      })
    );

  return {
    animatedStyle,
    demoName,
    playLabel,
    loopLabel,
    togglePlay,
    restart,
    toggleLoop,
    selectAnimation,
    tabStyleFor,
  };
}

const Animation = () => {
  const router = useRouter();
  const state = useAnimationState();

  return (
    <rect style={style.container}>
      <rect
        style={style.back}
        onClick={() => {
          router.navigate('/');
        }}
      >
        <text style={style.backLabel}>Back</text>
      </rect>
      <text style={style.title}>Animation</text>

      <rect style={style.preview}>
        <rect style={state.animatedStyle}>
          <text style={style.demoLabel}>{state.demoName}</text>
        </rect>
      </rect>

      <rect
        style={{ ...style.btn, translate: [Length.Px(-140), Length.Px(80)] }}
        onClick={state.togglePlay}
      >
        <text style={style.btnLabel}>{state.playLabel}</text>
      </rect>
      <rect
        style={{ ...style.btn, translate: [Length.Px(-46), Length.Px(80)] }}
        onClick={state.restart}
      >
        <text style={style.btnLabel}>Restart</text>
      </rect>
      <rect
        style={{ ...style.btn, translate: [Length.Px(48), Length.Px(80)] }}
        onClick={state.toggleLoop}
      >
        <text style={style.btnLabel}>{state.loopLabel}</text>
      </rect>

      {For(animations, (anim, i) => (
        <rect
          style={state.tabStyleFor(i.peek())}
          onClick={() => {
            state.selectAnimation(i.peek());
          }}
        >
          <text style={style.tabLabel}>{anim.name}</text>
        </rect>
      ))}
    </rect>
  );
};

const style = {
  container: {
    backgroundColor: '#f8fafc',
    color: '#1e293b',
    fontFamily: 'Maple Mono',
    fontSize: Length.Px(12),
    height: Length.Vh(100),
  },
  back: {
    width: Length.Px(72),
    height: Length.Px(40),
    backgroundColor: 'white',
    borderColor: '#cbd5e1',
    borderWidth: Length.Px(1),
    translate: [Length.Px(16), Length.Px(16)],
  },
  backLabel: {
    alignSelf: Alignment.Center,
    textAlign: TextAlign.Center,
    width: Length.Pct(100),
  },
  title: {
    alignSelf: Alignment.Center,
    justifySelf: Alignment.Center,
    fontSize: Length.Px(28),
    translate: [Length.Px(0), Length.Px(-220)],
  },
  preview: {
    alignSelf: Alignment.Center,
    justifySelf: Alignment.Center,
    width: Length.Px(200),
    height: Length.Px(200),
    backgroundColor: 'white',
    borderColor: '#e2e8f0',
    borderWidth: Length.Px(1),
    borderRadius: Length.Px(12),
    translate: [Length.Px(0), Length.Px(-80)],
  },
  demo: {
    alignSelf: Alignment.Center,
    justifySelf: Alignment.Center,
    width: Length.Px(80),
    height: Length.Px(80),
    backgroundColor: '#6366f1',
    borderRadius: Length.Px(16),
    color: 'white',
  } satisfies CanvasStyle,
  demoLabel: {
    alignSelf: Alignment.Center,
    justifySelf: Alignment.Center,
    textAlign: TextAlign.Center,
    width: Length.Pct(100),
  },
  btn: {
    width: Length.Px(88),
    height: Length.Px(36),
    backgroundColor: '#6366f1',
    borderRadius: Length.Px(8),
    color: 'white',
    alignSelf: Alignment.Center,
    justifySelf: Alignment.Center,
  } satisfies CanvasStyle,
  btnLabel: {
    alignSelf: Alignment.Center,
    textAlign: TextAlign.Center,
    width: Length.Pct(100),
  },
  tab: {
    width: Length.Px(80),
    height: Length.Px(36),
    backgroundColor: 'white',
    borderColor: '#cbd5e1',
    borderWidth: Length.Px(1),
    borderRadius: Length.Px(8),
    color: '#1e293b',
    alignSelf: Alignment.Center,
    justifySelf: Alignment.Center,
  } satisfies CanvasStyle,
  tabActive: {
    width: Length.Px(80),
    height: Length.Px(36),
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
    borderWidth: Length.Px(1),
    borderRadius: Length.Px(8),
    color: 'white',
    alignSelf: Alignment.Center,
    justifySelf: Alignment.Center,
  } satisfies CanvasStyle,
  tabLabel: {
    alignSelf: Alignment.Center,
    textAlign: TextAlign.Center,
    width: Length.Pct(100),
  },
} satisfies Record<string, CanvasStyle>;

export default Animation;
