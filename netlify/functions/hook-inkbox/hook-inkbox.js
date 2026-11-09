/* Inkbox's door: a text to Everly's iMessage line. A genuine text from
   Melody's phone wakes Everly with a pointer to the conversation; she reads
   the text and answers it through her Inkbox connector. Texts from anyone
   else, and a plain "ok" or "gracias", wake no one. A delivery Inkbox sends
   twice wakes once. A text that lands within ten minutes of a wake waits for
   that run, which reads the conversation again before it ends. Inkbox always
   gets its 200 for a genuine delivery, so a failed wake is logged, not
   retried. The last delivery is kept for Settings to show. */
const HOLD_MS = 10 * 60 * 1000;
const box = () => require('../portal/store').openStore('inkbox');
async function note(rec) { try { await box().setJSON('last-delivery.json', Object.assign({ at: new Date().toISOString() }, rec)); } catch (e) { console.error('[hook-inkbox] note: ' + e.message); } }
const inkbox = require('../lib/inkbox.js');
const { wakeEverly } = require('../lib/everly.js');

const json = (code, obj) => ({ statusCode: code, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) });

exports.handler = async function (event) {
  require('../portal/store').connectBlobs(event);
  if ((event.httpMethod || 'GET').toUpperCase() !== 'POST') return json(405, { error: 'Use POST.' });
  if (!inkbox.verify(event.headers)) return json(401, { error: 'Not a verified Inkbox delivery.' });
  let body; try { body = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : event.body || '{}'); } catch (e) { return json(400, { error: 'Body is not JSON.' }); }
  const type = body.event_type || body.type || body.event;
  const msg = (body.data && body.data.message) || {};
  if (type !== 'imessage.received' || msg.is_group) return json(200, { ok: true, woke: false, why: 'not a one to one text' });
  if (!inkbox.isMelody(msg.remote_number)) { await note({ woke: false, why: 'a text from another number' }); return json(200, { ok: true, woke: false, why: 'not from Melody' }); }
  const id = String(body.id || body.event_id || msg.id || '').slice(0, 120);
  if (id) {
    const seen = await box().get('seen-' + id, { type: 'json' }).catch(() => null);
    if (seen) return json(200, { ok: true, duplicate: true });
    await box().setJSON('seen-' + id, { at: new Date().toISOString() }).catch(() => null);
  }
  if (inkbox.isAck(msg.content)) { await note({ woke: false, why: 'just an ok, nothing to do' }); return json(200, { ok: true, woke: false, why: 'an acknowledgement' }); }
  const last = await box().get('last-wake.json', { type: 'json' }).catch(() => null);
  if (last && Date.now() - Date.parse(last.at) < HOLD_MS) { await note({ woke: false, why: 'added to the run already going' }); return json(200, { ok: true, woke: false, held: true }); }
  const out = await wakeEverly('Inkbox: Melody texted Everly, conversation ' + String(msg.conversation_id || '').slice(0, 80) + '. Read the text with the Inkbox connector and answer per the texting skill.');
  if (out.fired) await box().setJSON('last-wake.json', { at: new Date().toISOString() }).catch(() => null);
  else console.error('[hook-inkbox] wake failed: ' + out.why);
  await note({ woke: !!out.fired, why: out.fired ? 'woke Everly' : 'wake failed: ' + out.why });
  return json(200, { ok: true, woke: !!out.fired });
};
