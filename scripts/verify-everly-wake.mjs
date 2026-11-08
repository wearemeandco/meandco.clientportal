// Checks the wake hook: a bad signature is refused, mail for someone else is
// ignored, and mail for Everly fires her routine with a one-line pointer.
import crypto from 'node:crypto';
const secretRaw = crypto.randomBytes(24).toString('base64');
process.env.RESEND_WEBHOOK_SECRET = 'whsec_' + secretRaw;
process.env.EVERLY_FIRE_ID = 'trig_test123';
process.env.EVERLY_TOKEN = 'test-token';
const fired = [];
globalThis.fetch = async (url, init) => { fired.push({ url, init }); return new Response('{}', { status: 200 }); };
const { default: hook } = await import('../netlify/functions/hook-resend/hook-resend.mjs');
const sign = (body, ts = Math.floor(Date.now() / 1000)) => {
  const id = 'msg_test';
  const sig = crypto.createHmac('sha256', Buffer.from(secretRaw, 'base64')).update(`${id}.${ts}.${body}`).digest('base64');
  return { 'svix-id': id, 'svix-timestamp': String(ts), 'svix-signature': 'v1,' + sig };
};
const req = (body, headers) => new Request('https://x/hooks/resend', { method: 'POST', body, headers });
let fail = 0; const check = (name, ok) => { console.log((ok ? '  ok    ' : '  FAIL  ') + name); if (!ok) fail++; };
const forEverly = JSON.stringify({ type: 'email.received', data: { email_id: 'abc', from: 'melody@weareme.co', to: ['everly@admin.weareme.co'], subject: 'Hi' } });
check('bad signature is refused', (await hook(req(forEverly, { 'svix-id': 'x', 'svix-timestamp': String(Math.floor(Date.now() / 1000)), 'svix-signature': 'v1,nope' }))).status === 401);
check('old timestamp is refused', (await hook(req(forEverly, sign(forEverly, 1000)))).status === 401);
const other = JSON.stringify({ type: 'email.received', data: { email_id: 'z', from: 'a@b.c', to: ['hello@weareme.co'], subject: 'x' } });
check('mail for someone else is ignored', (await hook(req(other, sign(other)))).status === 200 && fired.length === 0);
const r = await hook(req(forEverly, sign(forEverly)));
check('mail for Everly fires her routine', r.status === 200 && fired.length === 1);
check('fire id becomes the trigger URL', fired[0].url === 'https://api.anthropic.com/v1/claude_code/routines/trig_test123/fire');
check('payload is a one-line pointer', JSON.parse(fired[0].init.body).text === 'Resend: email received abc from melody@weareme.co subject Hi');
const lib = (await import('../netlify/functions/lib/everly.js')).default;
const before = fired.length;
check('portal wakes stay off until turned on', (await lib.wakeForPortal('sample', 'request-add', 'r_1')).why === 'portal wakes are off' && fired.length === before);
const ok = await lib.wakeEverly(lib.portalPointer('sample', 'request-add', 'r_1'));
check('portal wake fires with a pointer', ok.fired && JSON.parse(fired[before].init.body).text === 'Portal: sample request-add r_1');
globalThis.fetch = async () => { throw new Error('down'); };
const down = await lib.wakeEverly('x');
check('a failed wake never throws', down.fired === false);
delete process.env.EVERLY_TOKEN;
check('missing keys say so', (await lib.wakeEverly('x')).why === 'EVERLY_FIRE_ID or EVERLY_TOKEN is not set');
console.log(fail ? `\n${fail} failed` : '\nall passed'); process.exit(fail ? 1 : 0);
