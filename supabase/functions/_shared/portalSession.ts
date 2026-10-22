// Sessão do portal do cliente. No Base44 o portal guardava o id do cliente em
// texto puro, então qualquer um que soubesse um id via os dados de outra
// pessoa. Aqui a sessão é um token assinado (HMAC) com validade.
//
// Segredo: PORTAL_SESSION_SECRET (qualquer texto longo e aleatório).

import { HttpError } from './http.ts';

const enc = new TextEncoder();

function b64url(bytes: Uint8Array) {
  let s = '';
  bytes.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function key() {
  const secret = Deno.env.get('PORTAL_SESSION_SECRET');
  if (!secret || secret.length < 16) throw new Error('PORTAL_SESSION_SECRET não configurado');
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function createSession(customerId: string, days: number) {
  const payload = b64url(enc.encode(JSON.stringify({ c: customerId, e: Date.now() + days * 86400000 })));
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await key(), enc.encode(payload)));
  return `${payload}.${b64url(sig)}`;
}

/** Devolve o id do cliente, ou lança 401 se a sessão for inválida ou expirada. */
export async function verifySession(token: unknown): Promise<string> {
  if (typeof token !== 'string' || !token.includes('.')) throw new HttpError(401, 'Sessão inválida. Entre novamente.');
  const [payload, sig] = token.split('.');
  const ok = await crypto.subtle.verify('HMAC', await key(), fromB64url(sig), enc.encode(payload));
  if (!ok) throw new HttpError(401, 'Sessão inválida. Entre novamente.');
  const data = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
  if (!data.c || Date.now() > data.e) throw new HttpError(401, 'Sessão expirada. Entre novamente.');
  return data.c as string;
}
