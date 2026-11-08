/* Melody's admin sign in, shared by /admin and /login.

   Netlify environment variables (names only, values typed in by Melody):
     ADMIN_PORTAL_PASSWORD  her admin passcode
     MELODY_ADMIN           the same, under the name she gave it (either works)

   Melody signs in at /login with ADMIN_EMAIL and that passcode, or at /admin
   with the passcode alone. Both set the same admin session cookie. */

const crypto = require('crypto');

const ADMIN_EMAIL = 'melody@weareme.co';
const ENV_NAMES = ['ADMIN_PORTAL_PASSWORD', 'MELODY_ADMIN', 'melody_admin'];
const COOKIE_NAME = 'mora_admin';
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

function passwords() {
  return ENV_NAMES.map((n) => process.env[n]).filter((v) => typeof v === 'string' && v.length > 0);
}

// Signs the admin session. The first passcode set, so a session lasts across
// sign ins whichever name the passcode lives under.
function signingSecret() {
  return passwords()[0] || '';
}

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a), 'utf8').digest();
  const hb = crypto.createHash('sha256').update(String(b), 'utf8').digest();
  return crypto.timingSafeEqual(ha, hb);
}

function checkPassword(attempt) {
  if (!attempt) return false;
  let ok = false;
  for (const p of passwords()) if (safeEqual(attempt, p)) ok = true;
  return ok;
}

function isAdminEmail(email) {
  return String(email || '').trim().toLowerCase() === ADMIN_EMAIL;
}

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function makeToken(secret) {
  const payload = Buffer.from(JSON.stringify({ e: Date.now() + TOKEN_TTL_MS })).toString('base64url');
  return payload + '.' + sign(payload, secret);
}

function verifyToken(token, secret) {
  if (!token || !secret) return false;
  const dot = token.lastIndexOf('.');
  if (dot < 1) return false;
  const payload = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = sign(payload, secret);
  if (mac.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return !!data && typeof data.e === 'number' && data.e > Date.now();
  } catch (e) {
    return false;
  }
}

function buildCookie(value, secure) {
  const bits = [COOKIE_NAME + '=' + encodeURIComponent(value), 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (secure) bits.push('Secure');
  return bits.join('; ');
}

module.exports = { ADMIN_EMAIL, COOKIE_NAME, signingSecret, checkPassword, isAdminEmail, safeEqual, makeToken, verifyToken, buildCookie };
