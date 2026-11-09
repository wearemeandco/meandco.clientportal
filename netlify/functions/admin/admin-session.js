/* Is this request from Melody's signed-in admin? Reads the same cookie and
   the same signature her admin sign-in sets, so a client portal can show
   itself to her in admin view. Never sets anything. */
const adminAuth = require('../lib/admin-auth');

function readCookie(headers, name) {
  const raw = (headers && (headers.cookie || headers.Cookie)) || '';
  const m = raw.split(/;\s*/).find((c) => c.indexOf(name + '=') === 0);
  return m ? decodeURIComponent(m.slice(name.length + 1)) : '';
}

function isAdminRequest(event) {
  const secret = adminAuth.signingSecret();
  if (!secret) return false;
  return !!adminAuth.verifyToken(readCookie(event.headers, adminAuth.COOKIE_NAME), secret);
}

module.exports = { isAdminRequest };
