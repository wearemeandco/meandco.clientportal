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
const { getAllClients, getClient, addClientToIndex, setClientEmails, setClientArchived, setClientLocked, normalizeEmails } = require('../portal/clients');
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
const { sendClientMail } = require('../portal/client-mail');
const { addressesOnFile: forgotAddresses } = require('../portal/forgot');

const adminAuth = require('../lib/admin-auth');
const { COOKIE_NAME, safeEqual, makeToken, verifyToken, buildCookie } = adminAuth;

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
  const m = p.match(/\/admin\/([^/]+)(?:\/(?:brief|edit))?$/);
  return m ? decodeURIComponent(m[1]) : (event.queryStringParameters && event.queryStringParameters.slug) || '';
}

// /admin/<slug>/brief, the section picker. A suffix rather than a query
// param so it is a real, linkable page Melody can bookmark per client.
function isBriefPath(event) {
  if (event.queryStringParameters && event.queryStringParameters.brief) return true;
  return /\/admin\/[^/]+\/brief$/.test((event.path || '').replace(/\/+$/, ''));
}

function isEditPath(event) {
  return /\/admin\/[^/]+\/edit$/.test((event.path || '').replace(/\/+$/, ''));
}

/* Each business's card numbers for the home page: their portal state and requests. */
async function homeData(clients) {
  const rs = require('../portal/requests-store.js');
  const data = {};
  for (const slug of Object.keys(clients)) {
    data[slug] = { state: await getClientState(slug).catch(() => null), requests: await rs.getRequests(slug).catch(() => null) };
  }
  return data;
}

/* An ask from the admin bar: saved on the business's record, then Everly is
   woken with a pointer to it. A feature or portal change she hands to Ida.
   A note is saved only. */
async function sendAsk(slug, client, template, fields) {
  const { ASK_TEMPLATES } = require('./admin-bar.js');
  const rs = require('../portal/requests-store.js');
  const t = ASK_TEMPLATES.find((x) => x.id === template);
  if (!t) throw new Error('Pick one of the tiles.');
  const clean = {};
  for (const f of t.fields) clean[f.k] = String((fields && fields[f.k]) || '').replace(/\u2014/g, ',').trim().slice(0, 2000);
  if (!t.fields.some((f) => clean[f.k])) throw new Error('Fill in at least one box.');
  const at = new Date().toISOString();
  const id = 'ask-' + at.replace(/\D/g, '').slice(0, 14) + '-' + require('crypto').randomBytes(2).toString('hex');
  const rec = await rs.getRequests(slug);
  rec.teamAsks = (Array.isArray(rec.teamAsks) ? rec.teamAsks : []).concat({ id, at, template: t.id, to: t.to, fields: clean }).slice(-200);
  await rs.saveRequests(slug, rec);
  if (!t.to) return { id, message: 'Saved on ' + client.name + '\'s record. Everly reads it next run.' };
  const { wakeEverly } = require('../lib/everly.js');
  const woke = await wakeEverly('Portal: Melody asked from the admin bar for ' + slug + ' (' + t.label + '), ask ' + id + '. Read it with node tools/portal.mjs read client ' + slug + ' (requests.teamAsks).' + (t.to === 'ida' ? ' Hand it to Ida.' : ''));
  if (!woke.fired) return { id, message: 'Saved on their record. Everly picks it up on her next run.' };
  return { id, message: t.to === 'ida' ? 'Sent. Everly hands it to Ida, and the preview comes to you.' : 'Sent. Everly has it.' };
}

function isWorkflowPath(event) {
  return /\/admin\/workflows?$/.test((event.path || '').replace(/\/+$/, ''));
}

function isArchivedPath(event) {
  return /\/admin\/archived$/.test((event.path || '').replace(/\/+$/, ''));
}

function isEverlyPath(event) {
  return /\/admin\/everly$/.test((event.path || '').replace(/\/+$/, ''));
}

function isInquiriesPath(event) {
  return /\/admin\/inquiries$/.test((event.path || '').replace(/\/+$/, ''));
}

