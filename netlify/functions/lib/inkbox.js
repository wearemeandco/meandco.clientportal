/* Everly's text line: her own Inkbox identity on iMessage. Inkbox posts each
   text to /hooks/inkbox with a delivery token set when the subscription is
   made; a text from Melody's phone wakes Everly, who reads and answers it
   through her Inkbox connector.

   Netlify environment variables (names only):
     INKBOX_API_KEY             Melody's Inkbox API key (makes the subscription)
     EVERLY_INKBOX_IDENTITY_ID  the id of Everly's Inkbox identity
     MELODY_PHONE               Melody's mobile number, like +15125550123 */
const crypto = require('crypto');

const API = 'https://inkbox.ai/api/v1';
const EVENTS = ['imessage.received'];

const env = (k) => String(process.env[k] || '').trim();

/* The token Inkbox echoes on every delivery, derived from the API key so
   nothing extra is stored. */
function deliveryToken() {
  const key = env('INKBOX_API_KEY');
  return key ? crypto.createHmac('sha256', key).update('everly-inkbox-delivery').digest('hex').slice(0, 48) : '';
}

function sameSecret(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest(), y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

function verify(headers) {
  const token = deliveryToken();
  if (!token) return false;
  const h = headers || {};
  const offered = [h.authorization, h.Authorization, h['x-inkbox-auth-token'], h['x-auth-token']].filter(Boolean).map((v) => String(v).replace(/^Bearer\s+/i, ''));
  return offered.some((v) => sameSecret(v, token));
}

const digits = (n) => String(n || '').replace(/[^\d]/g, '').replace(/^1(?=\d{10}$)/, '');
function isMelody(number) {
  const want = digits(env('MELODY_PHONE'));
  return !!want && digits(number) === want;
}

/* A text that only acknowledges wakes no one. */
const ACK = /^(ok(ay)?|k+|thanks?( you)?|thank u|thx|ty|gracias|got it|cool|great|perfect|nice|yay|yes!?|sounds good|love it|amazing|lol|haha+|👍|🙏|❤️|🤍|🙌|💯|👌|😊|🥰|✅)[\s.!]*$/iu;
const isAck = (t) => ACK.test(String(t || '').trim());

async function api(path, opts) {
  const key = env('INKBOX_API_KEY');
  if (!key) throw new Error('INKBOX_API_KEY is not set on this portal.');
  const res = await fetch(API + path, { method: (opts && opts.method) || 'GET', headers: { 'X-API-Key': key, 'content-type': 'application/json' }, body: opts && opts.body ? JSON.stringify(opts.body) : undefined });
  const text = await res.text();
  let out = null; try { out = text ? JSON.parse(text) : null; } catch (e) { out = { raw: text.slice(0, 300) }; }
  if (!res.ok) throw new Error('Inkbox answered ' + res.status + ': ' + String((out && (out.detail || out.message || out.error)) || text).slice(0, 300));
  return out;
}

/* One subscription on Everly's identity for texts, pointing at this portal.
   An older one for the same address is replaced, so this is safe to press again. */
async function connect(origin) {
  const identity = env('EVERLY_INKBOX_IDENTITY_ID');
  if (!identity) throw new Error('EVERLY_INKBOX_IDENTITY_ID is not set on this portal.');
  const url = String(origin).replace(/\/+$/, '') + '/hooks/inkbox';
  const q = new URLSearchParams({ agent_identity_id: identity, scope: 'identity', url });
  const listed = await api('/webhooks/subscriptions?' + q);
  const subs = Array.isArray(listed) ? listed : (listed && listed.subscriptions) || [];
  for (const s of subs) if (s && s.url === url) await api('/webhooks/subscriptions/' + encodeURIComponent(s.id) + '?scope=identity', { method: 'DELETE' });
  const made = await api('/webhooks/subscriptions', { method: 'POST', body: { agent_identity_id: identity, url, event_types: EVENTS, auth_token: deliveryToken() } });
  return { connected: true, id: made && made.id, url };
}

module.exports = { verify, isMelody, isAck, connect, deliveryToken };
