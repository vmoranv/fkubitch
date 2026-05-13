import type { Context, Next } from 'hono';
import type { AppType } from '../types';

interface Options {
  cacheName?: string;
  maxAge: number;
  swr?: number;
}

export function edgeCache({ cacheName = 'api', maxAge, swr }: Options) {
  return async (c: Context<AppType>, next: Next) => {
    if (c.req.method !== 'GET') {
      await next();
      return;
    }
    if (typeof caches === 'undefined') {
      await next();
      return;
    }

    const cache = await caches.open(cacheName);
    const key = new Request(c.req.url, { method: 'GET' });
    const hit = await cache.match(key);
    if (hit) return new Response(hit.body, hit);

    await next();
    if (c.res.status !== 200) return;

    const cloned = c.res.clone();
    const headers = new Headers(cloned.headers);
    const directives = [`public`, `max-age=${maxAge}`, `s-maxage=${maxAge}`];
    if (swr) directives.push(`stale-while-revalidate=${swr}`);
    headers.set('Cache-Control', directives.join(', '));
    const stored = new Response(cloned.body, { status: 200, statusText: cloned.statusText, headers });
    c.res = stored.clone();
    c.executionCtx.waitUntil(cache.put(key, stored));
  };
}
