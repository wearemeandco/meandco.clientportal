/* Inkbox's door: a text to Everly's iMessage line. A genuine text from
   Melody's phone wakes Everly with a pointer to the conversation; she reads
   the text and answers it through her Inkbox connector. Texts from anyone
   else, and a plain "ok" or "gracias", wake no one. Inkbox always gets its
   200 for a genuine delivery, so a failed wake is logged, not retried. */
const inkbox = require('../lib/inkbox.js');
const { wakeEverly } = require('../lib/everly.js');

const json = (code, obj) => ({ statusCode: code, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) });

exports.handler = async function (event) {
  if ((event.httpMethod || 'GET').toUpperCase() !== 'POST') return json(405, { error: 'Use POST.' });
  if (!inkbox.verify(event.headers)) return json(401, { error: 'Not a verified Inkbox delivery.' });
  let body; try { body = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : event.body || '{}'); } catch (e) { return json(400, { error: 'Body is not JSON.' }); }
  const type = body.event_type || body.type || body.event;
  const msg = (body.data && body.data.message) || {};
  if (type !== 'imessage.received' || msg.is_group) return json(200, { ok: true, woke: false, why: 'not a one to one text' });
  if (!inkbox.isMelody(msg.remote_number)) return json(200, { ok: true, woke: false, why: 'not from Melody' });
  if (inkbox.isAck(msg.content)) return json(200, { ok: true, woke: false, why: 'an acknowledgement' });
  const out = await wakeEverly('Inkbox: Melody texted Everly, conversation ' + String(msg.conversation_id || '').slice(0, 80) + '. Read the text with the Inkbox connector and answer per the texting skill.');
  if (!out.fired) console.error('[hook-inkbox] wake failed: ' + out.why);
  return json(200, { ok: true, woke: !!out.fired });
};
