import { Badge, Button, Field, Input } from 'innate-ui';

/** Design components from the innate-ui pkg.pr.new preview. */
export function InnateDemo() {
  return (
    <div class="flex flex-col gap-6">
      <div class="flex flex-wrap items-center gap-2">
        <Badge>Neutral</Badge>
        <Badge tone="orange">Preview</Badge>
        <Badge tone="green">Stable</Badge>
        <Badge tone="red">Removed</Badge>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <Button variant="primary">Create project</Button>
        <Button>Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Delete</Button>
      </div>
      <Field id="docs-email">
        <Field.Label>Email</Field.Label>
        <Input type="email" placeholder="ada@retend.dev" />
      </Field>
    </div>
  );
}
