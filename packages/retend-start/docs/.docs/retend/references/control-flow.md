# Control Flow Directives

Retend provides special control flow directives instead of using inline conditionals and .map() in JSX. These directives are optimized for reactivity.

## If

Conditional rendering with explicit true/false branches.

### Basic Usage

```tsx
import { Cell, If } from 'retend';

function Message() {
  const isLoggedIn = Cell.source(false);

  return If(isLoggedIn, {
    true: () => <p>Welcome back!</p>,
    false: () => <p>Please log in</p>,
  });
}
```

### Single Branch (Only True)

```tsx
function OptionalMessage() {
  const showMessage = Cell.source(true);

  return (
    <div>
      {If(showMessage, () => (
        <p>This message is conditional</p>
      ))}
    </div>
  );
}
```

### With Derived Cells

```tsx
function UserGreeting() {
  const user = Cell.source({ name: 'Alice', age: 25 });
  const isAdult = Cell.derived(() => user.get().age >= 18);

  return If(isAdult, {
    true: () => <p>Welcome, adult user!</p>,
    false: () => <p>Parental supervision required</p>,
  });
}
```

### Nested If Statements

```tsx
function StatusMessage() {
  const isLoading = Cell.source(false);
  const hasError = Cell.source(false);
  const data = Cell.source(null);

  return If(isLoading, {
    true: () => <p>Loading...</p>,
    false: () =>
      If(hasError, {
        true: () => <p>Error occurred!</p>,
        false: () =>
          If(
            Cell.derived(() => data.get() !== null),
            {
              true: () => <p>Data: {data}</p>,
              false: () => <p>No data</p>,
            }
          ),
      }),
  });
}
```

## For

List rendering with automatic keying and efficient updates.

### Basic Usage with Primitives

```tsx
import { Cell, For } from 'retend';

function NumberList() {
  const numbers = Cell.source([1, 2, 3, 4, 5]);

  return (
    <ul>
      {For(numbers, (num) => (
        <li>Number: {num}</li>
      ))}
    </ul>
  );
}
```

### With Objects (Auto-Keying)

```tsx
function TodoList() {
  const todos = Cell.source([
    { id: 1, text: 'Learn Retend', done: false },
    { id: 2, text: 'Build app', done: false },
    { id: 3, text: 'Deploy', done: false },
  ]);

  return (
    <ul>
      {For(todos, (todo) => (
        <li>
          <input type="checkbox" checked={todo.done} />
          {todo.text}
        </li>
      ))}
    </ul>
  );
}
```

**Note:** Retend automatically uses the first property (usually `id`) as the key for objects.

### With Index

```tsx
function IndexedList() {
  const items = Cell.source(['Apple', 'Banana', 'Cherry']);

  return (
    <ul>
      {For(items, (item, index) => (
        <li>
          {index + 1}. {item}
        </li>
      ))}
    </ul>
  );
}
```

### Derived Lists

```tsx
function FilteredList() {
  const items = Cell.source(['Apple', 'Banana', 'Cherry', 'Date']);
  const filter = Cell.source('');

  const filtered = Cell.derived(() =>
    items
      .get()
      .filter((item) => item.toLowerCase().includes(filter.get().toLowerCase()))
  );

  const handleInput = (e) => filter.set(e.target.value);

  return (
    <div>
      <input type="text" value={filter} onInput={handleInput} />
      <ul>
        {For(filtered, (item) => (
          <li>{item}</li>
        ))}
      </ul>
    </div>
  );
}
```

### Nested For Loops

```tsx
function NestedList() {
  const categories = Cell.source([
    { name: 'Fruits', items: ['Apple', 'Banana'] },
    { name: 'Vegetables', items: ['Carrot', 'Broccoli'] },
  ]);

  return (
    <div>
      {For(categories, (category) => (
        <div>
          <h3>{category.name}</h3>
          <ul>
            {For(Cell.source(category.items), (item) => (
              <li>{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
```

## Switch

Multi-branch conditionals, similar to switch statements.

### Basic Usage

```tsx
import { Cell, Switch } from 'retend';

function StatusIndicator() {
  const status = Cell.source('idle');

  return Switch(status, {
    idle: () => <span>⚪ Idle</span>,
    loading: () => <span>🔵 Loading...</span>,
    success: () => <span>🟢 Success!</span>,
    error: () => <span>🔴 Error</span>,
  });
}
```

### With Default Case

