// Checks the edge document gate's secret resolution and token verification
// against tokens minted by the real portal session and passcode code.
//
//   node scripts/verify-documents-gate.mjs

import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

globalThis.Deno = { env: { get: (k) => process.env[k] } };

const require = createRequire(import.meta.url);
const session = require('../netlify/functions/portal/session.js');
const passcodes = require('../netlify/functions/portal/passcodes.js');
const { resolveSecret, tokenValid } = await import('../netlify/edge-functions/documents.js');

let failed = 0;
async function check(name, fn) {
  try {
    await fn();
    console.log('ok   ' + name);
  } catch (err) {
    failed++;
    console.error('FAIL ' + name + ': ' + err.message);
  }
}

const slug = 'meandco';
const envPasscode = 'env-passcode-for-melody';
const record = passcodes.hashPasscode('amber-maple-1234');
const recordSecret = passcodes.secretFromRecord(record);

await check('record with hash and salt resolves to secretFromRecord', async () => {
  assert.equal(await resolveSecret(record, envPasscode), recordSecret);
});
await check('record wins over the environment value', async () => {
  assert.notEqual(await resolveSecret(record, envPasscode), envPasscode);
});
await check('no record falls back to the environment value', async () => {
  assert.equal(await resolveSecret(null, envPasscode), envPasscode);
});
await check('record missing salt falls back to the environment value', async () => {
  assert.equal(await resolveSecret({ hash: record.hash }, envPasscode), envPasscode);
});
await check('no record and no environment value resolves to null', async () => {
  assert.equal(await resolveSecret(null, undefined), null);
});

for (const [label, secret, wrong] of [
  ['environment passcode', envPasscode, recordSecret],
  ['record-derived secret', recordSecret, envPasscode],
]) {
  const token = session.makeSessionToken(slug, secret);
  await check(label + ': accepted with the right secret', async () => {
    assert.equal(await tokenValid(token, slug, secret), true);
  });
  await check(label + ': rejected with the wrong secret', async () => {
    assert.equal(await tokenValid(token, slug, wrong), false);
  });
  await check(label + ': rejected for another client slug', async () => {
    assert.equal(await tokenValid(token, 'cbc', secret), false);
  });
  await check(label + ': rejected with no secret', async () => {
    assert.equal(await tokenValid(token, slug, null), false);
  });
  await check(label + ': rejected when expired', async () => {
    const realNow = Date.now;
    Date.now = () => realNow() - session.SESSION_TTL_MS - 1000;
    let old;
    try { old = session.makeSessionToken(slug, secret); } finally { Date.now = realNow; }
    assert.equal(await tokenValid(old, slug, secret), false);
  });
}

await check('another client token is rejected for this slug', async () => {
  const other = session.makeSessionToken('cbc', envPasscode);
  assert.equal(await tokenValid(other, slug, envPasscode), false);
});

if (failed) {
  console.error(failed + ' check(s) failed');
  process.exit(1);
}
console.log('documents gate: all checks passed');
