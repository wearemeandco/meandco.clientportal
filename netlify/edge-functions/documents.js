// Puts every client document behind that client's own portal session.
//
// Everything client-shaped lives in the assigned portal. Anything related to
// clients belongs in portal.weareme.co, and behind that client's session.
//
// /portal/<slug> is gated by an HMAC session cookie.
// /contracts/*, /invoices/* and /receipts/* are static files in public/,
// which Netlify serves directly, so they never reached the function that does
// the checking. Every client contract, invoice and receipt was readable by
// anyone who typed the URL. No password, no robots.txt, no noindex.
//
// This runs at the edge, before any static file is served, so those three
// folders now need exactly what the dashboard needs.
//
// It is not enough to require *a* session. A logged-in client must not be able
// to read another client's contract, so the document's owner is worked out
// first and the session is checked against that owner specifically.
//
// The token format is not reinvented here. It is the same one
// netlify/functions/portal/session.js issues:
//
//   cookie   mora_portal_<slug>
//   value    base64url({"s":slug,"e":expiryMs}) + "." + hmacSha256Hex(payload)
//   key      "<secret>::<slug>::session"
//
// The secret is resolved the way netlify/functions/portal/passcodes.js
// resolveAuth() resolves it. A Netlify Blobs record (store "portal-passcodes",
// key = slug) with a hash and salt wins: the secret is
// hex(HMAC-SHA256(key = bytes of record.hash, message "mora-portal-token-secret")).
// With no such record, or when the Blobs read fails, the secret is the
// client's PORTAL_PASSWORD_<SLUG> variable. With neither, no session is valid.
//
// If those files change, this has to change with it. Same shape, same secret,
// same expiry rule.

import { getStore } from '@netlify/blobs';

const PASSCODE_STORE = 'portal-passcodes';

// Who owns what. Explicit, because a filename is not proof of ownership and
// getting this wrong would serve one client another client's contract. A file
// whose owner is not listed here is refused rather than guessed at.
const OWNERS = [
  { prefix: 'sample-', slug: 'sample', env: 'PORTAL_PASSWORD_SAMPLE' },
];

function ownerOf(pathname) {
  const file = pathname.split('/').pop() || '';
  return OWNERS.find((o) => file.startsWith(o.prefix)) || null;
}

// Links already in a client's inbox, given a short stay of execution.
//
// A document link already sitting in a client's inbox keeps working for a few
// days and then expires, and the document itself goes onto their portal.
//
// So the old link keeps working for a few days rather than turning into a 401
// in the inbox of someone who has just paid, and the same document is added to
// her portal, which is where it lives from now on. Each entry carries its own
// expiry and simply stops working on that date. Nothing has to be remembered
// or cleaned up later.
//
// This list should stay empty. An entry here is a document readable without a
// login, which is the exact thing this file exists to prevent, so anything
// added needs a date and a reason.
const GRACE = [
  { path: '/receipts/melody-project2-receipt-2.html', until: '2026-08-29T00:00:00Z',
    why: 'emailed to Melody 2026-08-24, before documents were gated' },
];

function inGrace(pathname) {
  const hit = GRACE.find((g) => g.path === pathname);
  if (!hit) return false;
  return Date.now() < Date.parse(hit.until);
}

