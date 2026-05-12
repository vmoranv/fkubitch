import type { Env, JwtPayload } from '../types';

function base64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function stringToBuf(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

async function getKey(env: Env): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', stringToBuf(env.JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function signAccessToken(
  env: Env,
  payload: Omit<JwtPayload, 'iat' | 'exp'>
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(stringToBuf(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = base64url(stringToBuf(JSON.stringify({ ...payload, iat: now, exp: now + 900 })));
  const key = await getKey(env);
  const sig = await crypto.subtle.sign('HMAC', key, stringToBuf(`${header}.${body}`));
  return `${header}.${body}.${base64url(sig)}`;
}

export async function verifyAccessToken(
  env: Env,
  token: string
): Promise<JwtPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const key = await getKey(env);
    const valid = await crypto.subtle.verify('HMAC', key,
      base64urlDecode(parts[2]), stringToBuf(`${parts[0]}.${parts[1]}`));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(parts[1])));
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload as JwtPayload;
  } catch { return null; }
}

export function generateRefreshToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashToken(token: string): Promise<string> {
  const data = stringToBuf(token);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
