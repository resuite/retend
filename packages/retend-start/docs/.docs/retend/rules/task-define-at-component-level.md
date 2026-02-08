| title | impact | impactDescription | tags |
| :--------------------------- | :------- | :--------------------------------------------------- | :------------------------------------ |
| Define Tasks at Component Level | MEDIUM | Maintains stable references and proper state tracking. | cells, task, components, structure |

# Define Cell.task() at component level

**Rule**: Define tasks in the component body, not inside event handlers.

**Why**: Creating tasks inside handlers loses reference stability and creates a new task on each invocation, making it impossible to track `.pending` and `.error` states properly.

**Invalid**:
```tsx
function SubmitForm() {
  const handleClick = () => {
    // BAD: Creates new task on each click
    const task = Cell.task(async (data, signal) => {
      return await submitForm(data, signal);
    });
    task.runWith(formData);
  };
  
  return <button onClick={handleClick}>Submit</button>;
}
```

**Valid**:
```tsx
function SubmitForm() {
  // GOOD: Task defined at component level
  const submitTask = Cell.task(async (data: FormData, signal) => {
    return await submitForm(data, signal);
  });
  
  const handleClick = () => {
    submitTask.runWith(formData);
  };
  
  return (
    <button onClick={handleClick} disabled={submitTask.pending}>
      {If(submitTask.pending, {
        true: () => 'Submitting...',
        false: () => 'Submit'
      })}
    </button>
  );
}
```
