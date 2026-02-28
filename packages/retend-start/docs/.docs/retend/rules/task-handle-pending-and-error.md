| title              | impact | impactDescription                               | tags                             |
| :----------------- | :----- | :---------------------------------------------- | :------------------------------- |
| Handle Task States | MEDIUM | Provides user feedback during async operations. | cells, task, ux, loading, errors |

# Handle pending and error states from Cell.task()

**Rule**: Always handle the `.pending` and `.error` states to provide user feedback.

**Why**: Users need visual feedback while operations are in progress and clear error messages when things fail.

**Invalid**:

```tsx
function DeleteButton(props: { id: Cell<string> }) {
  const { id } = props;
  const deleteTask = Cell.task(async (itemId: string, signal) => {
    return await deleteItem(itemId, signal);
  });

  // BAD: No loading or error feedback
  return <button onClick={() => deleteTask.runWith(id.get())}>Delete</button>;
}
```

**Valid**:

```tsx
function DeleteButton(props: { id: Cell<string> }) {
  const { id } = props;
  const deleteTask = Cell.task(async (itemId: string, signal) => {
    return await deleteItem(itemId, signal);
  });

  return (
    <>
      <button
        onClick={() => deleteTask.runWith(id.get())}
        disabled={deleteTask.pending}
      >
        {If(deleteTask.pending, {
          true: () => 'Deleting...',
          false: () => 'Delete',
        })}
      </button>
      {If(deleteTask.error, (err) => (
        <p class="error">{err.message}</p>
      ))}
    </>
  );
}
```

**Note**: Unlike `Cell.derivedAsync()`, tasks start with `.pending` as `false` until the first `runWith()` call.
