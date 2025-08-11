import { useScopeContext } from 'retend';
import { Count } from './scopes';

export function ReturnsFragment() {
  const count = useScopeContext(Count);
  return (
    <>
      Wait. How is life? i hope you are happy. The count is {count}
      <div>Hello</div>
    </>
  );
}
