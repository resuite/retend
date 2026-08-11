Given this, will this patten work:

```tsx
const MyWrapperComponent = (props: MyWrapperProps) => {
  const { children } = props;
  const ref = Cell.source<HTMLElement[]>(null);
  const firstElementRef = Cell.derived(() => ref.get()?.[0]);

  onConnected(firstElementRef, (el) => {
    console.log('The first element in the fragment is ', el);
  });

  return <Fragment ref={ref}>{children}</Fragment>;
};
```
