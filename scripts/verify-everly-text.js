// Checks the text door's hold: a text right after a wake joins that run, and a
// text after the run has had time to finish wakes Everly again.
const crypto = require('crypto');
const path = require('path');
const fn = (p) => path.join(__dirname, '..', 'netlify', 'functions', p);
process.env.INKBOX_API_KEY = 'test-inkbox-key';
process.env.MELODY_PHONE = '+15550001111';
const mem = {};
require.cache[require.resolve(fn('portal/store.js'))] = { exports: {
  connectBlobs() {},
  openStore: () => ({ get: async (k) => (k in mem ? mem[k] : null), setJSON: async (k, v) => { mem[k] = v; } }),
} };
const wakes = [];
require.cache[require.resolve(fn('lib/everly.js'))] = { exports: { wakeEverly: async (t) => { wakes.push(t); return { fired: true }; } } };
const { handler } = require(fn('hook-inkbox/hook-inkbox.js'));
const token = require(fn('lib/inkbox.js')).deliveryToken();
let now = Date.parse('2026-11-16T12:00:00Z');
const realNow = Date.now; Date.now = () => now;
const text = (id, content) => handler({ httpMethod: 'POST', headers: { authorization: 'Bearer ' + token }, body: JSON.stringify({ event_type: 'imessage.received', id, data: { message: { id, remote_number: '+15550001111', content, conversation_id: 'c1' } } }) });
let fail = 0; const check = (n, ok) => { console.log((ok ? '  ok    ' : '  FAIL  ') + n); if (!ok) fail++; };
(async () => {
  const realIso = Date.prototype.toISOString;
  Date.prototype.toISOString = function () { return realIso.call(new Date(now)); };
  await text('m1', 'Hey Everly'); check('a text wakes Everly', wakes.length === 1);
  now += 20 * 1000; const r = JSON.parse((await text('m2', 'and one more thing')).body);
  check('a text 20 seconds later joins the run', r.held === true && wakes.length === 1);
  now += 25 * 1000; await text('m3', 'Ok so we can work as usual?');
  check('a text 45 seconds after the wake wakes her again', wakes.length === 2);
  now += 60 * 1000; await text('m3', 'Ok so we can work as usual?');
  check('a repeated delivery wakes no one', wakes.length === 2);
  await text('m4', 'gracias'); check('a plain gracias wakes no one', wakes.length === 2);
  Date.now = realNow; Date.prototype.toISOString = realIso;
  console.log(fail ? `\n${fail} failed` : '\nall passed'); process.exit(fail ? 1 : 0);
})();
