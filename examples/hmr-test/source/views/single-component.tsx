import { Cell, useScopeContext } from 'retend';
import { Count } from './scopes.ts';
import { ReturnsFragment } from './returns-fragment.tsx';
import { Input } from 'retend-utils/components';

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
  const value = Cell.source('message');
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
      Hi, <ReturnsFragment />
      <Input model={value} type="text" />
    </div>
  );
}
