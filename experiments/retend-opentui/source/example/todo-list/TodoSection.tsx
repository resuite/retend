import { For, type Cell } from 'retend';

import type { TodoItem } from './types';

import { ListItem } from './ListItem';

interface TodoSectionProps {
  title: string;
  list: Cell<TodoItem[]>;
  items: Cell<TodoItem[]>;
  onToggle: (id: number) => void;
}

export function TodoSection(props: TodoSectionProps) {
  const { title, list, items, onToggle } = props;

  return (
    <box marginX="3%">
      <b>{title}</b>
      {For(
        items,
        (item) => (
          <ListItem itemId={item.id} list={list} onToggle={onToggle} />
        ),
        { key: 'id' }
      )}
    </box>
  );
}
