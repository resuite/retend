function jsxTypingProbe() {
  const validDiv = (
    <div
      style={{
        width: 120,
        opacity: 0.5,
        transitionProperty: ['width', 'opacity'],
        transitionDuration: '.2s',
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    />
  );
  const validTextarea = <textarea value="hello" minRows={2} maxRows={4} />;

  // @ts-expect-error textarea values are strings
  const invalidTextarea = <textarea value={123} />;
  // @ts-expect-error tabIndex is numeric
  const invalidDiv = <div tabIndex="0" />;

  void [validDiv, validTextarea, invalidTextarea, invalidDiv];
}

void jsxTypingProbe;
