/* Small drawings of each surface, built from boxes so they follow the theme. */

const FRAME =
  'home-card w-full max-w-64 rounded-t-xl border border-b-0 border-line bg-raised';

export function BrowserMock() {
  return (
    <div aria-hidden="true" class={FRAME}>
      <div class="border-line flex items-center gap-2 border-b px-3 py-2">
        <span class="flex gap-1">
          <span class="bg-line-strong size-1.5 rounded-full" />
          <span class="bg-line-strong size-1.5 rounded-full" />
          <span class="bg-line-strong size-1.5 rounded-full" />
        </span>
        <span class="bg-sunken text-ink-faint flex-1 truncate rounded-md px-2 py-0.5 font-mono text-[0.625rem]">
          localhost:5229
        </span>
      </div>
      <div class="flex flex-col gap-2 p-3 pb-6">
        <span class="bg-ink/75 h-2 w-1/2 rounded-full" />
        <span class="bg-line-strong h-1.5 w-5/6 rounded-full" />
        <span class="bg-line-strong h-1.5 w-2/3 rounded-full" />
        <span class="bg-ink mt-1 h-5 w-16 rounded-full" />
      </div>
    </div>
  );
}

export function WindowMock() {
  return (
    <div aria-hidden="true" class={[FRAME, 'flex overflow-hidden']}>
      <div class="border-line bg-sunken flex w-16 flex-col gap-2 border-r p-2.5">
        <span class="flex gap-1">
          <span class="size-1.5 rounded-full bg-[#ed6a5e]" />
          <span class="size-1.5 rounded-full bg-[#f5bf4f]" />
          <span class="size-1.5 rounded-full bg-[#61c554]" />
        </span>
        <span class="bg-ink/60 mt-2 h-1.5 w-full rounded-full" />
        <span class="bg-line-strong h-1.5 w-4/5 rounded-full" />
        <span class="bg-line-strong h-1.5 w-full rounded-full" />
        <span class="bg-line-strong h-1.5 w-3/5 rounded-full" />
      </div>
      <div class="flex flex-1 flex-col gap-2 p-3 pb-6">
        <span class="bg-ink/75 h-2 w-2/3 rounded-full" />
        <span class="mt-1 grid grid-cols-2 gap-1.5">
          <span class="border-line bg-paper h-8 rounded-md border" />
          <span class="border-line bg-paper h-8 rounded-md border" />
          <span class="border-line bg-paper h-8 rounded-md border" />
          <span class="border-line bg-sunken h-8 rounded-md border" />
        </span>
      </div>
    </div>
  );
}
