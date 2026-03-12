import { TextAttributes } from '@opentui/core';
import { Cell, type Cell as RetendCell } from 'retend';

import type { TodoItem } from './types';

import { Checkbox } from './Checkbox';

interface ListItemProps {
  itemId: number;
  list: RetendCell<TodoItem[]>;
  onToggle: (id: number) => void;
}

export function ListItem(props: ListItemProps) {
  const { itemId, list, onToggle } = props;
  const item = Cell.derived(
    () => list.get().find((entry) => entry.id === itemId)!
  );
  const isCompleted = Cell.derived(() => item.get().isCompleted);
  const textColor = Cell.derived(() =>
    item.get().isCompleted ? 'gray' : 'white'
  );
  const textAttributes = Cell.derived(() =>
    item.get().isCompleted
      ? TextAttributes.STRIKETHROUGH | TextAttributes.DIM
      : TextAttributes.NONE
  );
  const name = Cell.derived(() => item.get().name);
  const handleMouseDown = () => onToggle(itemId);

  return (
    <box
      paddingX={1}
      borderColor="gray"
      flexDirection="row"
      height={3}
      onMouseDown={handleMouseDown}
    >
      <Checkbox fg="orange" isChecked={isCompleted} />
      <text fg={textColor} attributes={textAttributes}>
        {' '}
        {name}
      </text>
    </box>
  );
}
