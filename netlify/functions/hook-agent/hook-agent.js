/* Everly's door into the portal: POST /hooks/agent with
   "Authorization: Bearer <EVERLY_AGENT_TOKEN>" and a JSON body naming one
   operation. Everly reaches it with `node tools/portal.mjs` in her own
   repository. It reads clients, inquiries and Melody's workflow asks, and
   keeps cards true, adds a business (portal locked) when Melody asks, and
   writes notes, ask updates and inquiry stages. Nothing here deletes or
   archives a client, unlocks a portal, sends mail, or touches money,
   passcodes or contracts.

   Operations:
     { op: "read", collection: "clients" }          every client and their portal stage
     { op: "read", collection: "client", slug }      one client's portal state and requests
     { op: "read", collection: "inquiries" }         the interest form submissions, newest first
     { op: "read", collection: "workflow" }          Melody's workflow asks and the steps
     { op: "read", collection: "log" }               the newest 50 log entries
     { op: "ask-update", id, status, pr, preview, note }
                                                     status: sent, building, preview, live, declined
     { op: "note", slug, text }                      adds a line to the client's portal activity
     { op: "update-card", slug, cardId, fields }       fields: status, description, label
     { op: "update-item", slug, cardId, itemId, fields }
                                                     fields: title, description, status, notes, url, content
     { op: "add-item", slug, cardId, item }            item: type (link, text, note), title, description, url, content
     { op: "inquiry-update", id, stage, note }        stage: contacted, call_booked, proposal, won, closed
     { op: "add-client", name, emails }              adds a business and creates its portal, locked, with
                                                     the same seven cards as Melody's Add a business form.
                                                     Sends nothing: the invite is Melody's button.
     { op: "log", agent, woke, did, links, waiting, status }
                                                     one entry for this run, shown on the admin Everly tab
                                                     agent: everly or ida; status: done, waiting, blocked;
                                                     did, links, waiting: up to 12 lines of 300 characters;
                                                     links are https; the newest 500 entries are kept
     { op: "wake-ida", file, sha, summary }           wakes Ida's routine with a build request Everly
                                                     already pushed: its path and commit in everlyagent */
const crypto = require('crypto');

const json = (code, obj) => ({ statusCode: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(obj) });
const clean = (v, n) => String(v == null ? '' : v).replace(/\u2014/g, ',').trim().slice(0, n);

function authorized(event) {
  const want = String(process.env.EVERLY_AGENT_TOKEN || '');
  const h = (event.headers && (event.headers.authorization || event.headers.Authorization)) || '';
  const got = String(h).replace(/^Bearer\s+/i, '');
  if (want.length < 24 || !got) return false;
  const a = crypto.createHash('sha256').update(got).digest(), b = crypto.createHash('sha256').update(want).digest();
  return crypto.timingSafeEqual(a, b);
}

const INQUIRY_STAGES = ['contacted', 'call_booked', 'proposal', 'won', 'closed'];
const CARD_STATUSES = ['not_started', 'in_progress', 'complete'];
const ITEM_STATUSES = ['not_started', 'in_progress', 'complete', 'needs', 'done'];
const ITEM_TYPES = ['link', 'text', 'note'];
const CARD_FIELDS = { status: 40, description: 2000, label: 120 };
const ITEM_FIELDS = { title: 200, description: 2000, status: 40, notes: 4000, url: 600, content: 8000 };
// Anything that names money, a gate, a passcode, a file or a send is not the door's to change.
const MONEY_OR_GATE = /amount|price|paid|payment|balance|invoice|total|fee|cost|stripe|passcode|password|secret|token|lock|unlock|file|mime|email/i;

class DoorError extends Error {}

