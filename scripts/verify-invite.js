#!/usr/bin/env node
/* ============================================================
   Me&Co.: portal invite checks
   ------------------------------------------------------------
   Run:  node scripts/verify-invite.js
   Exit: 0 when every check passes, 1 otherwise.

   Everything runs against local files and a stubbed fetch: nothing is
   sent and no network call is made. data/clients-index.json is backed up
   first and restored byte for byte afterwards.
   ============================================================ */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

process.env.MORA_PORTAL_LOCAL_DATA = '1';
process.env.PORTAL_LOCAL_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mora-invite-'));
process.env.ADMIN_PORTAL_PASSWORD = 'verify-admin-secret';
process.env.RESEND_API_KEY = 'verify-not-a-real-key';
process.env.PORTAL_PUBLIC_ORIGIN = 'https://portal.example.test';

const ROOT = path.join(__dirname, '..');
const INDEX = path.join(ROOT, 'data', 'clients-index.json');
const FN = path.join(ROOT, 'netlify', 'functions');

const invite = require(path.join(FN, 'portal', 'invite.js'));
const passcodes = require(path.join(FN, 'portal', 'passcodes.js'));
const session = require(path.join(FN, 'portal', 'session.js'));
const clients = require(path.join(FN, 'portal', 'clients.js'));
const admin = require(path.join(FN, 'admin', 'admin.js'));

let failed = 0;
function check(label, ok, detail) {
  if (ok) console.log('  ok    ' + label);
  else { failed++; console.log('  FAIL  ' + label + (detail ? '  -> ' + detail : '')); }
}

/* A fetch stub that records each request and answers with a chosen status. */
function stub(statusFor) {
  const calls = [];
  invite._setFetch(async (url, opts) => {
    calls.push({ url, headers: opts.headers, body: JSON.parse(opts.body) });
    const status = statusFor ? statusFor(calls.length) : 200;
    return { ok: status >= 200 && status < 300, status, json: async () => ({ message: 'stub' }) };
  });
  return calls;
}

function adminCookie() {
  const payload = Buffer.from(JSON.stringify({ e: Date.now() + 60 * 60 * 1000 })).toString('base64url');
  const mac = crypto.createHmac('sha256', process.env.ADMIN_PORTAL_PASSWORD).update(payload).digest('hex');
  return 'mora_admin=' + encodeURIComponent(payload + '.' + mac);
}
function adminPost(body) {
  return admin.handler({
    httpMethod: 'POST',
    path: '/admin',
    headers: { 'content-type': 'application/json', cookie: adminCookie() },
    body: JSON.stringify(body),
  });
}

