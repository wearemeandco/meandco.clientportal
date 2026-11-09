/* Everly's door into the portal: POST /hooks/agent with
   "Authorization: Bearer <EVERLY_AGENT_TOKEN>" and a JSON body naming one
   operation. Everly reaches it with `node tools/portal.mjs` in her own
   repository. It reads clients, inquiries and Melody's workflow asks, and
   writes only notes, ask updates and inquiry stages. Nothing here deletes,
   sends mail, or touches money, passcodes or contracts.

   Operations:
     { op: "read", collection: "clients" }          every client and their portal stage
     { op: "read", collection: "client", slug }      one client's portal state and requests
     { op: "read", collection: "inquiries" }         the interest form submissions, newest first
     { op: "read", collection: "workflow" }          Melody's workflow asks and the steps
     { op: "ask-update", id, status, pr, preview, note }
                                                     status: sent, building, preview, live, declined
     { op: "note", slug, text }                      adds a line to the client's portal activity
     { op: "inquiry-update", id, stage, note }        stage: contacted, call_booked, proposal, won, closed
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

exports.handler = async function (event) {
  require('../portal/store').connectBlobs(event);
  if ((event.httpMethod || 'GET').toUpperCase() !== 'POST') return json(405, { error: 'Use POST.' });
  if (!authorized(event)) return json(401, { error: 'Not Everly.' });
  let body; try { body = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : event.body || '{}'); } catch (e) { return json(400, { error: 'Body is not JSON.' }); }
  const { getAllClients } = require('../portal/clients.js');
  const blobs = require('../portal/blobs.js');
  const wf = require('../admin/workflows.js');
  const { listIntakeRecords, intakeStore } = require('../portal/intake-store.js');
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
      return json(400, { error: 'collection is clients, client, inquiries or workflow' });
    }
    if (body.op === 'ask-update') return json(200, { ok: true, ask: await wf.updateAsk(clean(body.id, 80), { status: body.status, pr: body.pr, preview: body.preview, note: body.note }) });
    if (body.op === 'note') {
      const text = clean(body.text, 600);
      if (!text) return json(400, { error: 'text is empty' });
      await blobs.appendActivity(clean(body.slug, 80), 'Everly: ' + text);
      return json(200, { ok: true });
    }
    if (body.op === 'inquiry-update') {
      const id = clean(body.id, 120);
      if (INQUIRY_STAGES.indexOf(body.stage) === -1) return json(400, { error: 'stage is one of ' + INQUIRY_STAGES.join(', ') });
      const st = intakeStore();
      const rec = await st.get(id, { type: 'json' });
      if (!rec) return json(404, { error: 'No inquiry ' + id });
      rec.stage = body.stage;
      rec.notes = (Array.isArray(rec.notes) ? rec.notes : []).concat(body.note ? [{ at: new Date().toISOString(), by: 'everly', text: clean(body.note, 600) }] : []).slice(-50);
      await st.setJSON(id, rec);
      return json(200, { ok: true, inquiry: { id, stage: rec.stage } });
    }
    if (body.op === 'wake-ida') {
      const file = clean(body.file, 200), sha = clean(body.sha, 60);
      if (!/^docs\/builds\/[a-z0-9-]+\.md$/.test(file) || !/^[0-9a-f]{7,40}$/.test(sha)) return json(400, { error: 'file is docs/builds/<slug>.md and sha is its commit' });
      const out = await require('../lib/everly.js').wakeIda('Everly: build request ' + file + ' at everlyagent commit ' + sha + '. ' + clean(body.summary, 600));
      return json(out.fired ? 200 : 502, out.fired ? { woke: true } : { woke: false, why: out.why });
    }
    return json(400, { error: 'op is read, ask-update, note, inquiry-update or wake-ida' });
  } catch (err) {
    console.error('[hook-agent] ' + body.op + ' failed: ' + err.message);
    return json(/is one of|No ask|No inquiry|No portal/.test(err.message) ? 400 : 500, { error: err.message });
  }
};