function pick(fields, allowed, statuses) {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw new DoorError('fields is an object');
  const out = {};
  Object.keys(fields).forEach((k) => {
    if (MONEY_OR_GATE.test(k)) throw new DoorError('The agent door cannot change "' + k + '".');
    if (!Object.prototype.hasOwnProperty.call(allowed, k)) throw new DoorError('"' + k + '" is not a field the agent door can change. Allowed: ' + Object.keys(allowed).join(', ') + '.');
    if (typeof fields[k] !== 'string') throw new DoorError('"' + k + '" is text.');
    out[k] = clean(fields[k], allowed[k]);
  });
  if (!Object.keys(out).length) throw new DoorError('fields is empty');
  if (out.status !== undefined && statuses.indexOf(out.status) === -1) throw new DoorError('status is one of ' + statuses.join(', '));
  if (out.url !== undefined && out.url !== '' && !/^(https:\/\/|\/portal\/)/.test(out.url)) throw new DoorError('url is an https link or a /portal/ path');
  return out;
}

/* The client must exist, not be archived, and the card must not carry money. */
async function writableCard(slug, cardId) {
  const clients = await require('../portal/clients.js').getAllClients();
  if (!Object.prototype.hasOwnProperty.call(clients, slug)) throw new DoorError('No portal for ' + slug);
  if (clients[slug].archived) throw new DoorError('This client is archived. The agent door does not write to it.');
  if (/invoice|payment|receipt/i.test(String(cardId))) throw new DoorError('The agent door does not write to invoice or payment cards.');
}


