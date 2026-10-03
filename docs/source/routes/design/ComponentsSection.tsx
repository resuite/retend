import { ThemePair } from '@/ds/ThemePair';

import { BasicsDemo } from './BasicsDemo';
import { CodeDemo } from './CodeDemo';
import { Section } from './Section';
import { StructureDemo } from './StructureDemo';

export function ComponentsSection() {
  return (
    <>
      <Section
        id="basics"
        title="Basics"
        description="Badges, callouts, keyboard keys and link cards. Callouts name their type in text, so color is never the only signal."
      >
        <ThemePair render={() => <BasicsDemo />} />
      </Section>
      <Section
        id="code"
        title="Code and tabs"
        description="Code frames with filename, line emphasis and copy. Tabs support arrow keys, Home and End. The copy button and tabs need a browser to try."
      >
        <ThemePair render={(theme) => <CodeDemo theme={theme} />} />
      </Section>
      <Section
        id="structure"
        title="Steps and prop tables"
        description="The two blocks the API reference and tutorials will lean on. The table documents the code frame itself."
      >
        <ThemePair render={() => <StructureDemo />} />
      </Section>
    </>
  );
}
