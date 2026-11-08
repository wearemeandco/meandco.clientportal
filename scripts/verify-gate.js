/* ============================================================
   Me&Co.: passcode gate regression harness
   ------------------------------------------------------------
   The passcode gate is the one thing in this repo that must never
   break. Melody and Antonio both depend on it right now, and a
   change that locks them out would be found by them, not by us.
   So it gets a test that calls the REAL portal.js handler against
   a REAL client file. Nothing is mocked.

   Run:  node scripts/verify-gate.js
   Exit: 0 if every check passes, 1 otherwise, loudly.

   SCOPE NOTE. This file deliberately does not cover the magic link
   flow or the intake page renders. A test that asserts which of two
   overlapping implementations of a feature won is worse than no test:
   it goes green or red for reasons that have nothing to do with
   correctness. Keep the assertions here implementation agnostic.
   What is here depends on
   portal.js, clients.js and a client JSON file, and on nothing that
   either intake implementation owns, so it keeps telling the truth
   whichever one Melody picks. Re-widen it once that is decided.
   ============================================================ */

process.env.MORA_PORTAL_LOCAL_DATA = '1';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const eq = t.indexOf('=');
    if (eq === -1) return;
    const k = t.slice(0, eq).trim();
    if (!process.env[k]) process.env[k] = t.slice(eq + 1).trim();
  });
}

const portal = require('../netlify/functions/portal/portal.js');

let passed = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) {
    passed += 1;
    console.log('  PASS  ' + name);
  } else {
    failures.push(name + (detail ? ' :: ' + detail : ''));
    console.log('  FAIL  ' + name + (detail ? ' :: ' + detail : ''));
  }
}

function ev(over) {
  return Object.assign({ httpMethod: 'GET', path: '/', queryStringParameters: {}, headers: {}, body: '' }, over || {});
}

function setCookieOf(res) {
  const h = res.headers || {};
  return h['Set-Cookie'] || h['set-cookie'] || '';
}

function cookieValue(setCookie) {
  const first = String(setCookie).split(';')[0];
  const eq = first.indexOf('=');
  return eq === -1 ? '' : first.slice(0, eq) + '=' + first.slice(eq + 1);
}

async function main() {
  console.log('\n[1] The live passcode gate, real client file, real handler');

  const SLUG = 'meandco';
  const realPasscode = process.env.PORTAL_PASSWORD_MELODY;
  if (!realPasscode) {
    console.error('  BLOCKED  PORTAL_PASSWORD_MELODY is not set locally, so the real gate cannot be tested.');
    process.exit(1);
  }

  const locked = await portal.handler(ev({ queryStringParameters: { slug: SLUG } }));
  check('GET with no cookie returns the lock screen',
    locked.statusCode === 200 && /id="gate-form"/.test(locked.body) && /name="passcode"/.test(locked.body),
    'status ' + locked.statusCode);

  const wrong = await portal.handler(ev({
    httpMethod: 'POST',
    queryStringParameters: { slug: SLUG },
    body: JSON.stringify({ passcode: 'definitely-not-it' }),
  }));
  check('POST with a wrong passcode is refused with 401', wrong.statusCode === 401, 'status ' + wrong.statusCode);
  check('Wrong passcode keeps the original refusal copy', /That passcode did not work/.test(wrong.body), wrong.body);
  check('A refused attempt clears any existing cookie', /Max-Age=0/.test(setCookieOf(wrong)), setCookieOf(wrong));

  const right = await portal.handler(ev({
    httpMethod: 'POST',
    queryStringParameters: { slug: SLUG },
    body: JSON.stringify({ passcode: realPasscode }),
  }));
  const gateCookie = setCookieOf(right);
  check('POST with the real passcode succeeds',
    right.statusCode === 200 && JSON.parse(right.body).ok === true, 'status ' + right.statusCode);
  check('Success sets the mora_portal_meandco cookie', /^mora_portal_meandco=/.test(gateCookie), gateCookie);
  check('Cookie is HttpOnly and SameSite=Lax',
    /HttpOnly/.test(gateCookie) && /SameSite=Lax/.test(gateCookie), gateCookie);

  const dash = await portal.handler(ev({
    queryStringParameters: { slug: SLUG },
    headers: { cookie: cookieValue(gateCookie) },
  }));
  check('The session cookie opens the real dashboard',
    dash.statusCode === 200 && !/id="gate-form"/.test(dash.body), 'status ' + dash.statusCode);

  const tampered = cookieValue(gateCookie).slice(0, -3) + 'aaa';
  const rejected = await portal.handler(ev({ queryStringParameters: { slug: SLUG }, headers: { cookie: tampered } }));
  check('A tampered cookie falls back to the lock screen', /id="gate-form"/.test(rejected.body));

  const otherClient = await portal.handler(ev({
    queryStringParameters: { slug: 'caraballo' },
    headers: { cookie: cookieValue(gateCookie) },
  }));
  check('One client\'s cookie does not open another client\'s portal',
    otherClient.statusCode !== 200 || /id="gate-form"/.test(otherClient.body) || /not available yet/.test(otherClient.body),
    'status ' + otherClient.statusCode);

  const unknown = await portal.handler(ev({ queryStringParameters: { slug: 'no-such-client' } }));
  check('An unknown slug is a 404, not a leak', unknown.statusCode === 404, 'status ' + unknown.statusCode);

  console.log('\n[2] The lock screen itself is untouched');

  const lockSource = fs.readFileSync(path.join(ROOT, 'netlify/functions/portal/lock-screen.js'), 'utf8');
  check('lock-screen.js still posts to the same endpoint it always has', /functions\/portal\?slug=/.test(lockSource));
  check('lock-screen.js still uses the same field name', /name="passcode"/.test(lockSource));
  check('lock-screen.js still redirects to /portal/ on success', /\/portal\/'\s*\+\s*slug/.test(lockSource));

  console.log('\n' + passed + ' passed, ' + failures.length + ' failed');
  if (failures.length) {
    failures.forEach((f) => console.log('  ! ' + f));
    process.exit(1);
  }
  console.log('The live passcode gate is intact.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
