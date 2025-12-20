import { Teleport } from 'retend-web';

export function TeleportedElement() {
  return (
    <div>
      <Teleport to="body"> This element should appear in the body</Teleport>
    </div>
  );
}
