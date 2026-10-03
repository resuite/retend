import { Outlet } from 'retend/router';

import { DocsSidebar } from '../routes/docs/DocsSidebar';

export function DocsLayout() {
  return (
    <div class="mx-auto max-w-300 px-5 pt-7 sm:px-6 md:px-10 md:pt-14">
      <section class="grid grid-cols-1 gap-10 text-balance lg:grid-cols-[220px_minmax(0,1fr)_200px] lg:gap-10">
        <DocsSidebar />
        <Outlet />
      </section>
    </div>
  );
}
