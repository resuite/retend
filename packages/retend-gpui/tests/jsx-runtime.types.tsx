import type { GpuiWheelEvent } from '../source/index';

function jsxTypingProbe() {
  const handleClick = () => {};
  const handleWheel = (event: GpuiWheelEvent) => {
    const mode: 0 | 1 = event.deltaMode;
    const phase: 'started' | 'moved' | 'ended' | 'cancelled' = event.touchPhase;
    void [
      mode,
      phase,
      event.deltaX,
      event.deltaY,
      event.clientX,
      event.ctrlKey,
    ];
  };
  const validDiv = (
    <div
      onWheel={handleWheel}
      onWheel--once={handleWheel}
      style={{
        width: 120,
        opacity: 0.5,
        backgroundColor: '#ff0000',
        transitionProperty: ['width', 'opacity', 'backgroundColor'],
        transitionDuration: '.2s',
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
        focused: { borderColor: '#000000' },
      }}
    />
  );
  const validTextarea = (
    <textarea value="hello" placeholder="Write here" minRows={2} maxRows={4} />
  );
  const validButton = (
    <button disabled onClick={handleClick}>
      Save
    </button>
  );

  // @ts-expect-error textarea values are strings
  const invalidTextarea = <textarea value={123} />;
  // @ts-expect-error tabIndex is numeric
  const invalidDiv = <div tabIndex="0" />;

  void [validDiv, validTextarea, validButton, invalidTextarea, invalidDiv];
}

void jsxTypingProbe;