async function main() {
  const original = fs.readFileSync(INDEX);
  try {
    const slug = 'verify-invite-client';
    await clients.addClientToIndex(slug, 'Verify Client', {
      email: 'one@example.test',
      emails: ['one@example.test', 'Two@Example.test', 'one@example.test'],
      blurb: 'Custom blurb',
    });
    const client = await clients.getClient(slug);

    console.log('\n[1] sendInvite');
    let calls = stub();
    const noPasscode = await passcodes.resolveAuth(client);
    const result = await invite.sendInvite(client);
    check('the client starts with no passcode', noPasscode === null);
    check('one email per distinct address', calls.length === 2 && result.sent === 2 && result.total === 2, JSON.stringify(result));
    check('the Resend body carries the reset link', calls.every((c) => c.body.html.indexOf('/reset/') !== -1 && c.body.text.indexOf('/reset/') !== -1));
    check('each request carries its Idempotency-Key',
      calls[0].headers['Idempotency-Key'] === 'portal-invite/' + slug + '/one@example.test' &&
      calls[1].headers['Idempotency-Key'] === 'portal-invite/' + slug + '/two@example.test');
    const flat = JSON.stringify(result);
    check('the return value has no link and no address', flat.indexOf('/reset/') === -1 && flat.indexOf('@') === -1 && flat.indexOf('example.test') === -1, flat);
    const empty = await invite.sendInvite({ slug: 'nobody', name: 'Nobody' });
    check('no addresses returns zero counts', empty.total === 0 && empty.sent === 0 && empty.alreadySent === 0 && empty.failed === 0);

    console.log('\n[2] The link');
    const link = calls[0].body.text.match(/https:\/\/\S+\/reset\/(\S+)/);
    const token = link ? decodeURIComponent(link[1]) : '';
    const auth = await passcodes.resolveAuth(client);
    check('a passcode record now exists', !!auth && auth.source === 'blobs');
    check('the token passes verifyResetToken', session.verifyResetToken(token, slug, auth.secret));
    const exp = JSON.parse(Buffer.from(token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')).e;
    const hours = (exp - Date.now()) / 3600000;
    check('the token lasts 72 hours, not 1', hours > 71.9 && hours <= 72.001, hours.toFixed(2) + 'h');
    await passcodes.setPasscode(slug, 'a-brand-new-passcode');
    const after = await passcodes.resolveAuth(client);
    check('saving a passcode ends the link', !session.verifyResetToken(token, slug, after.secret));

    console.log('\n[3] Already sent');
    calls = stub(() => 409);
    const dup = await invite.sendInvite(client);
    check('a 409 counts as alreadySent and is not retried', dup.alreadySent === 2 && dup.sent === 0 && dup.failed === 0 && calls.length === 2, JSON.stringify(dup));
    stub(() => 500);
    const bad = await invite.sendInvite(client);
    check('a 500 counts as failed', bad.failed === 2 && bad.sent === 0, JSON.stringify(bad));

    console.log('\n[4] Admin handler');
    calls = stub();
    await passcodes.setPasscode(slug, 'another-passcode-here');
    const res = await adminPost({ action: 'send-invite', slug });
    const parsed = JSON.parse(res.body);
    check('send-invite answers 200 with counts', res.statusCode === 200 && parsed.ok === true && parsed.sent === 2 && parsed.total === 2, res.body);
    check('the response has no "/reset/" and no "k="', res.body.indexOf('/reset/') === -1 && res.body.indexOf('k=') === -1, res.body);
    check('the response has a message', typeof parsed.message === 'string' && /Invite sent to 2 addresses/.test(parsed.message), parsed.message);
    const unknown = await adminPost({ action: 'send-invite', slug: 'no-such-client' });
    check('send-invite on an unknown client is 404', unknown.statusCode === 404);

    console.log('\n[5] set-emails');
    const set = await adminPost({ action: 'set-emails', slug, emails: [' New@Example.test ', 'new@example.test', 'second@example.test'] });
    const setBody = JSON.parse(set.body);
    check('set-emails answers 200 with the cleaned list', set.statusCode === 200 && JSON.stringify(setBody.emails) === JSON.stringify(['new@example.test', 'second@example.test']), set.body);
    const saved = await clients.getClient(slug);
    check('envKey, name and blurb are kept', saved.envKey === client.envKey && saved.name === 'Verify Client' && saved.blurb === 'Custom blurb');
    check('emails and email are replaced', JSON.stringify(saved.emails) === JSON.stringify(['new@example.test', 'second@example.test']) && saved.email === 'new@example.test');
    const badSet = await adminPost({ action: 'set-emails', slug, emails: ['fine@example.test', 'not-an-email'] });
    check('"not-an-email" is rejected with 400 naming it', badSet.statusCode === 400 && /not-an-email/.test(badSet.body), badSet.body);
    const afterBad = await clients.getClient(slug);
    check('a rejected save changes nothing', JSON.stringify(afterBad.emails) === JSON.stringify(['new@example.test', 'second@example.test']));
    const missing = await adminPost({ action: 'set-emails', slug: 'no-such-client', emails: ['a@example.test'] });
    check('set-emails on an unknown client is 404', missing.statusCode === 404);

    console.log('\n[6] The email');
    const mail = invite.buildInviteEmail({ name: 'Verify Client' }, 'https://portal.example.test/reset/x');
    check('no 999px', mail.html.indexOf('999px') === -1);
    check('no em dash', (mail.html + mail.text + mail.subject).indexOf(String.fromCharCode(8212)) === -1);
    check('no border-left', mail.html.indexOf('border-left') === -1);
    check('subject and button text', mail.subject === 'Your Me&Co. portal is ready' && mail.html.indexOf('Choose your passcode') !== -1);
  } finally {
    fs.writeFileSync(INDEX, original);
    fs.rmSync(process.env.PORTAL_LOCAL_STATE_DIR, { recursive: true, force: true });
    console.log('\n[7] Cleanup');
    check('data/clients-index.json is restored byte for byte', fs.readFileSync(INDEX).equals(original));
  }
  console.log('\n' + (failed ? failed + ' check(s) failed.' : 'All invite checks passed.'));
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.log('  FAIL  unexpected error: ' + err.message);
  process.exit(1);
});
