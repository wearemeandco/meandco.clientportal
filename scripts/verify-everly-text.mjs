// Checks the text wake: no token or a wrong one is refused, other events are
// ignored, and a received text fires Everly's routine with a one-line pointer.
process.env.INKBOX_WEBHOOK_TOKEN = 'test-inkbox-token-0123456789abcdef';
process.env.EVERLY_FIRE_ID = 'trig_test123';
process.env.EVERLY_TOKEN = 'test-token';
const fired = [];
globalThis.fetch = async (url, init) => { fired.push({ url, init }); return new Response('{}', { status: 200 }); };
const { default: hook } = await import('../netlify/functions/hook-inkbox/hook-inkbox.mjs');
const req = (body, token) => new Request('https://x/hooks/inkbox', { method: 'POST', body, headers: token ? { authorization: 'Bearer ' + token } : {} });
let fail = 0; const check = (name, ok) => { console.log((ok ? '  ok    ' : '  FAIL  ') + name); if (!ok) fail++; };
const good = 'test-inkbox-token-0123456789abcdef';
const im = JSON.stringify({ event_type: 'imessage.received', data: { imessage: { id: 'im_1', sender_phone_number: '+15550001111', text: 'hi' } } });
check('no token is refused', (await hook(req(im))).status === 401 && fired.length === 0);
check('wrong token is refused', (await hook(req(im, 'nope'))).status === 401 && fired.length === 0);
const sent = JSON.stringify({ event_type: 'text.delivered', data: { text_message: { id: 't_0' } } });
check('other events are ignored', (await hook(req(sent, good))).status === 200 && fired.length === 0);
const r = await hook(req(im, good));
check('an iMessage wakes Everly', r.status === 200 && fired.length === 1);
check('pointer names the text, not its words', JSON.parse(fired[0].init.body).text === 'Inkbox: imessage.received im_1 from +15550001111');
const sms = JSON.stringify({ event_type: 'text.received', data: { text_message: { id: 't_1', sender_phone_number: '+15550002222', text: 'yo' } } });
await hook(req(sms, good));
check('an SMS wakes Everly', JSON.parse(fired[1].init.body).text === 'Inkbox: text.received t_1 from +15550002222');
console.log(fail ? `\n${fail} failed` : '\nall passed'); process.exit(fail ? 1 : 0);
