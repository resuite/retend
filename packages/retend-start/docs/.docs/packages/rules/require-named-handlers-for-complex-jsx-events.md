| title                                     | impact | impactDescription                              | tags                        |
| :---------------------------------------- | :----- | :--------------------------------------------- | :-------------------------- |
| Require Named Handlers For Complex Events | HIGH   | Keeps branching event logic out of JSX markup. | events, handlers, structure |

# Require Named Handlers For Complex JSX Events

**Rule**: Inline JSX event handlers may contain one simple call or assignment. Complex logic should use a named handler.

**Why**:

- **Readability**: JSX stays focused on structure.
- **Reviewability**: Branching, local variables, awaits, and error handling get a name.

## Invalid

```tsx
<button
  onClick={() => {
    if (disabled.get()) return;
    submitTask.run();
  }}
>
  Submit
</button>
```

## Valid

```tsx
const handleSubmit = () => {
  if (disabled.get()) return;
  submitTask.run();
};

<button onClick={handleSubmit}>Submit</button>;
```