```tsx
function ColorIndicator() {
  const color = Cell.source('blue');

  return Switch(
    color,
    {
      red: () => <div style={{ background: 'red' }}>Red</div>,
      green: () => <div style={{ background: 'green' }}>Green</div>,
      blue: () => <div style={{ background: 'blue' }}>Blue</div>,
    },
    () => <div style={{ background: 'gray' }}>Unknown color</div>
  );
}
```

### With Derived Values

```tsx
function SubscriptionBadge() {
  const user = Cell.source({ tier: 'premium' });
  const tier = Cell.derived(() => user.get().tier);

  return Switch(
    tier,
    {
      free: () => <span class="badge badge-gray">Free</span>,
      basic: () => <span class="badge badge-blue">Basic</span>,
      premium: () => <span class="badge badge-gold">Premium</span>,
    },
    () => <span class="badge">Unknown</span>
  );
}
```

### Dynamic Cases

```tsx
function NumberCategory() {
  const number = Cell.source(7);
  const category = Cell.derived(() => {
    const n = number.get();
    if (n < 0) return 'negative';
    if (n === 0) return 'zero';
    if (n > 0 && n < 10) return 'single-digit';
    return 'multi-digit';
  });

  return Switch(category, {
    negative: () => <p>Number is negative</p>,
    zero: () => <p>Number is zero</p>,
    'single-digit': () => <p>Number is a single digit</p>,
    'multi-digit': () => <p>Number has multiple digits</p>,
  });
}
```

## Lifecycle Hooks

### onSetup

Runs a setup function when the component is initialized. Useful for starting timers, subscriptions, or other side effects.

```tsx
import { Cell, onSetup } from 'retend';

function Timer() {
  const time = Cell.source(new Date());

  onSetup(() => {
    const timer = setInterval(() => {
      time.set(new Date());
    }, 1000);

    // Return cleanup function
    return () => clearInterval(timer);
  });

  return <p>Current time: {time}</p>;
}
```

### useObserver

Used to observe the lifecycle of DOM elements (connected/disconnected).

```tsx
import { Cell, useObserver } from 'retend';

function AutoFocusInput() {
  const inputRef = Cell.source(null);
  const observer = useObserver();

  // Run when element is connected to DOM
  observer.onConnected(inputRef, (element) => {
    element.focus();

    return () => {
      console.log('Input disconnect cleanup');
    };
  });

  return <input ref={inputRef} />;
}
```

## Combining Control Flow

### Complex Conditional Lists

```tsx
function FilteredTodoList() {
  const todos = Cell.source([
    { id: 1, text: 'Learn Retend', done: true },
    { id: 2, text: 'Build app', done: false },
    { id: 3, text: 'Deploy', done: false },
  ]);

  const filter = Cell.source('all'); // 'all', 'active', 'completed'

  const filtered = Cell.derived(() => {
    const f = filter.get();
    const items = todos.get();
    if (f === 'active') return items.filter((t) => !t.done);
    if (f === 'completed') return items.filter((t) => t.done);
    return items;
  });

  const hasTodos = Cell.derived(() => filtered.get().length > 0);
  const handleFilterChange = (e) => filter.set(e.target.value);

  return (
    <div>
      <select onChange={handleFilterChange}>
        <option value="all">All</option>
        <option value="active">Active</option>
        <option value="completed">Completed</option>
      </select>

      {If(hasTodos, {
        true: () => (
          <ul>
            {For(filtered, (todo) => (
              <li class={[{ done: todo.done }]}>{todo.text}</li>
            ))}
          </ul>
        ),
        false: () => <p>No todos to display</p>,
      })}
    </div>
  );
}
```

### Switch with For Loops

```tsx
function ViewSwitcher() {
  const view = Cell.source('list'); // 'list', 'grid', 'table'
  const items = Cell.source([
    { id: 1, name: 'Item 1' },
    { id: 2, name: 'Item 2' },
    { id: 3, name: 'Item 3' },
  ]);

  const handleViewChange = (e) => view.set(e.target.value);

  return (
    <div>
      <select onChange={handleViewChange}>
        <option value="list">List</option>
        <option value="grid">Grid</option>
        <option value="table">Table</option>
      </select>

      {Switch(view, {
        list: () => (
          <ul>
            {For(items, (item) => (
              <li>{item.name}</li>
            ))}
          </ul>
        ),
        grid: () => (
          <div class="grid">
            {For(items, (item) => (
              <div class="card">{item.name}</div>
            ))}
          </div>
        ),
        table: () => (
          <table>
            <tbody>
              {For(items, (item) => (
                <tr>
                  <td>{item.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ),
      })}
    </div>
  );
}
```
