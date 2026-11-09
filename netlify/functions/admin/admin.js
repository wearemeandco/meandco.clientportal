/* ============================================================
   Me&Co. — portal admin
   ------------------------------------------------------------
   Melody-only. Single shared admin passcode (ADMIN_PORTAL_PASSWORD
   env var), same session-cookie pattern as the client gate.

   /admin: grid of clients, one card each, same idea as AI Lab's own
   dashboard, click through to edit.
   /admin/<slug>: the same branded layout as that client's real
   portal, but every field editable inline, rich text for anything
   written, autosaves on blur/change. It is the friendly editor, not a
   raw form page.
   ============================================================ */

const crypto = require('crypto');
const { wakeEverly } = require('../lib/everly');
const { getAllClients, getClient, addClientToIndex, setClientEmails } = require('../portal/clients');
const {
  getClientState,
  saveClientState,
  setCardStatus,
  appendActivity,
  addCardItem,
  addCard,
  setPaidUpfront,
  updateCardFields,
  updateItemFields,
  deleteCardItem,
  setChecklist,
  renameProject,
  setBriefSelection,
} = require('../portal/blobs');
const { renderClientGrid, renderClientEditor } = require('./editor');
const { renderBriefPicker, renderInquiryList } = require('./brief-picker');
const { listIntakeRecords } = require('../portal/intake-store');
const { saveFile } = require('../portal/files');
const passcodes = require('../portal/passcodes');
const { makeMagicToken } = require('../portal/session');
const { sendInvite } = require('../portal/invite');
const { addressesOnFile: forgotAddresses } = require('../portal/forgot');

