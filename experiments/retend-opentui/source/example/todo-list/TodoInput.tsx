import { type InputRenderable } from '@opentui/core';
import { Cell } from 'retend';

interface TodoInputProps {
  onSubmit: (value: string) => void;
}

export function TodoInput(props: TodoInputProps) {
  const { onSubmit } = props;
  const inputRef = Cell.source<InputRenderable | null>(null);

  const handleSubmit = () => {
    const input = inputRef.get();
    if (!input) return;

    const value = input.value.trim();
    if (!value) return;

    onSubmit(value);
    input.value = '';
  };

  return (
    <box width="100%" flexDirection="row" gap={1} flexWrap="wrap">
      <box borderColor="gray" flexGrow={1}>
        <input
          ref={inputRef}
          marginX={2}
          placeholder="Enter a new item..."
          onSubmit={handleSubmit}
        />
      </box>
      <box
        borderColor="gray"
        borderStyle="double"
        width="20%"
        alignItems="center"
        onMouseDown={handleSubmit}
      >
        <text fg="orange">+add</text>
      </box>
    </box>
  );
}
