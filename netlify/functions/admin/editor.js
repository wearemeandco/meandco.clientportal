/* ============================================================
   Me&Co. — admin editor
   ------------------------------------------------------------
   Two pages:
   - renderClientGrid: /admin home, one card per client (same
     pattern as AI Lab's own dashboard), click through to edit.
   - renderClientEditor: /admin/<slug>, the same branded layout
     as the real client portal, but every field is inline
     editable, autosaves on blur/change, rich text for anything
     written (descriptions, notes, item content, checklist text).
   ============================================================ */

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const BASE_STYLE = `
  :root {
    --blue: #2A4FBF; --blue-ink: #1E3A94; --lime: #F3C7B8; --lime-ink: #6f8a05;
    --oxford: #22315E; --lavender: #6FAFA0; --paper: #FAF8F2; --paper-ink: #1a1a1a; --white: #FFFFFF;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--paper); color: var(--paper-ink); font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; line-height: 1.6; }
  header { padding: clamp(1.2rem, 4vw, 2rem) clamp(1.2rem, 5vw, 3rem); background: var(--white); border-bottom: 2px solid var(--oxford); }
  .kicker { font-family: 'JetBrains Mono', monospace; font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--blue-ink); font-weight: 700; margin: 0 0 0.4rem; }
  h1 { font-family: 'Fraunces', sans-serif; font-weight: 800; font-size: clamp(1.5rem, 4vw, 2rem); margin: 0; color: var(--oxford); }
  .back { font-family: 'JetBrains Mono', monospace; font-size: 0.76rem; font-weight: 700; color: var(--blue-ink); text-decoration: underline; }
  main { max-width: 56rem; margin: 0 auto; padding: clamp(1.5rem, 4vw, 2.5rem) clamp(1.2rem, 5vw, 3rem) 5rem; }
`;

const HEAD = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">`;

