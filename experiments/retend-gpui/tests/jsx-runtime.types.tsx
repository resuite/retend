function jsxTypingProbe() {
  const validDiv = <div style={{ width: 120 }} />;
  const validTextarea = <textarea value="hello" minRows={2} maxRows={4} />;

  // @ts-expect-error textarea values are strings
  const invalidTextarea = <textarea value={123} />;
  // @ts-expect-error tabIndex is numeric
  const invalidDiv = <div tabIndex="0" />;

  void [validDiv, validTextarea, invalidTextarea, invalidDiv];
}

void jsxTypingProbe;
