import type { Env } from '../types';
import { sha256 } from '../utils';

function base64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function generateCodeVerifier(): Promise<string> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64url(digest);
}

export function getGitHubAuthUrl(clientId: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: '/api/auth/github/callback',
    scope: 'read:user user:email',
    state,
  });
  return `https://github.com/login/oauth/authorize?${params}`;
}

export function getGoogleAuthUrl(clientId: string, codeChallenge: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: '/api/auth/google/callback',
    response_type: 'code',
    scope: 'openid email profile',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeGitHubCode(
  code: string,
  clientId: string,
  clientSecret: string
): Promise<{ providerUserId: string; email: string | null; login: string; avatarUrl: string }> {
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
  if (!tokenData.access_token) {
    throw new Error(`GitHub token exchange failed: ${tokenData.error || 'unknown'}`);
  }

  const userRes = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const userData = await userRes.json() as { id: number; login: string; email: string | null; avatar_url: string };

  let email = userData.email;
  if (!email) {
    const emailsRes = await fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const emails = await emailsRes.json() as Array<{ email: string; primary: boolean; verified: boolean }>;
    const primary = emails.find((e) => e.primary && e.verified);
    if (primary) email = primary.email;
  }

  return {
    providerUserId: String(userData.id),
    email,
    login: userData.login,
    avatarUrl: userData.avatar_url,
  };
}

export async function exchangeGoogleCode(
  code: string,
  codeVerifier: string,
  clientId: string,
  clientSecret: string
): Promise<{ providerUserId: string; email: string | null; name: string; avatarUrl: string }> {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      code_verifier: codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: '/api/auth/google/callback',
    }),
  });

  const tokenData = await tokenRes.json() as { access_token?: string; id_token?: string; error?: string };
  if (!tokenData.id_token) {
    throw new Error(`Google token exchange failed: ${tokenData.error || 'unknown'}`);
  }

  const idParts = tokenData.id_token.split('.');
  if (idParts.length !== 3) throw new Error('Invalid Google ID token');
  const payload = JSON.parse(atob(idParts[1])) as {
    sub: string; email?: string; name?: string; picture?: string;
    iss: string; aud: string; exp: number;
  };

  if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') {
    throw new Error('Invalid Google token issuer');
  }

  return {
    providerUserId: payload.sub,
    email: payload.email || null,
    name: payload.name || 'Google User',
    avatarUrl: payload.picture || '',
  };
}
