import type { Context, Next } from 'hono';
import type { Env } from '../types';

// Cloudflare-provided "always passes" testing secret. When this (or no secret)
// is configured, Turnstile is effectively disabled — bypass entirely instead
// of round-tripping to siteverify, which still requires a matching dummy token.
const ALWAYS_PASS_SECRET = '1x0000000000000000000000000000000';

export async function turnstileVerify(c: Context<{ Bindings: Env }>, next: Next) {
  const secret = c.env.TURNSTILE_SECRET_KEY;
  if (!secret || secret === ALWAYS_PASS_SECRET) {
    await next();
    return;
  }

  const turnstileToken = c.req.header('X-Turnstile-Token');
  if (!turnstileToken) {
    return c.json({ success: false, error: '请完成人机验证' }, 400);
  }

  try {
    const formData = new FormData();
    formData.append('secret', secret);
    formData.append('response', turnstileToken);

    const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    });

    const outcome = await result.json() as { success: boolean };
    if (!outcome.success) {
      return c.json({ success: false, error: '人机验证失败' }, 400);
    }
  } catch {
    return c.json({ success: false, error: '人机验证服务异常' }, 500);
  }

  await next();
}