exports.handler = async function (event) {
  require('../portal/store').connectBlobs(event);
  require('../portal/files-store').connectBlobs(event);
  const secret = adminAuth.signingSecret();
  const secure = String((event.headers && (event.headers['x-forwarded-proto'] || event.headers['X-Forwarded-Proto'])) || 'https').indexOf('https') !== -1;

  if (!secret) {
    console.error('[admin] Missing ADMIN_PORTAL_PASSWORD (or MELODY_ADMIN) env var.');
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
      if (body.action === 'inkbox-connect') {
        try { return json(200, Object.assign({ ok: true }, await require('../lib/inkbox.js').connect(process.env.PORTAL_PUBLIC_ORIGIN || ('https://' + (event.headers.host || 'meandco-portal.netlify.app'))))); }
        catch (err) { return json(400, { ok: false, error: err.message }); }
      }
      if (body.action === 'ask') {
        const clients = await getAllClients();
        const c = clients[body.slug];
        if (!c) return json(404, { ok: false, error: 'No such business.' });
        try { return json(200, Object.assign({ ok: true }, await sendAsk(body.slug, Object.assign({ slug: body.slug }, c), body.template, body.fields))); }
        catch (err) { return json(400, { ok: false, error: err.message }); }
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
        const origin = process.env.PORTAL_PUBLIC_ORIGIN || 'https://clients.weareme.co';
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
      if (body.action === 'unlock-portal' || body.action === 'lock-portal') {
        // Clears or sets the "being set up" page clients see. The admin view
        // always shows the real portal.
        const entry = await setClientLocked(String(body.slug || ''), body.action === 'lock-portal');
        if (!entry) return json(404, { ok: false, error: 'No such client.' });
        return json(200, { ok: true, locked: !!entry.locked, message: entry.locked ? 'Locked. Their portal shows the setting up page.' : 'Unlocked. Their portal is open to them.' });
      }
      if (body.action === 'archive-client' || body.action === 'unarchive-client') {
        // Reversible: the portal closes (or reopens) and nothing is removed.
        const entry = await setClientArchived(String(body.slug || ''), body.action === 'archive-client');
        if (!entry) return json(404, { ok: false, error: 'No such client.' });
        return json(200, { ok: true, archived: !!entry.archived, message: body.action === 'archive-client' ? 'Archived. Their portal is closed and nothing was removed.' : 'Unarchived. Their portal is open again.' });
      }
      if (body.action === 'delete-client') {
        // Irreversible, and only for a client that is already archived. The
        // typed confirmation must equal the client's display name exactly.
        const slugD = String(body.slug || '');
        const target = (await getAllClients())[slugD];
        if (!target) return json(404, { ok: false, error: 'No such client.' });
        if (!target.archived) return json(400, { ok: false, error: 'Archive this client first. Only an archived client can be deleted.' });
        if (typeof body.confirm !== 'string' || body.confirm !== String(target.name || slugD)) {
          return json(400, { ok: false, error: 'The name you typed does not match. Nothing was deleted.' });
        }
        const counts = await require('../portal/client-delete').deleteClientData(slugD);
        return json(200, { ok: true, deleted: slugD, counts, message: 'Deleted ' + slugD + ' and all of its records.' });
      }
      if (body.action === 'create-client') {
        // The add-a-business form sends each choice explicitly. A caller that
        // names none keeps the original behaviour: portal created, invite
        // sent when an address is on file.
        const createPortal = body.createPortal !== false;
        const lockPortal = body.locked === true;
        const wantInvite = body.sendInvite === undefined ? true : body.sendInvite === true;
        const wantBrief = body.sendBrief === true;
        const wantCalendar = body.sendCalendar === true;
        if (!createPortal && (wantBrief || (body.sendInvite === true))) {
          return json(400, { ok: false, error: 'The invite and the brief go to a portal. Tick Create their portal, or untick them.' });
        }
        if (wantCalendar && !require('../portal/client-mail').bookingUrl()) {
          return json(400, { ok: false, error: 'There is no booking link set for the calendar email.' });
        }
        const { createClient, NewClientError } = require('../portal/new-client');
        let made;
        try {
          made = await createClient({ name: body.name, slug: body.slug, emails: [].concat(body.emails || [], body.email ? [body.email] : []), locked: lockPortal, createPortal, cards: body.cards });
        } catch (err) {
          if (err instanceof NewClientError) return json(400, { ok: false, error: err.message });
          throw err;
        }
        const slug = made.slug;
        const entry = made.entry;
        await require('../lib/everly').wakeForPortal(slug, 'business-added', slug).catch(() => null);
        // Each email that goes to the client is one the caller asked for. A
        // failed send never fails creation.
        const target = Object.assign({ slug }, entry);
        const notes = [];
        if (createPortal && wantInvite && forgotAddresses(entry).length) {
          try {
            notes.push(inviteMessage(await sendInvite(target)));
          } catch (err) {
            console.error('[admin] invite after create-client failed: ' + err.message);
            notes.push('The invite could not be sent, see the function log. Use Send invite to try again.');
          }
        }
        for (const kind of [wantBrief ? 'brief' : '', wantCalendar ? 'calendar' : '']) {
          if (!kind) continue;
          try {
            const r = await sendClientMail(target, kind);
            notes.push(!r.total ? 'No email address on file for the ' + kind + ' email.' : (kind === 'brief' ? 'Brief' : 'Calendar invite') + ': ' + r.sent + ' sent' + (r.alreadySent ? ', ' + r.alreadySent + ' already sent' : '') + (r.failed ? ', ' + r.failed + ' could not be sent, see the function log' : '') + '.');
          } catch (err) {
            console.error('[admin] ' + kind + ' email after create-client failed: ' + err.message);
            notes.push('The ' + kind + ' email could not be sent.');
          }
        }
        const message = 'Created ' + slug + (lockPortal ? ' (portal locked)' : '') + '. ' + (notes.length ? notes.join(' ') : (createPortal ? 'No email was sent.' : 'No portal was created.'));
        return json(200, { ok: true, slug, message });
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
    if (!adminAuth.checkPassword(attempt)) {
      return html(401, loginPage('Wrong passcode.'));
    }
    return { statusCode: 303, headers: Object.assign({ Location: '/admin', 'Set-Cookie': buildCookie(makeToken(secret), secure) }, NO_STORE), body: '' };
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
    const textLast = await require('../portal/store').openStore('inkbox').get('last-delivery.json', { type: 'json' }).catch(() => null);
    return html(200, wf.renderWorkflows(await getAllClients(), await wf.listAsks(), textLast));
  }

  if (isInquiriesPath(event)) {
    const records = await listIntakeRecords();
    return html(200, renderInquiryList(records));
  }

  if (isEverlyPath(event)) {
    const entries = await require('../portal/agent-log.js').listEntries(100);
    return html(200, require('./everly.js').renderEverly(entries, Date.now()));
  }

  if (isArchivedPath(event)) return html(200, require('./home.js').renderArchivedList(await getAllClients()));

  const slug = getSlugFromPath(event);
  const clients = await getAllClients();
  if (!slug) {
    const active = {};
    Object.keys(clients).forEach((s) => { if (!clients[s].archived) active[s] = clients[s]; });
    return html(200, require('./home.js').renderAdminHome(clients, await homeData(active)));
  }

  const client = clients[slug];
  if (!client) return html(404, '<p>No such client.</p>');
  const state = await getClientState(slug);
  if (!state) return html(200, '<p>No portal data for this client yet. Add a card to get started.</p>');
  if (isBriefPath(event)) return html(200, renderBriefPicker(Object.assign({ slug }, client), state));
  if (!isEditPath(event)) return { statusCode: 302, headers: Object.assign({ Location: '/portal/' + encodeURIComponent(slug) }, NO_STORE), body: '' };
  return html(200, renderClientEditor(Object.assign({ slug }, client), state));
};
