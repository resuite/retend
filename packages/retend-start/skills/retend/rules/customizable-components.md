| title                          | impact | impactDescription                                                | tags                          |
| :----------------------------- | :----- | :--------------------------------------------------------------- | :---------------------------- |
| Favor Extension over Invention | High   | Ensures typesafety and standard behavior for wrapper components. | composition, props, standards |

# Favor Extension over Invention

**Rule**:

- **ALWAYS** extend standard HTML interfaces (e.g., `JSX.IntrinsicElements['button']`, `JSX.HTMLAttributes<HTMLDivElement>`) when building wrapper components.
- **NEVER** manually redefine standard attributes (like `onClick`, `class`, `href`, `type`, `disabled`) in your prop interfaces.
- **ALWAYS** use the spread operator (`...rest`) to pass unhandled props to the underlying element.

**Why**:

- **Typesafety**: Standard interfaces are complete and maintained. Manual redefinitions are often incomplete (e.g., `onClick: () => void` loses the Event object).
- **Maintenance**: You don't need to manually add every new standard attribute.
- **Flexibility**: Consumers expect standard attributes to just work.
- **Reactivity Preservation**: The spread operator `...rest` preserves reactivity for any Cell objects passed through.

## Examples

### Invalid

Redefining standard attributes manually ("Invention").

```tsx
interface ButtonProps {
  children: JSX.Children;
  variant?: 'primary' | 'secondary';
  // Don't do this! These are already in <button>
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  onClick?: () => void;
  class?: string;
}

const Button = (props: ButtonProps) => {
  const {
    children,
    variant = 'primary',
    type = 'button',
    disabled = false,
    onClick,
    class: className = '',
  } = props;

  // Checking/assigning each one manually is error-prone and verbose
  return (
    <button
      className={className}
      type={type}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
};
```

### Valid

Extending the base element ("Extension").

```tsx
type NativeButtonProps = JSX.IntrinsicElements['button'];
interface ButtonProps extends NativeButtonProps {
  variant?: 'primary' | 'secondary';
}

const Button = (props: ButtonProps) => {
  // Destructure YOUR custom props
  const {
    children,
    variant = 'primary',
    class: className,
    ...rest // Capture legitimate standard props
  } = props;

  return (
    <button
      // Apply your custom logic (e.g. classes)
      class={['btn', `btn-${variant}`, className]}
      // Spread the rest (onClick, type, disabled, aria-*, etc.)
      {...rest}
    >
      {children}
    </button>
  );
};
```
