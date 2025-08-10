import { Teleport } from 'retend/teleport';

export function TeleportedElement() {
  return (
    <div>
      <Teleport to="body"> This element should appear in the body</Teleport>
    </div>
  );
}