const COOKIE_NAME = 'mora_admin';
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a), 'utf8').digest();
  const hb = crypto.createHash('sha256').update(String(b), 'utf8').digest();
  return crypto.timingSafeEqual(ha, hb);
}
function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}
function makeToken(secret) {
  const payload = Buffer.from(JSON.stringify({ e: Date.now() + TOKEN_TTL_MS })).toString('base64url');
  return payload + '.' + sign(payload, secret);
}
function verifyToken(token, secret) {
  if (!token) return false;
  const dot = token.lastIndexOf('.');
  if (dot < 1) return false;
  const payload = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = sign(payload, secret);
  if (mac.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data && typeof data.e === 'number' && data.e > Date.now();
  } catch (e) {
    return false;
  }
}
function readCookie(headers, name) {
  const raw = (headers && (headers.cookie || headers.Cookie)) || '';
  const parts = raw.split(';');
  for (let i = 0; i < parts.length; i++) {
    const eq = parts[i].indexOf('=');
    if (eq === -1) continue;
    if (parts[i].slice(0, eq).trim() === name) return decodeURIComponent(parts[i].slice(eq + 1).trim());
  }
  return null;
}
function buildCookie(value, secure) {
  const bits = [COOKIE_NAME + '=' + encodeURIComponent(value), 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (secure) bits.push('Secure');
  return bits.join('; ');
}

const NO_STORE = { 'Cache-Control': 'no-store, private, max-age=0', 'X-Robots-Tag': 'noindex, nofollow' };
function html(status, body, extra) {
  return { statusCode: status, headers: Object.assign({ 'Content-Type': 'text/html; charset=utf-8' }, NO_STORE, extra || {}), body };
}
function json(status, obj, extra) {
  return { statusCode: status, headers: Object.assign({ 'Content-Type': 'application/json' }, NO_STORE, extra || {}), body: JSON.stringify(obj) };
}

/* The sentence shown to Melody after an invite. Counts only. */
function inviteMessage(r) {
  if (!r.total) return 'No email addresses on file for this client.';
  const parts = [];
  if (r.sent) parts.push('Invite sent to ' + r.sent + (r.sent === 1 ? ' address.' : ' addresses.'));
  if (r.alreadySent) parts.push(r.alreadySent + ' already had one today.');
  if (r.failed) parts.push(r.failed + ' could not be sent, see the function log.');
  return parts.join(' ');
}

function loginPage(error) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Me&Co. Admin</title>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root{--blue:#2A4FBF;--blue-ink:#1E3A94;--oxford:#22315E;--paper:#FAF8F2;--paper-ink:#1a1a1a}
    body{font-family:'Plus Jakarta Sans',-apple-system,sans-serif;background:var(--paper);color:var(--paper-ink);display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
    .card{background:#fff;border:2px solid var(--oxford);border-radius:14px;padding:2rem;width:100%;max-width:360px}
    h2{font-family:'Fraunces',sans-serif;color:var(--oxford)}
    input{width:100%;padding:10px;margin:10px 0;border:2px solid #e4e1d5;border-radius:8px;font-size:16px;box-sizing:border-box}
    button{width:100%;padding:12px;background:var(--blue);color:#fff;border:none;border-radius:8px;font-weight:700;font-family:'Fraunces',sans-serif;cursor:pointer}
    button:hover{background:var(--blue-ink)}
    .err{color:#a8391b;font-size:0.85rem}
  </style></head><body>
  <div class="card">
    <h2>Admin</h2>
    <form method="post" action="/admin">
      <input type="password" name="passcode" placeholder="Admin passcode" autofocus required>
      ${error ? `<p class="err">${error}</p>` : ''}
      <button type="submit">Enter</button>
    </form>
  </div></body></html>`;
}

function getSlugFromPath(event) {
  const p = (event.path || '').replace(/\/+$/, '');
  const m = p.match(/\/admin\/([^/]+)(?:\/brief)?$/);
  return m ? decodeURIComponent(m[1]) : (event.queryStringParameters && event.queryStringParameters.slug) || '';
}

// /admin/<slug>/brief, the section picker. A suffix rather than a query
// param so it is a real, linkable page Melody can bookmark per client.
function isBriefPath(event) {
  if (event.queryStringParameters && event.queryStringParameters.brief) return true;
  return /\/admin\/[^/]+\/brief$/.test((event.path || '').replace(/\/+$/, ''));
}

function isWorkflowPath(event) {
  return /\/admin\/workflows?$/.test((event.path || '').replace(/\/+$/, ''));
}

function isInquiriesPath(event) {
  return /\/admin\/inquiries$/.test((event.path || '').replace(/\/+$/, ''));
}

exports.handler = async function (event) {
  require('../portal/store').connectBlobs(event);
  require('../portal/files-store').connectBlobs(event);
  const secret = process.env.ADMIN_PORTAL_PASSWORD;
  const secure = String((event.headers && (event.headers['x-forwarded-proto'] || event.headers['X-Forwarded-Proto'])) || 'https').indexOf('https') !== -1;

  if (!secret) {
    console.error('[admin] Missing ADMIN_PORTAL_PASSWORD env var.');
    return html(503, '<p>Admin not configured.</p>');
  }

  const method = (event.httpMethod || 'GET').toUpperCase();
  const contentType = String((event.headers && (event.headers['content-type'] || event.headers['Content-Type'])) || '');

  if (method === 'POST' && contentType.indexOf('application/json') !== -1) {
    const token = readCookie(event.headers, COOKIE_NAME);
    if (!verifyToken(token, secret)) return json(401, { ok: false, error: 'Not logged in' });

    let body = {};
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      return json(400, { ok: false, error: 'Bad JSON' });
    }

    try {
      if (body.action === 'unlock') {
        await setCardStatus(body.slug, body.cardId, 'in_progress', 'Unlocked by Melody: ' + body.note);
        return json(200, { ok: true, message: 'Unlocked ' + body.cardId + ' for ' + body.slug });
      }
      if (body.action === 'wake-everly') {
        const out = await wakeEverly('Portal: Melody pressed Wake Everly' + (body.note ? '. Note: ' + String(body.note).slice(0, 300) : ''));
        return json(out.fired ? 200 : 503, out.fired ? { ok: true, message: 'Everly is waking up.' } : { ok: false, error: 'Everly did not wake: ' + out.why + '.' });
      }
      if (body.action === 'build-request') {
        const wf = require('./workflows.js');
        try { return json(200, Object.assign({ ok: true }, await wf.sendBuildAsk(body, await getAllClients()))); }
        catch (err) { return json(400, { ok: false, error: err.message }); }
      }
      if (body.action === 'activity') {
        await appendActivity(body.slug, body.text, body.cardId || null);
        return json(200, { ok: true, message: 'Logged for ' + body.slug });
      }
      if (body.action === 'add-item') {
        await addCardItem(body.slug, body.cardId, {
          type: body.type,
          title: body.title,
          description: body.description,
          url: body.url || null,
          content: body.content || null,
        });
        return json(200, { ok: true, message: 'Added "' + body.title + '" to ' + body.cardId });
      }
      if (body.action === 'add-card') {
        // A stored card the client already has data for (a new project
        // reaching Blobs for the first time, or the repo file diverging
        // from the live record) has no other way onto an existing
        // client's live state: every other mutator requires the card to
        // already exist. body.card is the whole card object, id included.
        await addCard(body.slug, body.card || {});
        return json(200, { ok: true, message: 'Added card "' + (body.card && body.card.id) + '" for ' + body.slug });
      }
      if (body.action === 'set-paid-upfront') {
        await setPaidUpfront(body.slug, body.project, body.paidUpfront === 'true' || body.paidUpfront === true);
        return json(200, { ok: true, message: body.project + ' paid-upfront set to ' + body.paidUpfront });
      }
      if (body.action === 'update-card') {
        await updateCardFields(body.slug, body.cardId, body.fields || {});
        return json(200, { ok: true });
      }
      if (body.action === 'update-item') {
        await updateItemFields(body.slug, body.cardId, body.itemId, body.fields || {});
        return json(200, { ok: true });
      }
      if (body.action === 'delete-item') {
        await deleteCardItem(body.slug, body.cardId, body.itemId);
        return json(200, { ok: true });
      }
      if (body.action === 'update-checklist') {
        await setChecklist(body.slug, body.cardId, body.itemId, body.checklist || []);
        return json(200, { ok: true });
      }
      if (body.action === 'set-brief') {
        // Which discovery sections this client actually gets, chosen after
        // their real call. The picker posts the whole selection every time,
        // so unticking is a real removal rather than an append-only list.
        await setBriefSelection(body.slug, body.brief || {});
        return json(200, { ok: true });
      }
      if (body.action === 'rename-project') {
        await renameProject(body.slug, body.oldName, body.newName);
        return json(200, { ok: true });
      }
      if (body.action === 'upload-file') {
        // body.dataUrl is a browser-produced data: URL (base64 payload
        // after the comma). Real files, not a placeholder mechanism.
        const match = /^data:([^;]+);base64,(.+)$/.exec(body.dataUrl || '');
        if (!match) return json(400, { ok: false, error: 'Bad file data.' });
        const mimeType = match[1];
        const buffer = Buffer.from(match[2], 'base64');
        const fileId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
        await saveFile(body.slug, fileId, buffer, body.filename, mimeType);
        await addCardItem(body.slug, body.cardId, {
          type: /^application\/pdf$/.test(mimeType) ? 'pdf' : 'link',
          title: body.title || body.filename,
          description: body.description || '',
          fileId,
          mimeType,
        });
        return json(200, { ok: true, message: 'Uploaded "' + body.filename + '" to ' + body.cardId });
      }
      if (body.action === 'files-add' || body.action === 'files-remove') {
        // "Your files and links". Mora adds items here, and only this
        // session can remove an item Mora added (or one carried over from the
        // client's old website). The client's own page removes only theirs.
        const files = require('../portal/files-store');
        if (body.action === 'files-add') {
          const upload = body.upload && typeof body.upload === 'object' ? body.upload : null;
          const item = await files.addItem(body.slug, 'mora', 'Me&Co.', body, upload);
          return json(200, { ok: true, item: { id: item.id } });
        }
        await files.removeItem(body.slug, String(body.id || ''), true);
        return json(200, { ok: true });
      }
      if (body.action === 'reset-passcode') {
        // New readable passcode, stored as a hash only. The plain value goes
        // back in this one response so Melody can copy it; nothing is emailed.
        const slugToReset = String(body.slug || '');
        const known = await getAllClients();
        if (!Object.prototype.hasOwnProperty.call(known, slugToReset)) return json(404, { ok: false, error: 'No such client.' });
        const passcode = passcodes.generatePasscode();
        const rec = await passcodes.setPasscode(slugToReset, passcode);
        const token = makeMagicToken(slugToReset, passcodes.secretFromRecord(rec));
        const origin = process.env.PORTAL_PUBLIC_ORIGIN || 'https://portal.weareme.co';
        return json(200, {
          ok: true,
          passcode,
          link: origin + '/portal/' + encodeURIComponent(slugToReset) + '?k=' + encodeURIComponent(token),
          expiresInDays: 7,
        });
      }
      if (body.action === 'send-invite') {
        // Emails the client a 72 hour link to choose their own passcode. The
        // response carries counts only, never the link or an address.
        const target = await getClient(String(body.slug || ''));
        if (!target) return json(404, { ok: false, error: 'No such client.' });
        const r = await sendInvite(target);
        return json(200, { ok: true, sent: r.sent, alreadySent: r.alreadySent, failed: r.failed, total: r.total, message: inviteMessage(r) });
      }
      if (body.action === 'set-emails') {
        // The addresses a client's invite and Forgot passcode emails go to.
        let saved;
        try {
          saved = await setClientEmails(String(body.slug || ''), body.emails);
        } catch (err) {
          if (err.status === 400) return json(400, { ok: false, error: err.message });
          throw err;
        }
        if (!saved) return json(404, { ok: false, error: 'No such client.' });
        return json(200, { ok: true, emails: saved });
      }
      if (body.action === 'create-client') {
        const slug = String(body.slug || '')
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
        if (!slug) return json(400, { ok: false, error: 'Give the client a name to slugify.' });
        const existing = await getAllClients();
        if (existing[slug]) return json(400, { ok: false, error: 'A client with that slug already exists.' });
        const indexExtra = {};
        if (body.email) indexExtra.email = body.email;
        if (Array.isArray(body.emails) && body.emails.length) indexExtra.emails = body.emails;
        const entry = await addClientToIndex(slug, body.name || slug, indexExtra);
        // New client, not a repeat, starts at the guided sequence's entry
        // point: Discovery unlocked, everything after it locked until it
        // clears, same journey docs/client-portal-mvp-spec.md describes.
        // Full seven-card order, no exceptions: Discovery, Proposal,
        // Contract, Onboarding, Invoice, Deliverables, Offboarding.
        // Skipping Discovery or Onboarding here breaks the sequence, so
        // render the real create-client flow and check it rather than
        // assuming the code matches the rule. Onboarding's id uses the
        // disambiguated "-onboarding-questions" suffix on purpose, never
        // bare "-onboarding", so it can never collide with an
        // "Onboarding Docs" style card on the same regex.
        //
        // An optional `cards` array overrides this default sequence, for a
        // build whose released scope is narrower than the full seven stages
        // (a Discovery-only portal ahead of a written proposal). Absent, the
        // default below is unchanged.
        const defaultCards = [
          { id: 'project1-discovery', project: 'Project 1', label: 'Discovery', status: 'not_started', locked: false },
          { id: 'project1-proposal', project: 'Project 1', label: 'Proposal', status: 'not_started', locked: true },
          { id: 'project1-contract', project: 'Project 1', label: 'Contract', status: 'not_started', locked: true },
          { id: 'project1-onboarding-questions', project: 'Project 1', label: 'Onboarding', status: 'not_started', locked: true, items: [] },
          { id: 'project1-invoice', project: 'Project 1', label: 'Invoice', status: 'not_started', locked: true },
          { id: 'project1-deliverables', project: 'Project 1', label: 'Deliverables', status: 'not_started', locked: true, items: [] },
          { id: 'project1-offboarding', project: 'Project 1', label: 'Offboarding', status: 'not_started', locked: true, lockRule: 'invoice', items: [] },
        ];
        const cards = Array.isArray(body.cards) && body.cards.length ? body.cards : defaultCards;
        await saveClientState(slug, {
          slug,
          name: body.name || slug,
          repeatClient: false,
          paidUpfrontProjects: [],
          cards,
          activity: [],
        });
        // A client with an address gets the invite straight away, which also
        // creates their passcode record. A failed invite never fails creation.
        let message =
          'Created ' +
          slug +
          '. One real step left: set ' +
          entry.envKey +
          ' in your environment (a real passcode, not created automatically).';
        if (forgotAddresses(entry).length) {
          try {
            const invited = await sendInvite(Object.assign({ slug }, entry));
            message = 'Created ' + slug + '. ' + inviteMessage(invited);
          } catch (err) {
            console.error('[admin] invite after create-client failed: ' + err.message);
            message = 'Created ' + slug + '. The invite could not be sent, see the function log. Use Send invite to try again.';
          }
        }
        return json(200, { ok: true, message });
      }
      return json(400, { ok: false, error: 'Unknown action' });
    } catch (err) {
      return json(500, { ok: false, error: err.message });
    }
  }

  if (method === 'POST') {
    // Login form submission (passcode).
    const fields = new URLSearchParams(event.body || '');
    const attempt = fields.get('passcode') || '';
    await new Promise((r) => setTimeout(r, 350));
    if (!attempt || !safeEqual(attempt, secret)) {
      return html(401, loginPage('Wrong passcode.'));
    }
    const clients = await getAllClients();
    return html(200, renderClientGrid(clients), { 'Set-Cookie': buildCookie(makeToken(secret), secure) });
  }

  const token = readCookie(event.headers, COOKIE_NAME);
  if (!verifyToken(token, secret)) return html(200, loginPage(null));

  /* Client secrets (see docs/client-secrets.md). Admin session only, one
     value per request, never cached, never linked from any client page. */
  const secretMatch = (event.path || '').replace(/\/+$/, '').match(/\/admin\/secrets\/([a-z0-9_-]+)\/([a-z0-9_-]+)$/);
  if (secretMatch) {
    const clientSecrets = require('../portal/client-secrets');
    try {
      const rec = await clientSecrets.readSecret(secretMatch[1], secretMatch[2]);
      if (!rec) return { statusCode: 404, headers: Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, NO_STORE), body: 'Nothing stored.' };
      return { statusCode: 200, headers: Object.assign({ 'Content-Type': 'application/json' }, NO_STORE), body: JSON.stringify(rec) };
    } catch (err) {
      console.error('[admin] secret read failed');
      return { statusCode: 500, headers: Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, NO_STORE), body: 'Could not read it.' };
    }
  }

  if (isWorkflowPath(event)) {
    const wf = require('./workflows.js');
    return html(200, wf.renderWorkflows(await getAllClients(), await wf.listAsks()));
  }

  if (isInquiriesPath(event)) {
    const records = await listIntakeRecords();
    return html(200, renderInquiryList(records));
  }

  const slug = getSlugFromPath(event);
  const clients = await getAllClients();
  if (!slug) return html(200, renderClientGrid(clients));

  const client = clients[slug];
  if (!client) return html(404, '<p>No such client.</p>');
  const state = await getClientState(slug);
  if (!state) return html(200, '<p>No portal data for this client yet. Add a card to get started.</p>');
  if (isBriefPath(event)) return html(200, renderBriefPicker(Object.assign({ slug }, client), state));
  return html(200, renderClientEditor(Object.assign({ slug }, client), state));
};