function renderClientGrid(clients) {
  const cards = Object.keys(clients)
    .map((slug) => {
      const c = clients[slug];
      return `
      <div class="client-wrap" data-section="client-${escapeHtml(slug)}">
      <a class="client-card" href="/admin/${escapeHtml(slug)}">
        <h3>${escapeHtml(c.name)}</h3>
        <span class="client-slug">/${escapeHtml(slug)}</span>
      </a>
      <button type="button" class="client-reset" data-action="reset-passcode" data-slug="${escapeHtml(slug)}">Reset passcode</button>
      <button type="button" class="client-reset client-invite" data-action="send-invite" data-slug="${escapeHtml(slug)}" data-name="${escapeHtml(c.name)}">Send invite</button>
      <div class="client-reset-result" data-section="reset-result" aria-live="polite" style="display:none"></div>
      </div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Me&Co. Admin</title>
${HEAD}
<style>
  ${BASE_STYLE}
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr)); gap: 1rem; }
  .client-card {
    display: block; background: var(--white); border: 2px solid var(--oxford); border-radius: 12px;
    padding: 1.5rem; text-decoration: none; color: var(--oxford); transition: transform 0.1s ease;
  }
  .client-card:hover { transform: translateY(-2px); border-color: var(--blue); }
  .client-card h3 { font-family: 'Fraunces', sans-serif; margin: 0 0 0.3rem; font-size: 1.15rem; }
  .client-slug { font-family: 'JetBrains Mono', monospace; font-size: 0.76rem; color: #8a8570; }
  .client-wrap { display: flex; flex-direction: column; gap: 0.5rem; }
  .client-reset { font-family: 'JetBrains Mono', monospace; font-size: 0.74rem; font-weight: 700; background: var(--white); color: var(--oxford); border: 2px solid var(--oxford); border-radius: 8px; padding: 0.4rem 0.7rem; cursor: pointer; }
  .client-reset:hover { background: var(--oxford); color: var(--white); }
  .client-reset:focus-visible { outline: 3px solid var(--blue); outline-offset: 2px; }
  .client-invite { min-height: 44px; }
  .client-reset-result { background: var(--white); border: 2px solid var(--oxford); border-radius: 10px; padding: 0.8rem; font-size: 0.82rem; }
  .client-reset-result code { display: block; font-family: 'JetBrains Mono', monospace; font-size: 1rem; font-weight: 700; margin: 0.3rem 0 0.5rem; word-break: break-all; }
  .client-reset-result button { font-family: 'Fraunces', sans-serif; font-weight: 700; font-size: 0.78rem; background: var(--blue); color: var(--white); border: none; border-radius: 6px; padding: 0.4rem 0.8rem; cursor: pointer; margin-right: 0.4rem; }
  .add-client { background: var(--white); border: 2px dashed var(--oxford); border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; }
  .add-client h3 { font-family: 'Fraunces', sans-serif; margin: 0 0 0.8rem; font-size: 1rem; color: var(--oxford); }
  .add-client form { display: flex; gap: 0.6rem; flex-wrap: wrap; }
  .add-client input { flex: 1; min-width: 12rem; padding: 0.5rem 0.7rem; border: 2px solid #e4e1d5; border-radius: 6px; font-size: 0.9rem; }
  .add-client button {
    font-family: 'Fraunces', sans-serif; font-weight: 700; font-size: 0.85rem; background: var(--blue); color: var(--white);
    border: none; border-radius: 6px; padding: 0.5rem 1.1rem; cursor: pointer;
  }
  .add-client button:hover { background: var(--blue-ink); }
  .add-client .note { font-family: 'JetBrains Mono', monospace; font-size: 0.78rem; margin-top: 0.6rem; color: var(--blue-ink); white-space: pre-wrap; }
</style>
</head>
<body>
  <header>
    <p class="kicker">Me&Co.</p>
    <h1>Clients</h1>
    <p style="margin:0.6rem 0 0"><a class="back" href="/admin/inquiries">Inquiries and sign in links &rarr;</a></p>
  </header>
  <main>
    <div class="add-client">
      <h3>Everly</h3>
      <form id="wake-everly-form">
        <input type="text" name="note" placeholder="What should she look at? (optional)">
        <button type="submit">Wake Everly</button>
      </form>
      <p class="note" id="wake-everly-note"></p>
    </div>
    <div class="add-client">
      <h3>+ Add a new client</h3>
      <form id="add-client-form">
        <input type="text" name="name" placeholder="Client name, e.g. Ana Ruiz" required>
        <button type="submit">Create</button>
      </form>
      <p class="note" id="add-client-note"></p>
    </div>
    <div class="grid">${cards}</div>
  </main>
  <script>
    // Reset passcode: shown once, nothing is emailed
    document.querySelectorAll('[data-action="reset-passcode"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var slug = btn.getAttribute('data-slug');
        if (!confirm('Make a new passcode for ' + slug + '? Their old passcode stops working and they are signed out.')) return;
        var box = btn.parentNode.querySelector('[data-section="reset-result"]');
        fetch('/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reset-passcode', slug: slug }) })
          .then(function (r) { return r.json(); })
          .then(function (r) {
            box.style.display = 'block';
            box.textContent = '';
            if (!r.ok) { box.textContent = r.error || 'That did not work.'; return; }
            var intro = document.createElement('div');
            intro.textContent = 'New passcode. Copy it now, it is not shown again:';
            var code = document.createElement('code');
            code.textContent = r.passcode;
            var copyPass = document.createElement('button');
            copyPass.type = 'button';
            copyPass.textContent = 'Copy';
            copyPass.addEventListener('click', function () { navigator.clipboard.writeText(r.passcode).then(function () { copyPass.textContent = 'Copied'; }); });
            var copyLink = document.createElement('button');
            copyLink.type = 'button';
            copyLink.textContent = 'Copy sign-in link';
            copyLink.addEventListener('click', function () { navigator.clipboard.writeText(r.link).then(function () { copyLink.textContent = 'Link copied (7 days)'; }); });
            box.appendChild(intro);
            box.appendChild(code);
            box.appendChild(copyPass);
            box.appendChild(copyLink);
          });
      });
    });
    // Send invite: emails every address on file a link to choose a passcode
    document.querySelectorAll('[data-action="send-invite"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var slug = btn.getAttribute('data-slug');
        var name = btn.getAttribute('data-name') || slug;
        if (!window.confirm('Send the portal invite to every address on file for ' + name + '?')) return;
        var box = btn.parentNode.querySelector('[data-section="reset-result"]');
        box.style.display = 'block';
        box.textContent = 'Sending...';
        fetch('/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send-invite', slug: slug }) })
          .then(function (r) { return r.json(); })
          .then(function (r) { box.textContent = r.message || r.error || 'That did not work.'; })
          .catch(function () { box.textContent = 'That did not work.'; });
      });
    });
    document.getElementById('wake-everly-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var note = document.getElementById('wake-everly-note');
      note.textContent = 'Waking...';
      fetch('/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'wake-everly', note: e.target.note.value }) })
        .then(function (r) { return r.json(); })
        .then(function (r) { note.textContent = r.message || r.error || 'That did not work.'; if (r.ok) e.target.note.value = ''; })
        .catch(function () { note.textContent = 'That did not work.'; });
    });
    document.getElementById('add-client-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var name = e.target.name.value;
      var note = document.getElementById('add-client-note');
      fetch('/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-client', slug: name, name: name }),
      })
        .then(function (r) { return r.json(); })
        .then(function (r) {
          note.textContent = r.message || r.error || '';
          if (r.ok) setTimeout(function () { location.reload(); }, 900);
        });
    });
  </script>
</body>
</html>`;
}

function statusSelect(cardId, itemId, current) {
  const opts = ['not_started', 'in_progress', 'complete']
    .map((s) => `<option value="${s}" ${s === current ? 'selected' : ''}>${s.replace('_', ' ')}</option>`)
    .join('');
  return `<select class="status-select" data-card="${escapeHtml(cardId)}" data-item="${itemId ? escapeHtml(itemId) : ''}">${opts}</select>`;
}

function richBox(value, cardId, itemId, field) {
  return `
  <div class="rich-wrap" data-card="${escapeHtml(cardId)}" data-item="${itemId ? escapeHtml(itemId) : ''}" data-field="${escapeHtml(field)}">
    <div class="rich-toolbar">
      <button type="button" data-cmd="bold"><b>B</b></button>
      <button type="button" data-cmd="italic"><i>I</i></button>
      <button type="button" data-cmd="insertUnorderedList">&bull; List</button>
      <button type="button" data-cmd="createLink">Link</button>
    </div>
    <div class="rich-editable" contenteditable="true">${value || ''}</div>
  </div>`;
}

function checklistEditor(cardId, itemId, checklist) {
  const rows = (checklist || [])
    .map(
      (c, i) => `
    <div class="check-row" data-index="${i}">
      <input type="checkbox" class="check-done" ${c.done ? 'checked' : ''}>
      <input type="text" class="check-text" value="${escapeHtml(c.text)}">
      <button type="button" class="check-remove">&times;</button>
    </div>`
    )
    .join('');
  return `
  <div class="checklist-editor" data-card="${escapeHtml(cardId)}" data-item="${escapeHtml(itemId)}">
    <span class="field-label">Checklist</span>
    ${rows}
    <button type="button" class="check-add">+ Add step</button>
  </div>`;
}

function itemEditorHtml(card, item) {
  return `
  <div class="item-editor" data-card="${escapeHtml(card.id)}" data-item="${escapeHtml(item.id)}">
    <div class="item-editor-top">
      <input type="text" class="item-title" value="${escapeHtml(item.title)}" data-field="title">
      ${statusSelect(card.id, item.id, item.status)}
      <button type="button" class="item-delete">Delete</button>
    </div>
    <label class="field-label">URL</label>
    <input type="text" class="item-url" value="${escapeHtml(item.url || '')}" data-field="url" placeholder="https://...">
    <label class="field-label">Description</label>
    ${richBox(item.description, card.id, item.id, 'description')}
    ${item.type === 'text' ? `<label class="field-label">Content</label>${richBox(item.content, card.id, item.id, 'content')}` : ''}
    <label class="field-label">Notes</label>
    ${richBox(item.notes, card.id, item.id, 'notes')}
    ${checklistEditor(card.id, item.id, item.checklist)}
  </div>`;
}

function cardBlockHtml(card) {
  const items = (card.items || []).map((item) => itemEditorHtml(card, item)).join('');
  return `
  <div class="card-block">
    <div class="card-block-head">
      <h3>${escapeHtml(card.label)}</h3>
      <div class="card-top-fields" data-card="${escapeHtml(card.id)}">
        ${statusSelect(card.id, null, card.status)}
        <label><input type="checkbox" class="card-locked" ${card.locked ? 'checked' : ''} ${card.lockRule ? 'disabled title="Computed from lockRule, edit paid-upfront instead"' : ''}> Locked</label>
      </div>
    </div>
    <label class="field-label">Card description</label>
    ${richBox(card.description, card.id, null, 'description')}
    <div class="items-editor">${items}</div>
    <button type="button" class="item-add" data-card="${escapeHtml(card.id)}">+ Add item</button>
  </div>`;
}

// Grouped by project, exact same structure as the real client dashboard
// (dashboard.js's groupByProject). It is identical to the client portal:
// a project one section, a project two section, and so on.
// One accordion per project, every card for that project
// (Proposal, Contract, Invoice, Deliverables, Onboarding, Offboarding)
// as editable blocks inside it, not flat separate top-level sections.
function groupByProject(cards) {
  const order = [];
  const groups = {};
  (cards || []).forEach((card) => {
    const key = card.project || 'General';
    if (!groups[key]) {
      groups[key] = [];
      order.push(key);
    }
    groups[key].push(card);
  });
  return order.map((key) => ({ project: key, cards: groups[key] }));
}

function projectSectionHtml(group, index) {
  const blocks = group.cards.map(cardBlockHtml).join('');
  return `
  <section class="project" data-index="${index}">
    <div class="project-head-row">
      <button class="project-toggle" type="button" aria-expanded="${index === 0 ? 'true' : 'false'}">
        <span class="chev" aria-hidden="true">&#9662;</span>
      </button>
      <input type="text" class="project-name-input" value="${escapeHtml(group.project)}" data-original="${escapeHtml(group.project)}">
    </div>
    <div class="project-body"${index === 0 ? '' : ' hidden'}>${blocks}</div>
  </section>`;
}

function renderClientEditor(client, state) {
  const onFile = []
    .concat(client.emails || [], client.email ? [client.email] : [])
    .map((e) => String(e).trim().toLowerCase())
    .filter((e, i, all) => e && all.indexOf(e) === i);
  const groups = groupByProject(state.cards);
  const sections = groups.map((g, i) => projectSectionHtml(g, i)).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Edit &middot; ${escapeHtml(client.name)}</title>
${HEAD}
<style>
  ${BASE_STYLE}
  .project { border: 2px solid var(--oxford); border-radius: 10px; margin-bottom: 1rem; overflow: hidden; background: var(--white); }
  .project-head-row { display: flex; align-items: center; gap: 0.6rem; padding: 0.6rem 0.8rem; }
  .project-toggle {
    background: none; border: none; cursor: pointer; padding: 0.5rem;
    display: flex; align-items: center; justify-content: center;
  }
  .project-name-input {
    flex: 1; border: 2px solid transparent; background: none; font-family: 'Fraunces', sans-serif;
    font-weight: 700; font-size: 1rem; color: var(--oxford); padding: 0.4rem 0.5rem; border-radius: 6px;
  }
  .project-name-input:hover, .project-name-input:focus { border-color: #e4e1d5; background: var(--white); }
  .chev { transition: transform 0.15s ease; color: var(--blue); display: block; }
  .project-toggle[aria-expanded="true"] .chev { transform: rotate(180deg); }
  .project-body { border-top: 2px solid var(--oxford); padding: 1rem 1.2rem 1.4rem; }
  .project-body[hidden] { display: none; }

  .card-block { padding: 1rem 0; border-bottom: 1px dashed #e4e1d5; }
  .card-block:last-child { border-bottom: none; }
  .card-block-head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
  .card-block-head h3 { font-family: 'Fraunces', sans-serif; font-size: 0.95rem; margin: 0; color: var(--oxford); }
  .card-top-fields { display: flex; align-items: center; gap: 1rem; margin-bottom: 0.8rem; font-size: 0.85rem; }
  .field-label { display: block; font-family: 'JetBrains Mono', monospace; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--blue-ink); font-weight: 700; margin: 0.7rem 0 0.3rem; }

  select, input[type="text"] {
    font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.88rem; padding: 0.4rem 0.6rem;
    border: 2px solid #e4e1d5; border-radius: 6px; background: var(--white); color: var(--paper-ink);
  }
  input[type="text"] { width: 100%; }

  .rich-wrap { border: 2px solid #e4e1d5; border-radius: 8px; overflow: hidden; margin-bottom: 0.3rem; }
  .rich-toolbar { display: flex; gap: 0.3rem; padding: 0.3rem; background: var(--paper); border-bottom: 1px solid #e4e1d5; }
  .rich-toolbar button {
    font-family: 'JetBrains Mono', monospace; font-size: 0.76rem; border: 1px solid #e4e1d5; background: var(--white);
    border-radius: 4px; padding: 0.2rem 0.55rem; cursor: pointer;
  }
  .rich-toolbar button:hover { border-color: var(--blue); }
  .rich-editable { padding: 0.6rem 0.7rem; min-height: 2.2rem; font-size: 0.9rem; outline: none; }
  .rich-editable:focus { background: #fbfbf7; }

  .item-editor { border: 1px solid #e4e1d5; border-radius: 8px; padding: 1rem; margin: 0.8rem 0; background: var(--paper); }
  .item-editor-top { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.4rem; }
  .item-editor-top .item-title { flex: 1; font-weight: 700; }
  .item-delete, .item-add, .check-add {
    font-family: 'JetBrains Mono', monospace; font-size: 0.72rem; font-weight: 700; color: var(--blue-ink);
    background: none; border: 2px solid var(--blue-ink); border-radius: 6px; padding: 0.3rem 0.6rem; cursor: pointer;
  }
  .item-delete { color: #a8391b; border-color: #a8391b; }
  .item-add { margin-top: 0.6rem; }

  .checklist-editor { margin-top: 0.8rem; }
  .check-row { display: flex; align-items: center; gap: 0.5rem; margin: 0.3rem 0; }
  .check-row .check-text { flex: 1; }
  .check-remove { background: none; border: none; color: #a8391b; font-size: 1.1rem; cursor: pointer; }
  .check-add { margin-top: 0.4rem; }

  .signin-panel { border: 2px solid var(--oxford); border-radius: 10px; background: var(--white); padding: 1rem 1.2rem 1.2rem; margin-bottom: 1rem; }
  .signin-panel h2 { font-family: 'Fraunces', sans-serif; font-size: 1rem; margin: 0 0 0.4rem; color: var(--oxford); }
  .signin-panel textarea { width: 100%; min-height: 6rem; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.9rem; padding: 0.5rem 0.6rem; border: 2px solid #e4e1d5; border-radius: 6px; background: var(--white); color: var(--paper-ink); }
  .signin-actions { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-top: 0.7rem; }
  .signin-actions button { min-height: 44px; font-family: 'Fraunces', sans-serif; font-weight: 700; font-size: 0.85rem; padding: 0.5rem 1.1rem; border-radius: 8px; cursor: pointer; border: 2px solid var(--oxford); background: var(--white); color: var(--oxford); }
  .signin-actions button.primary { background: var(--blue); border-color: var(--blue); color: var(--white); }
  .signin-actions button:focus-visible, .signin-panel textarea:focus-visible { outline: 3px solid var(--blue); outline-offset: 2px; }
  .signin-status { font-family: 'JetBrains Mono', monospace; font-size: 0.78rem; color: var(--blue-ink); margin: 0.6rem 0 0; min-height: 1.2rem; white-space: pre-wrap; }

  .save-indicator {
    position: fixed; bottom: 1.2rem; right: 1.2rem; font-family: 'JetBrains Mono', monospace; font-size: 0.76rem;
    background: var(--oxford); color: var(--white); padding: 0.5rem 0.9rem; border-radius: 6px; opacity: 0; transition: opacity 0.2s ease;
  }
  .save-indicator.show { opacity: 1; }
</style>
</head>
<body>
  <header>
    <a class="back" href="/admin">&larr; All clients</a>
    <p class="kicker">Editing</p>
    <h1>${escapeHtml(client.name)}</h1>
    <p style="margin:0.6rem 0 0"><a class="back" href="/admin/${escapeHtml(client.slug)}/brief">Build this client's discovery brief &rarr;</a></p>
  </header>
  <main>
    <section class="signin-panel" data-section="signin">
      <h2>Sign-in</h2>
      <label class="field-label" for="signin-emails">Email addresses, one per line</label>
      <textarea id="signin-emails" rows="4" spellcheck="false" autocomplete="off">${escapeHtml(onFile.join('\n'))}</textarea>
      <div class="signin-actions">
        <button type="button" id="signin-save">Save emails</button>
        <button type="button" id="signin-invite" class="primary">Send invite</button>
      </div>
      <p class="signin-status" id="signin-status" aria-live="polite"></p>
    </section>
    ${sections}
  </main>
  <script>
  (function () {
    var slug = ${JSON.stringify(client.slug)};
    var clientName = ${JSON.stringify(client.name || client.slug)};
    var box = document.getElementById('signin-emails');
    var status = document.getElementById('signin-status');
    function say(text) { status.textContent = text; }
    function send(body) {
      return fetch('/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { return r.json(); });
    }
    document.getElementById('signin-save').addEventListener('click', function () {
      var list = box.value.split(/[\\n,;]+/).map(function (v) { return v.trim(); }).filter(Boolean);
      say('Saving...');
      send({ action: 'set-emails', slug: slug, emails: list })
        .then(function (r) {
          if (!r.ok) { say(r.error || 'That did not work.'); return; }
          box.value = r.emails.join('\\n');
          say('Saved ' + r.emails.length + (r.emails.length === 1 ? ' address.' : ' addresses.'));
        })
        .catch(function () { say('That did not work.'); });
    });
    document.getElementById('signin-invite').addEventListener('click', function () {
      if (!window.confirm('Send the portal invite to every address on file for ' + clientName + '?')) return;
      say('Sending...');
      send({ action: 'send-invite', slug: slug })
        .then(function (r) { say(r.message || r.error || 'That did not work.'); })
        .catch(function () { say('That did not work.'); });
    });
  })();
  </script>
  <div class="save-indicator" id="save-indicator">Saved</div>
  <script>
  (function () {
    var slug = ${JSON.stringify(client.slug)};

    function showSaved() {
      var el = document.getElementById('save-indicator');
      el.classList.add('show');
      clearTimeout(el._t);
      el._t = setTimeout(function () { el.classList.remove('show'); }, 1200);
    }

    function post(action, data) {
      return fetch('/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({ action: action, slug: slug }, data)),
      })
        .then(function (r) { return r.json(); })
        .then(function (r) { if (r.ok) showSaved(); return r; });
    }

    document.querySelectorAll('.project-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var expanded = btn.getAttribute('aria-expanded') === 'true';
        var body = btn.closest('.project-head-row').nextElementSibling;
        btn.setAttribute('aria-expanded', String(!expanded));
        if (expanded) { body.setAttribute('hidden', ''); } else { body.removeAttribute('hidden'); }
      });
    });

    document.querySelectorAll('.project-name-input').forEach(function (input) {
      input.addEventListener('blur', function () {
        var oldName = input.dataset.original;
        var newName = input.value.trim();
        if (!newName || newName === oldName) { input.value = oldName; return; }
        post('rename-project', { oldName: oldName, newName: newName }).then(function (r) {
          if (r.ok) { input.dataset.original = newName; } else { input.value = oldName; }
        });
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      });
    });

    // Rich text toolbars.
    document.querySelectorAll('.rich-wrap').forEach(function (wrap) {
      var editable = wrap.querySelector('.rich-editable');
      wrap.querySelectorAll('.rich-toolbar button').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var cmd = btn.dataset.cmd;
          editable.focus();
          if (cmd === 'createLink') {
            var url = prompt('Link URL:');
            if (url) document.execCommand(cmd, false, url);
          } else {
            document.execCommand(cmd, false, null);
          }
        });
      });
      editable.addEventListener('blur', function () {
        var cardId = wrap.dataset.card;
        var itemId = wrap.dataset.item;
        var field = wrap.dataset.field;
        var value = editable.innerHTML;
        if (itemId) {
          var data = {}; data[field] = value;
          post('update-item', { cardId: cardId, itemId: itemId, fields: data });
        } else {
          var data2 = {}; data2[field] = value;
          post('update-card', { cardId: cardId, fields: data2 });
        }
      });
    });

    // Plain text inputs (title, url).
    document.querySelectorAll('.item-editor').forEach(function (editor) {
      var cardId = editor.dataset.card;
      var itemId = editor.dataset.item;
      editor.querySelectorAll('input[data-field]').forEach(function (input) {
        input.addEventListener('blur', function () {
          var data = {}; data[input.dataset.field] = input.value;
          post('update-item', { cardId: cardId, itemId: itemId, fields: data });
        });
      });
      editor.querySelector('.item-delete').addEventListener('click', function () {
        if (!confirm('Delete this item?')) return;
        post('delete-item', { cardId: cardId, itemId: itemId }).then(function () { editor.remove(); });
      });
    });

    // Status selects (card-level and item-level).
    document.querySelectorAll('.status-select').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var cardId = sel.dataset.card;
        var itemId = sel.dataset.item;
        if (itemId) {
          post('update-item', { cardId: cardId, itemId: itemId, fields: { status: sel.value } });
        } else {
          post('update-card', { cardId: cardId, fields: { status: sel.value } });
        }
      });
    });

    // Card locked checkbox.
    document.querySelectorAll('.card-locked').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var cardId = cb.closest('.card-top-fields').dataset.card;
        post('update-card', { cardId: cardId, fields: { locked: cb.checked } });
      });
    });

    // Checklist editors.
    function wireChecklist(container) {
      var cardId = container.dataset.card;
      var itemId = container.dataset.item;
      function collect() {
        return Array.prototype.map.call(container.querySelectorAll('.check-row'), function (row) {
          return { text: row.querySelector('.check-text').value, done: row.querySelector('.check-done').checked };
        });
      }
      function save() { post('update-checklist', { cardId: cardId, itemId: itemId, checklist: collect() }); }
      container.querySelectorAll('.check-text').forEach(function (input) { input.addEventListener('blur', save); });
      container.querySelectorAll('.check-done').forEach(function (cb) { cb.addEventListener('change', save); });
      container.querySelectorAll('.check-remove').forEach(function (btn) {
        btn.addEventListener('click', function () { btn.closest('.check-row').remove(); save(); });
      });
      var addBtn = container.querySelector('.check-add');
      if (addBtn) {
        addBtn.addEventListener('click', function () {
          var row = document.createElement('div');
          row.className = 'check-row';
          row.innerHTML = '<input type="checkbox" class="check-done"><input type="text" class="check-text" value=""><button type="button" class="check-remove">&times;</button>';
          container.insertBefore(row, addBtn);
          row.querySelector('.check-text').addEventListener('blur', save);
          row.querySelector('.check-done').addEventListener('change', save);
          row.querySelector('.check-remove').addEventListener('click', function () { row.remove(); save(); });
          row.querySelector('.check-text').focus();
        });
      }
    }
    document.querySelectorAll('.checklist-editor').forEach(wireChecklist);

    // Add item.
    document.querySelectorAll('.item-add').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var title = prompt('New item title:');
        if (!title) return;
        post('add-item', { cardId: btn.dataset.card, type: 'link', title: title, description: '', url: null, content: null })
          .then(function () { location.reload(); });
      });
    });
  })();
  </script>
</body>
</html>`;
}

module.exports = { renderClientGrid, renderClientEditor };
