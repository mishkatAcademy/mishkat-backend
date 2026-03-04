// src/utils/secureLinks.ts
import crypto from 'crypto';
import { env } from '../config/env';

function base64Url(buf: Buffer) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function normalizeRelPath(relPath: string) {
  return String(relPath || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');
}

/**
 * يحوّل pdfRelPath إلى path تحت /protected/books/
 * pdfRelPath المتوقع: files/books/YYYY/MM/filename.pdf
 */
function toProtectedBooksUri(pdfRelPath: string) {
  const p = normalizeRelPath(pdfRelPath);

  // لازم يبقى تحت files/books/
  const prefix = 'files/books/';
  const tail = p.startsWith(prefix) ? p.slice(prefix.length) : p;

  // tail = "YYYY/MM/file.pdf"
  return `/protected/books/${tail}`;
}

/** يولّد signed-url يتوافق 100% مع nginx secure_link */
export function makeSignedBookUrl(pdfRelPath: string, ttlSeconds?: number) {
  const uri = toProtectedBooksUri(pdfRelPath);

  const ttl = ttlSeconds ?? env.NGINX_SECURE_LINK_TTL_SECONDS ?? 600;
  const expires = Math.floor(Date.now() / 1000) + ttl;

  const secret = env.NGINX_SECURE_LINK_SECRET;
  if (!secret || secret.length < 10) {
    throw new Error('NGINX_SECURE_LINK_SECRET is missing/invalid');
  }

  const md5Raw = crypto.createHash('md5').update(`${expires}${uri}.${secret}`).digest();
  const md5 = base64Url(md5Raw);

  const base = env.APP_BASE_URL.replace(/\/+$/, '');
  return {
    uri,
    md5,
    expires,
    expiresAt: new Date(expires * 1000).toISOString(),
    readUrl: `${base}${uri}?md5=${md5}&expires=${expires}`,
  };
}
