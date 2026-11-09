// Wakes Everly the moment a text reaches her Inkbox line (iMessage or SMS).
// Inkbox posts the event here with the subscription's auth token. This
// function checks the token, then fires Everly's routine with a one-line
// pointer. It never replies or decides anything: Everly reads the real text
// through her Inkbox connector and checks who sent it before she acts.
//
// Netlify environment variables (names only, values typed into Netlify):
//   INKBOX_WEBHOOK_TOKEN  the auth token set on the Inkbox webhook subscription
//   EVERLY_FIRE_ID, EVERLY_TOKEN  as for the mail wake
import crypto from 'node:crypto';
import everly from '../lib/everly.js';

const { wakeEverly } = everly;

const WAKES = ['imessage.received', 'text.received'];

function authorized(header) {
  const want = String(process.env.INKBOX_WEBHOOK_TOKEN || '');
  const got = String(header || '').replace(/^Bearer\s+/i, '');
  if (want.length < 24 || !got) return false;
  const a = crypto.createHash('sha256').update(got).digest();
  const b = crypto.createHash('sha256').update(want).digest();
  return crypto.timingSafeEqual(a, b);
}

const clip = (s, n) => String(s || '').replace(/[\r\n]+/g, ' ').slice(0, n);

export default async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  if (!authorized(req.headers.get('authorization'))) return new Response('not Inkbox', { status: 401 });
  let evt;
  try { evt = JSON.parse(await req.text()); } catch { return new Response('bad json', { status: 400 }); }
  const type = String(evt.event_type || evt.type || '');
  if (WAKES.indexOf(type) === -1) return new Response('ignored', { status: 200 });

  const d = evt.data || {};
  const msg = d.text_message || d.imessage || d.message || {};
  const from = msg.sender_phone_number || msg.remote_phone_number || msg.from || '';
  const text = `Inkbox: ${type} ${clip(msg.id, 80)}${from ? ' from ' + clip(from, 40) : ''}`;
  const out = await wakeEverly(text);
  if (!out.fired) return new Response('Everly did not wake: ' + out.why, { status: 503 });
  return new Response('Everly woken', { status: 200 });
};

export const config = { path: '/hooks/inkbox' };
