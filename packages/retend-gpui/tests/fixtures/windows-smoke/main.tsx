import fs from 'node:fs';

export default function Root() {
  const marker = process.env.RETEND_GPUI_SMOKE_MARKER;
  if (marker) {
    fs.writeFileSync(marker, 'mounted');
    setTimeout(() => process.exit(0), 100);
  }
  return <div>GPUI smoke</div>;
}
