import { useScopeContext } from 'retend';
import { Count } from './scopes.ts';

export function NestedChildComponent() {
  const scopeValue = useScopeContext(Count);

  return (
    <output style={{ fontWeight: 'bold', fontSize: '13pt' }}>
      The count is {scopeValue}
      <br />
    </output>
  );
}

export function SingleComponent() {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '15px',
        border: '2px solid red',
        borderRadius: '15px',
      }}
    >
      This is a display component.
      <br />
      <NestedChildComponent />
    </div>
  );
}
