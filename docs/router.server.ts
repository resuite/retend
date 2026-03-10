/// <reference types="vite/client" />

import { handleOgRequest } from './og.server';

export default {
  async fetch(request: Request, env: any, ctx: any) {
    const url = new URL(request.url);

    const ogResponse = await handleOgRequest(request, env, ctx, url);
    if (ogResponse) return ogResponse;

    if (url.pathname.startsWith('/api/')) {
      return new Response('Not found', { status: 404 });
    }

    return env.ASSETS.fetch(request);
  },
};
