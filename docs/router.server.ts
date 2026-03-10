export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname.startsWith('/api/')) {
      return new Response('Not found', { status: 404 });
    }

    return env.ASSETS.fetch(request);
  },
};
