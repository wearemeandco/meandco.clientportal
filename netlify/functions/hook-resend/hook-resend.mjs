// Wakes Everly the moment mail reaches her inbox.
// Resend posts email.received here. This function checks the signature, then
// fires Everly's routine with a one-line pointer to the email. It never sends
// mail, reads a client record, or decides anything: Everly fetches the real
// email herself and verifies the sender before she acts.
//
// Netlify environment variables (names only, values typed into Netlify):
//   RESEND_WEBHOOK          the signing secret Resend shows for this webhook (whsec_...)
//                           (RESEND_WEBHOOK_SECRET is read too)
//   EVERLY_FIRE_ID          Everly's routine id (trig_...) or its full API trigger URL
//   EVERLY_TOKEN            the token generated with that API trigger
//   EVERLY_INBOX            the address that wakes her, default everly@admin.weareme.co
import crypto from 'node:crypto';
import everly from '../lib/everly.js';

const { wakeEverly } = everly;

const TOLERANCE_S = 300;

function verify(secret, id, ts, sigHeader, body) {
  if (!secret || !id || !ts || !sigHeader) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > TOLERANCE_S) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = crypto.createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64');
  const want = Buffer.from(expected);
  return sigHeader.split(' ').some((part) => {
    const got = Buffer.from(part.split(',')[1] || '');
    return got.length === want.length && crypto.timingSafeEqual(got, want);
  });
}

const clip = (s, n) => String(s || '').replace(/[\r\n]+/g, ' ').slice(0, n);

export default async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  const body = await req.text();
  const h = req.headers;
  if (!verify(process.env.RESEND_WEBHOOK || process.env.RESEND_WEBHOOK_SECRET, h.get('svix-id'), h.get('svix-timestamp'), h.get('svix-signature'), body)) {
    return new Response('bad signature', { status: 401 });
  }
  let evt;
  try { evt = JSON.parse(body); } catch { return new Response('bad json', { status: 400 }); }
  if (evt.type !== 'email.received') return new Response('ignored', { status: 200 });

  const d = evt.data || {};
  const inbox = (process.env.EVERLY_INBOX || 'everly@admin.weareme.co').toLowerCase();
  const to = [].concat(d.to || []).map((x) => String(x).toLowerCase());
  if (!to.some((x) => x.includes(inbox))) return new Response('not for Everly', { status: 200 });

  const text = `Resend: email received ${clip(d.email_id, 80)} from ${clip(d.from, 120)} subject ${clip(d.subject, 160)}`;
  const out = await wakeEverly(text);
  if (!out.fired) return new Response('Everly did not wake: ' + out.why, { status: 503 });
  return new Response('Everly woken', { status: 200 });
};

export const config = { path: '/hooks/resend' };
