import { Cell } from 'retend';

import type { TodoItem } from './types';

export function useTodoList(initialItems: TodoItem[] = []) {
  const list = Cell.source<TodoItem[]>(initialItems, {
    equals: (a, b) => a === b,
  });

  const hasNoItems = Cell.derived(() => list.get().length === 0);
  const pendingItems = Cell.derived(() =>
    list.get().filter((item) => !item.isCompleted)
  );
  const completedItems = Cell.derived(() =>
    list.get().filter((item) => item.isCompleted)
  );

  const addItem = (name: string) => {
    const previousList = list.get();
    const item: TodoItem = {
      id: Date.now(),
      name,
      isCompleted: false,
    };
    list.set([item, ...previousList]);
  };

  const toggleComplete = (id: number) => {
    const nextList = [...list.get()];
    for (let index = 0; index < nextList.length; index += 1) {
      const item = nextList[index];
      if (item.id !== id) continue;
      item.isCompleted = !item.isCompleted;
      break;
    }
    list.set(nextList);
  };

  return {
    list,
    hasNoItems,
    pendingItems,
    completedItems,
    addItem,
    toggleComplete,
  };
}
