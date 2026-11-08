/* ============================================================
   Me&Co. — portal session tokens, one implementation
   ------------------------------------------------------------
   One implementation, because three entry points need the
   identical logic and a second copy is
   how auth quietly drifts: the portal itself, the /start sign in
   panel (passcode fallback for an existing client who does not
   have their private link handy), and magic link consumption.

   Two token kinds, deliberately not interchangeable. The HMAC key
   carries the purpose string, so a session cookie can never be
   replayed as a magic link and a magic link can never be pasted in
   as a session cookie: a token minted for one purpose fails
   verification for the other, by construction rather than by an if
   statement someone can forget.

   Session:    12 hours, set as an HttpOnly cookie after a real
               passcode check.
   Magic link: 7 days, travels in a URL, so it is time limited and
               single purpose. Not single use, see the note on
               consumeMagicToken.
   ============================================================ */

const crypto = require('crypto');

const COOKIE_PREFIX = 'mora_portal_';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const MAGIC_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const PURPOSE_SESSION = 'session';
const PURPOSE_MAGIC = 'magic';

function cookieName(slug) {
  return COOKIE_PREFIX + String(slug).replace(/[^a-zA-Z0-9_-]/g, '_');
}

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a), 'utf8').digest();
  const hb = crypto.createHash('sha256').update(String(b), 'utf8').digest();
  return crypto.timingSafeEqual(ha, hb);
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(str) {
  return Buffer.from(String(str).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function sign(payload, secret, slug, purpose) {
  return crypto.createHmac('sha256', secret + '::' + slug + '::' + purpose).update(payload).digest('hex');
}

function makeToken(slug, secret, purpose, ttlMs) {
  const payload = b64url(JSON.stringify({ s: slug, e: Date.now() + ttlMs }));
  return payload + '.' + sign(payload, secret, slug, purpose);
}

function verify(token, slug, secret, purpose) {
  if (!token || typeof token !== 'string') return false;
  const dot = token.lastIndexOf('.');
  if (dot < 1) return false;
  const payload = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = sign(payload, secret, slug, purpose);
  if (mac.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return false;
  try {
    const data = JSON.parse(fromB64url(payload));
    return !!(data && data.s === slug && typeof data.e === 'number' && data.e > Date.now());
  } catch (err) {
    return false;
  }
}

function makeSessionToken(slug, secret) {
  return makeToken(slug, secret, PURPOSE_SESSION, SESSION_TTL_MS);
}
function verifySessionToken(token, slug, secret) {
  return verify(token, slug, secret, PURPOSE_SESSION);
}

/* A magic link is a real credential in a URL, so it expires on its own
   in 7 days. It is deliberately NOT single use: making it single use
   needs a server side record of spent tokens, and the common real
   failure is a mail client prefetching the link and burning it before
   the human ever clicks. Time limiting is the honest trade here, and
   the link only ever grants what the passcode already grants. */
function makeMagicToken(slug, secret) {
  return makeToken(slug, secret, PURPOSE_MAGIC, MAGIC_TTL_MS);
}
function verifyMagicToken(token, slug, secret) {
  return verify(token, slug, secret, PURPOSE_MAGIC);
}

/* A shorter lived sign in link (the Forgot passcode email). Same purpose
   key as a magic link, so the portal's existing link handling accepts it;
   the expiry inside the token is what makes it last one hour. */
function makeSignInToken(slug, secret, ttlMs) {
  return makeToken(slug, secret, PURPOSE_MAGIC, ttlMs);
}

/* A reset link only opens the Set a new passcode page; it never signs
   anyone in. It is signed with the current passcode's secret, so it stops
   working the moment a new passcode is saved, which makes it single use. */
const PURPOSE_RESET = 'reset';
const RESET_TTL_MS = 60 * 60 * 1000;
function makeResetToken(slug, secret) {
  return makeToken(slug, secret, PURPOSE_RESET, RESET_TTL_MS);
}
function verifyResetToken(token, slug, secret) {
  return verify(token, slug, secret, PURPOSE_RESET);
}

/* An invite link is a reset token that lasts 72 hours. It uses the reset
   purpose, so the Set a new passcode page accepts it unchanged, and saving
   a passcode changes the secret, which ends the link after one use. */
const INVITE_TTL_MS = 72 * 60 * 60 * 1000;
function makeInviteToken(slug, secret) {
  return makeToken(slug, secret, PURPOSE_RESET, INVITE_TTL_MS);
}

function readCookie(headers, name) {
  const raw = (headers && (headers.cookie || headers.Cookie)) || '';
  const parts = raw.split(';');
  for (let i = 0; i < parts.length; i++) {
    const eq = parts[i].indexOf('=');
    if (eq === -1) continue;
    if (parts[i].slice(0, eq).trim() === name) return decodeURIComponent(parts[i].slice(eq + 1).trim());
  }
  return null;
}

function buildCookie(name, value, secure) {
  const bits = [name + '=' + encodeURIComponent(value), 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (secure) bits.push('Secure');
  return bits.join('; ');
}
function clearCookie(name, secure) {
  const bits = [name + '=', 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (secure) bits.push('Secure');
  return bits.join('; ');
}

function isSecureRequest(event) {
  const proto = String((event.headers && (event.headers['x-forwarded-proto'] || event.headers['X-Forwarded-Proto'])) || 'https');
  return proto.indexOf('https') !== -1;
}

module.exports = {
  COOKIE_PREFIX,
  SESSION_TTL_MS,
  MAGIC_TTL_MS,
  cookieName,
  safeEqual,
  makeSessionToken,
  verifySessionToken,
  makeMagicToken,
  makeSignInToken,
  verifyMagicToken,
  makeResetToken,
  makeInviteToken,
  INVITE_TTL_MS,
  verifyResetToken,
  readCookie,
  buildCookie,
  clearCookie,
  isSecureRequest,
};
