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
    // Browser must always revalidate; edge serves cached for `maxAge` seconds.
    // Otherwise stale leaderboards/challenges stick to a tab for the full TTL.
    const directives = [`public`, `max-age=0`, `s-maxage=${maxAge}`, `must-revalidate`];
    if (swr) directives.push(`stale-while-revalidate=${swr}`);
    headers.set('Cache-Control', directives.join(', '));
    const stored = new Response(cloned.body, { status: 200, statusText: cloned.statusText, headers });
    c.res = stored.clone();
    c.executionCtx.waitUntil(cache.put(key, stored));
  };
}

// CF Cache API has no wildcard delete, so callers must enumerate the URL
// variants they want to purge. Pass paths relative to the request's origin
// (e.g. '/api/leaderboard', '/api/leaderboard?limit=10').
export async function purgeCache(
  c: Context<AppType>,
  cacheName: string,
  paths: string[],
): Promise<void> {
  if (typeof caches === 'undefined') return;
  const cache = await caches.open(cacheName);
  const origin = new URL(c.req.url).origin;
  await Promise.all(
    paths.map((p) => cache.delete(new Request(origin + p, { method: 'GET' }))),
  );
}
