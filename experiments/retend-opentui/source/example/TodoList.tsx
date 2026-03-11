import { If } from 'retend';

import { Heading } from './Heading';
import { EmptyState } from './todo-list/EmptyState';
import { TodoInput } from './todo-list/TodoInput';
import { TodoSection } from './todo-list/TodoSection';
import { useTodoList } from './todo-list/useTodoList';

export function TodoList() {
  const {
    list,
    hasNoItems,
    pendingItems,
    completedItems,
    addItem,
    toggleComplete,
  } = useTodoList([
    {
      id: 1,
      name: 'Create docs',
      isCompleted: false,
    },
    {
      id: 2,
      name: 'Implement OpenTUI Renderer',
      isCompleted: false,
    },
    {
      id: 3,
      name: 'Implement Lynx Renderer',
      isCompleted: false,
    },
  ]);

  return (
    <box
      maxWidth={70}
      alignItems="center"
      justifyContent="center"
      height="100%"
      width="100%"
    >
      <Heading />

      <box justifyContent="center" width="100%">
        Add an item to the list:
      </box>

      <TodoInput onSubmit={addItem} />

      <br />

      <box
        maxHeight="50%"
        width="100%"
        alignItems="center"
        justifyContent="center"
        borderColor="orange"
        borderStyle="double"
      >
        <scrollbox maxWidth="95%" borderColor="gray" borderStyle="double">
          <br />
          {If(hasNoItems, {
            true: () => <EmptyState />,
            false: () => (
              <>
                <TodoSection
                  title="Pending items"
                  list={list}
                  items={pendingItems}
                  onToggle={toggleComplete}
                />
                <br />
                <TodoSection
                  title="Completed items"
                  list={list}
                  items={completedItems}
                  onToggle={toggleComplete}
                />
              </>
            ),
          })}
        </scrollbox>
      </box>
    </box>
  );
}