function readCookie(header, name) {
  for (const part of String(header || '').split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

function fromB64url(s) {
  const pad = String(s).replace(/-/g, '+').replace(/_/g, '/');
  return atob(pad + '='.repeat((4 - (pad.length % 4)) % 4));
}

async function hmacHex(message, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Same number of steps whichever character differs, so the comparison does not
// leak how much of a forged token was correct.
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

// Token secret for a Blobs-backed client: the same value passcodes.js
// secretFromRecord() produces.
async function secretFromRecord(rec) {
  const key = await crypto.subtle.importKey(
    'raw', hexToBytes(rec.hash), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('mora-portal-token-secret'));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// The Blobs record wins when it carries a hash and salt, otherwise the
// environment value is the secret. Returns null when neither exists.
async function resolveSecret(rec, envValue) {
  if (rec && rec.hash && rec.salt) return secretFromRecord(rec);
  return envValue || null;
}

async function readRecord(slug) {
  try {
    return await getStore(PASSCODE_STORE).get(slug, { type: 'json' });
  } catch (err) {
    console.error('[documents] passcode record read failed for "' + slug + '", using the environment passcode: ' + err.message);
    return null;
  }
}

// Verifies a session cookie value against the secret for one client.
async function tokenValid(token, slug, secret) {
  if (!token || !secret) return false;

  const dot = token.lastIndexOf('.');
  if (dot < 1) return false;
  const payload = token.slice(0, dot);
  const mac = token.slice(dot + 1);

  const expected = await hmacHex(payload, secret + '::' + slug + '::session');
  if (!safeEqual(mac, expected)) return false;

  try {
    const data = JSON.parse(fromB64url(payload));
    return !!(data && data.s === slug && typeof data.e === 'number' && data.e > Date.now());
  } catch (e) {
    return false;
  }
}

async function hasSession(request, owner) {
  const token = readCookie(request.headers.get('cookie'), 'mora_portal_' + owner.slug);
  if (!token) return false;

  const secret = await resolveSecret(await readRecord(owner.slug), Deno.env.get(owner.env));
  // No secret means no valid session can exist for this client, so the honest
  // answer is no. Failing open here would hand out documents for exactly the
  // clients whose portal was never finished being set up.
  if (!secret) return false;

  return tokenValid(token, owner.slug, secret);
}

// Exposed so scripts/verify-documents-gate.mjs can exercise the secret and
// token checks without a request or a Blobs store.
export { resolveSecret, tokenValid };

function refuse(slug) {
  const where = slug ? '/portal/' + slug : '/start';
  return new Response(
    [
      '<!doctype html><meta charset="utf-8">',
      '<title>Please sign in</title>',
      '<style>body{font-family:system-ui,sans-serif;max-width:34rem;margin:18vh auto;padding:0 1.5rem;color:#22315E;line-height:1.6}',
      'a{color:#2A4FBF}</style>',
      '<h1>Please sign in first</h1>',
      '<p>This document belongs to a client portal. Open your portal and it is waiting for you there.</p>',
      '<p><a href="' + where + '">Go to your portal</a></p>',
    ].join(''),
    {
      status: 401,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    }
  );
}

export default async (request, context) => {
  const { pathname } = new URL(request.url);
  const owner = ownerOf(pathname);

  // Fail closed. An unrecognised document is refused, not served, because the
  // failure being fixed here is precisely a document nobody had thought about
  // being readable by everybody.
  if (!owner) return refuse(null);

  // A dated exception for a link already sitting in someone's inbox. Checked
  // before the session so an expired grace entry falls through to the normal
  // gate rather than to an error.
  if (!inGrace(pathname) && !(await hasSession(request, owner))) return refuse(owner.slug);

  const res = await context.next();
  // Even for the right client, these should never be cached by a shared proxy
  // or indexed if a link ever escapes.
  res.headers.set('Cache-Control', 'private, no-store');
  res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return res;
};

// Every folder under public/ that holds anything client-shaped.
//
// No client-shaped public path stays open, activities included. Gating the
// three folders someone happens to remember and leaving a fourth open is the
// same mistake twice, so settle this by listing public/, never from memory.
//
// proposals/ is in here because proposals/melody-project2.html names a client
// and states her price. Anything without a recognised owner prefix is refused
// outright, which is the correct outcome for a document nobody has claimed.
//
// public/forms/ is deliberately NOT gated, and that is not an oversight.
// Those are Netlify Forms shadow files: the build scanner has to see them for
// a form to exist at all, submissions POST to /forms/thanks.html, and
// brief-form.js fetches /forms/discovery-brief.html from the browser. Gating
// them would break every form on the portal, silently. Checked before
// deciding, and they hold no client data: the only names in them are form ids
// like project2-onboarding-questions-meandco and one code comment. No
// answers, no amounts, no addresses.
export const config = {
  path: ['/contracts/*', '/invoices/*', '/receipts/*', '/proposals/*'],
};