exports.handler = async function (event) {
  require('../portal/store').connectBlobs(event);
  if ((event.httpMethod || 'GET').toUpperCase() !== 'POST') return json(405, { error: 'Use POST.' });
  if (!authorized(event)) return json(401, { error: 'Not Everly.' });
  let body; try { body = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : event.body || '{}'); } catch (e) { return json(400, { error: 'Body is not JSON.' }); }
  const { getAllClients } = require('../portal/clients.js');
  const blobs = require('../portal/blobs.js');
  const wf = require('../admin/workflows.js');
  const { listIntakeRecords, getIntakeRecord, putIntakeRecord } = require('../portal/intake-store.js');
  try {
    if (body.op === 'read') {
      if (body.collection === 'clients') {
        const clients = await getAllClients();
        const out = [];
        for (const slug of Object.keys(clients)) {
          const st = await blobs.getClientState(slug).catch(() => null);
          out.push({ slug, name: clients[slug].name || slug, stage: st && (st.stage || st.project && st.project.stage) || '', cards: st && Array.isArray(st.cards) ? st.cards.map((c) => ({ id: c.id, title: c.title, status: c.status })) : [] });
        }
        return json(200, { ok: true, clients: out });
      }
      if (body.collection === 'client') {
        const slug = clean(body.slug, 80);
        const st = await blobs.getClientState(slug);
        if (!st) return json(404, { error: 'No portal for ' + slug });
        const req = await require('../portal/requests-store.js').getRequests(slug).catch(() => null);
        return json(200, { ok: true, slug, state: st, requests: req });
      }
      if (body.collection === 'inquiries') {
        const recs = (await listIntakeRecords()).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
        return json(200, { ok: true, inquiries: recs.slice(0, Math.min(Number(body.limit) || 50, 200)) });
      }
      if (body.collection === 'workflow') return json(200, { ok: true, asks: await wf.listAsks(), steps: wf.steps() });
      if (body.collection === 'log') return json(200, { ok: true, log: await require('../portal/agent-log.js').listEntries(50) });
      return json(400, { error: 'collection is clients, client, inquiries, workflow or log' });
    }
    if (body.op === 'log') {
      const entry = await require('../portal/agent-log.js').addEntry(body);
      return json(200, { ok: true, at: entry.at });
    }
    if (body.op === 'ask-update') return json(200, { ok: true, ask: await wf.updateAsk(clean(body.id, 80), { status: body.status, pr: body.pr, preview: body.preview, note: body.note }) });
    if (body.op === 'note') {
      const text = clean(body.text, 600);
      if (!text) return json(400, { error: 'text is empty' });
      await writableCard(clean(body.slug, 80), '');
      await blobs.appendActivity(clean(body.slug, 80), 'Everly: ' + text);
      return json(200, { ok: true });
    }
    if (body.op === 'update-card') {
      const slug = clean(body.slug, 80), cardId = clean(body.cardId, 120);
      await writableCard(slug, cardId);
      await blobs.updateCardFields(slug, cardId, pick(body.fields, CARD_FIELDS, CARD_STATUSES));
      return json(200, { ok: true });
    }
    if (body.op === 'update-item') {
      const slug = clean(body.slug, 80), cardId = clean(body.cardId, 120), itemId = clean(body.itemId, 160);
      await writableCard(slug, cardId);
      await blobs.updateItemFields(slug, cardId, itemId, pick(body.fields, ITEM_FIELDS, ITEM_STATUSES));
      return json(200, { ok: true });
    }
    if (body.op === 'add-item') {
      const slug = clean(body.slug, 80), cardId = clean(body.cardId, 120);
      await writableCard(slug, cardId);
      const raw = body.item && typeof body.item === 'object' ? body.item : null;
      if (!raw) return json(400, { error: 'item is an object' });
      const type = raw.type === undefined ? 'link' : raw.type;
      if (ITEM_TYPES.indexOf(type) === -1) throw new DoorError('type is one of ' + ITEM_TYPES.join(', '));
      const rest = Object.assign({}, raw); delete rest.type;
      const fields = pick(rest, ITEM_FIELDS, ITEM_STATUSES);
      if (!fields.title) throw new DoorError('title is required');
      await blobs.addCardItem(slug, cardId, { type, title: fields.title, description: fields.description || '', url: fields.url || null, content: fields.content || null });
      return json(200, { ok: true });
    }
    if (body.op === 'add-client') {
      const { createClient, NewClientError } = require('../portal/new-client.js');
      const emails = Array.isArray(body.emails) ? body.emails.slice(0, 10).map((e) => clean(e, 200)) : [];
      try {
        const made = await createClient({ name: clean(body.name, 120), emails, locked: true });
        await blobs.appendActivity(made.slug, 'Everly: set up this portal.');
        return json(200, { ok: true, slug: made.slug, locked: true, next: 'Melody opens the business in her admin, checks it, unlocks it and sends the invite.' });
      } catch (err) {
        if (err instanceof NewClientError) throw new DoorError(err.message);
        throw err;
      }
    }
    if (body.op === 'inquiry-update') {
      const id = clean(body.id, 120);
      if (INQUIRY_STAGES.indexOf(body.stage) === -1) return json(400, { error: 'stage is one of ' + INQUIRY_STAGES.join(', ') });
      const rec = await getIntakeRecord(id);
      if (!rec) return json(404, { error: 'No inquiry ' + id });
      rec.stage = body.stage;
      rec.notes = (Array.isArray(rec.notes) ? rec.notes : []).concat(body.note ? [{ at: new Date().toISOString(), by: 'everly', text: clean(body.note, 600) }] : []).slice(-50);
      await putIntakeRecord(id, rec);
      return json(200, { ok: true, inquiry: { id, stage: rec.stage } });
    }
    if (body.op === 'wake-ida') {
      const file = clean(body.file, 200), sha = clean(body.sha, 60);
      if (!/^docs\/builds\/[a-z0-9-]+\.md$/.test(file) || !/^[0-9a-f]{7,40}$/.test(sha)) return json(400, { error: 'file is docs/builds/<slug>.md and sha is its commit' });
      const out = await require('../lib/everly.js').wakeIda('Everly: build request ' + file + ' at everlyagent commit ' + sha + '. ' + clean(body.summary, 600));
      return json(out.fired ? 200 : 502, out.fired ? { woke: true } : { woke: false, why: out.why });
    }
    return json(400, { error: 'op is read, ask-update, note, update-card, update-item, add-item, add-client, log, inquiry-update or wake-ida' });
  } catch (err) {
    if (err instanceof DoorError || err instanceof require('../portal/agent-log.js').LogError || /^No (card|item)/.test(err.message)) return json(400, { error: err.message });
    console.error('[hook-agent] ' + body.op + ' failed: ' + err.message);
    return json(/is one of|No ask|No inquiry|No portal/.test(err.message) ? 400 : 500, { error: err.message });
  }
};
