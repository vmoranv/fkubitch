import type { Env, JwtPayload } from '../types';
import * as jose from 'jose';

let cachedSecret: jose.KeyLike | null = null;

async function getSecret(env: Env): Promise<jose.KeyLike> {
  if (!cachedSecret) {
    const encoder = new TextEncoder();
    cachedSecret = await jose.importJWK(
      { kty: 'oct', k: btoa(env.JWT_SECRET).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), alg: 'HS256' },
      'HS256'
    );
  }
  return cachedSecret;
}

export async function signAccessToken(
  env: Env,
  payload: Omit<JwtPayload, 'iat' | 'exp'>
): Promise<string> {
  const secret = await getSecret(env);
  const now = Math.floor(Date.now() / 1000);
  return new jose.SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime('15 minutes')
    .sign(secret);
}

export async function verifyAccessToken(
  env: Env,
  token: string
): Promise<JwtPayload | null> {
  try {
    const secret = await getSecret(env);
    const { payload } = await jose.jwtVerify(token, secret, {
      algorithms: ['HS256'],
    });
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

export function generateRefreshToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
