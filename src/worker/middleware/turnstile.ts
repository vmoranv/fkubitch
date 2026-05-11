import type { Context, Next } from 'hono';
import type { Env } from '../types';

export async function turnstileVerify(c: Context<{ Bindings: Env }>, next: Next) {
  const turnstileToken = c.req.header('X-Turnstile-Token');

  if (!turnstileToken) {
    return c.json({ success: false, error: '请完成人机验证' }, 400);
  }

  try {
    const formData = new FormData();
    formData.append('secret', c.env.TURNSTILE_SECRET_KEY);
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
