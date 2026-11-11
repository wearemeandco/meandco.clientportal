/* ============================================================
   Me&Co.: "Your files and links", presentation
   ------------------------------------------------------------
   Two pieces:

   renderFilesSection(client, rec, index)  the "Your files and links"
                                           section on the dashboard, same
                                           project/accordion shell as every
                                           other section
   renderFilesPage(client, rec, opts)      the page itself, at
                                           /portal/<slug>/files

   Built on theme.js, so it wears the same tokens as every other page.
   Content only: no branding file is touched. Rounded cards, no coloured
   side bars.

   Everything the client or the team typed is escaped on the way out.
   Links are only emitted when they are http(s).
   ============================================================ */

const { FONT_LINK, TOKENS, BASE } = require('./theme.js');
const { KINDS, MAX_FILE_BYTES, isVisible } = require('./files-store.js');

function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeUrl(u) {
  return typeof u === 'string' && /^https?:\/\/[^\s"'<>]+$/i.test(u) ? u : null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function longDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? Number(m[3]) + ' ' + MONTHS[Number(m[2]) - 1] + ' ' + m[1] : '';
}

function hostOf(u) {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
}

/* ---------- dashboard section ---------- */

function renderFilesSection(client, rec, index) {
  if (!isVisible(rec)) return '';
  const total = (rec.items || []).length;
  const href = '/portal/' + encodeURIComponent(client.slug) + '/files';
  const pill = total
    ? '<span class="pill pill-not_started">' + total + ' saved' + '</span>'
    : '<span class="pill pill-not_started">None yet</span>';
  const summary = total ? total + (total === 1 ? ' link or file in one place' : ' links and files in one place') : 'Nothing saved yet';
  const lead = total
    ? 'Your logos, photos, documents, forms and links, all in one place. Add anything new as you find it.'
    : 'A place for your logos, photos, documents and links. Add the first one whenever you like.';
  return `
      <section class="project" data-index="${index}" id="files-section">
        <button class="project-head" type="button" aria-expanded="false">
          <span class="project-head-main">
            <span class="project-name">Your files and links</span>
            <span class="project-summary">${summary}</span>
          </span>
          ${pill}
          <span class="chev" aria-hidden="true">&#9662;</span>
        </button>
        <div class="project-body" hidden>
          <div class="card-acc">
            <div class="card-acc-body" style="display:block;padding-top:1rem">
              <div class="row-desc"><p>${esc(lead)}</p></div>
              <a class="btn btn-primary btn-block" href="${href}">Open your files and links</a>
              <a class="btn btn-quiet btn-block" href="${href}#add">Add a link or file</a>
            </div>
          </div>
        </div>
      </section>`;
}

/* ---------- page ---------- */

function itemHtml(item, slug) {
  const url = safeUrl(item.url);
  const hasFile = item.file && /^fl-[a-f0-9]{24}$/.test(item.file.fileId || '');
  const fileHref = hasFile ? '/portal/' + encodeURIComponent(slug) + '/file/' + item.file.fileId : null;
  const href = url || fileHref;
  const isImage = hasFile && /^image\//.test(item.file.mimeType || '');
  const mine = item.by === 'client';
  const sub = url ? hostOf(url) : hasFile ? (item.file.mimeType === 'application/pdf' ? 'PDF' : 'Image') + ' you added' : '';
  const credit = [item.from ? (item.by === 'site' ? item.from : 'Added by ' + item.from) : '', longDate(item.date)].filter(Boolean).join(' · ');
  const title = href
    ? `<a class="it-link" href="${esc(href)}" target="_blank" rel="noopener">${esc(item.title)}</a>`
    : `<span class="it-link">${esc(item.title)}</span>`;
  return `<li class="it" data-id="${esc(item.id)}">
      ${isImage ? `<a class="thumb" href="${esc(fileHref)}" target="_blank" rel="noopener"><img src="${esc(fileHref)}" alt="" loading="lazy"></a>` : ''}
      <div class="it-main">
        <p class="it-t">${title}</p>
        ${sub ? `<p class="it-sub">${esc(sub)}</p>` : ''}
        ${item.note ? `<p class="it-note">${esc(item.note)}</p>` : ''}
        <p class="it-meta">${esc(credit)}</p>
      </div>
      ${mine ? `<div class="it-act"><button type="button" class="mini" data-remove="${esc(item.id)}">Remove</button></div>` : ''}
    </li>`;
}

function renderFilesPage(client, rec, opts) {
  const slug = client.slug;
  const items = (rec.items || []).slice();
  const groups = KINDS.map((k) => ({ k, rows: items.filter((i) => i.kind === k.key) })).filter((g) => g.rows.length);
  const known = new Set(KINDS.map((k) => k.key));
  const stray = items.filter((i) => !known.has(i.kind));
  if (stray.length) groups.push({ k: { key: 'other', label: 'Other' }, rows: stray });
  const merged = [];
  groups.forEach((g) => {
    const ex = merged.find((m) => m.k.key === g.k.key);
    if (ex) ex.rows = ex.rows.concat(g.rows); else merged.push(g);
  });
  const sections = merged.map((g) => `<section class="grp" aria-labelledby="g-${g.k.key}">
      <h2 id="g-${g.k.key}">${esc(g.k.label)} <span class="n">${g.rows.length}</span></h2>
      <ul class="its">${g.rows.map((i) => itemHtml(i, slug)).join('')}</ul>
    </section>`).join('');
  const empty = `<div class="panel empty-panel"><h2>Nothing here yet</h2><p>Add a link or a file and it will show up here, sorted by kind.</p></div>`;
  const banner = opts && opts.banner ? `<div class="banner-msg" role="status">${esc(opts.banner)}</div>` : '';
  const kindOptions = KINDS.map((k) => `<option value="${k.key}">${esc(k.label)}</option>`).join('');
  const labels = {};
  KINDS.forEach((k) => { labels[k.key] = k.label; });
  const boot = JSON.stringify({ slug, clientName: client.name || '', maxBytes: MAX_FILE_BYTES, labels }).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>Your files and links &middot; ${esc(client.name)} &middot; Me&Co.</title>
${FONT_LINK}
<style>
${TOKENS}
${BASE}
  header { background: var(--white); border-bottom: var(--rule-strong); padding: clamp(1.1rem, 4vw, 1.8rem) clamp(1.1rem, 5vw, 2.2rem) clamp(1.2rem, 4vw, 1.6rem); }
  .header-inner { max-width: calc(60rem - 2 * clamp(1.1rem, 5vw, 2.2rem)); margin: 0 auto; }
  .back { display: inline-flex; align-items: center; gap: 0.35rem; min-height: 44px; font-family: var(--display); font-size: 0.95rem; font-weight: 700; color: var(--oxford); text-decoration: none; }
  .back:hover { text-decoration: underline; }
  h1 { font-weight: 800; font-size: clamp(1.45rem, 5.5vw, 1.95rem); margin: 0.4rem 0 0; letter-spacing: -0.015em; line-height: 1.15; }
  .lede { color: var(--ink-soft); margin: 0.5rem 0 0; max-width: 40rem; font-size: 0.95rem; }
  main { max-width: 60rem; margin: 0 auto; padding: clamp(1.2rem, 4vw, 2rem) clamp(1.1rem, 5vw, 2.2rem) 4rem; }
  .panel { background: var(--white); border: var(--rule); border-radius: var(--radius); box-shadow: var(--shadow-hard); padding: clamp(1.1rem, 5vw, 1.8rem); margin-bottom: 1.5rem; }
  .panel h2 { margin: 0; font-size: clamp(1.15rem, 4.5vw, 1.4rem); }
  .intro { background: var(--lime); border: var(--rule); border-radius: var(--radius); padding: 1rem 1.2rem; margin-bottom: 1.5rem; font-size: 1rem; color: var(--oxford); }
  .intro p { margin: 0; }
  .banner-msg { background: var(--green-bg); border: 1.5px solid var(--green); color: var(--green); border-radius: var(--radius-sm); padding: 0.8rem 1rem; margin-bottom: 1.2rem; font-weight: 500; }
  .add-row { display: flex; gap: 0.8rem; align-items: center; flex-wrap: wrap; margin-bottom: 1.6rem; }
  .add-row p { margin: 0; color: var(--ink-soft); font-size: 0.92rem; flex: 1 1 14rem; }
  .grp { margin-bottom: 1.8rem; }
  .grp h2 { font-size: clamp(1.1rem, 4.2vw, 1.3rem); margin: 0 0 0.7rem; display: flex; align-items: baseline; gap: 0.6rem; }
  .grp h2 .n { font-family: var(--mono); font-size: 0.74rem; font-weight: 700; color: var(--ink-faint); }
  .its { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.7rem; }
  .it { display: flex; gap: 0.9rem; align-items: flex-start; background: var(--white); border: var(--rule-soft); border-radius: var(--radius-sm); padding: 0.9rem 1rem; min-width: 0; }
  .it-main { flex: 1 1 auto; min-width: 0; }
  .it-t { margin: 0; font-size: 1rem; line-height: 1.4; overflow-wrap: anywhere; }
  .it-link { font-family: var(--display); font-weight: 700; color: var(--oxford); text-decoration-thickness: 1.5px; text-underline-offset: 3px; }
  a.it-link:hover { color: var(--blue-ink); }
  .it-sub { margin: 0.1rem 0 0; font-family: var(--mono); font-size: 0.72rem; color: var(--ink-faint); overflow-wrap: anywhere; }
  .it-note { margin: 0.35rem 0 0; font-size: 0.88rem; color: var(--ink-soft); }
  .it-meta { margin: 0.45rem 0 0; font-family: var(--mono); font-size: 0.68rem; color: var(--ink-faint); }
  .it-act { flex: none; }
  .thumb { flex: none; }
  .thumb img { display: block; width: 4.2rem; height: 4.2rem; object-fit: cover; border-radius: 10px; border: var(--rule-soft); }
  .mini { font-family: var(--display); font-weight: 700; font-size: 0.85rem; min-height: 44px; padding: 0.4rem 0.9rem; border-radius: var(--radius-btn); border: var(--rule); background: var(--white); color: var(--oxford); cursor: pointer; }
  .mini-yes { background: var(--green-bg); border-color: var(--green); color: var(--green); }
  .sure { display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
  .sure span { font-size: 0.84rem; color: var(--ink-soft); }
  form { display: grid; gap: 0.9rem; margin-top: 1rem; }
  label { font-family: var(--mono); font-size: 0.7rem; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; display: block; margin-bottom: 0.3rem; }
  input, textarea, select { font: inherit; font-size: 16px; color: var(--ink); background: var(--paper); border: var(--rule-soft); border-radius: var(--radius-sm); padding: 0.7rem 0.8rem; width: 100%; }
  input:focus, textarea:focus, select:focus { border-color: var(--oxford); background: var(--white); outline: none; }
  textarea { min-height: 4.5rem; resize: vertical; }
  .hint { font-size: 0.82rem; color: var(--ink-soft); margin: 0.3rem 0 0; }
  .how { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; border: 0; padding: 0; margin: 0; }
  .how legend { font-family: var(--mono); font-size: 0.7rem; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; padding: 0; margin-bottom: 0.4rem; }
  .how label.opt { display: flex; align-items: center; gap: 0.6rem; min-height: 48px; margin: 0; padding: 0.4rem 0.8rem; border: var(--rule-soft); border-radius: var(--radius-sm); background: var(--white); font-family: var(--display); font-size: 0.95rem; font-weight: 700; letter-spacing: 0; text-transform: none; cursor: pointer; }
  .how label.opt:has(input:checked) { border: var(--rule); background: var(--lime); }
  .how input { width: 20px; height: 20px; padding: 0; margin: 0; }
  .primary-btn { font-family: var(--display); font-weight: 700; font-size: 0.95rem; color: var(--white); background: var(--oxford); border: var(--rule-strong); border-radius: var(--radius-btn); min-height: 48px; padding: 0.75rem 1.5rem; cursor: pointer; box-shadow: var(--shadow-hard); }
  .primary-btn:disabled { opacity: 0.6; cursor: default; }
  .err { background: #FBEDE7; border: 1.5px solid #E8B7A2; color: #8f3517; border-radius: var(--radius-sm); padding: 0.7rem 0.9rem; font-size: 0.92rem; }
  .err[hidden], [hidden] { display: none; }
  dialog.svc { border: var(--rule-strong); border-radius: var(--radius); box-shadow: var(--shadow-hard-lg); padding: 1.1rem clamp(1rem, 4vw, 1.6rem) 1.4rem; width: min(36rem, calc(100% - 1.5rem)); max-height: calc(100vh - 1.5rem); max-height: calc(100dvh - 1.5rem); overflow-y: auto; background: var(--white); color: var(--ink); }
  dialog.svc::backdrop { background: rgba(10, 35, 66, 0.55); }
  .svc-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.6rem; }
  .svc-head h2 { margin: 0; font-size: clamp(1.15rem, 4.5vw, 1.4rem); }
  .svc-x { font-size: 1.6rem; line-height: 1; min-width: 44px; min-height: 44px; border: var(--rule); border-radius: var(--radius-btn); background: var(--white); color: var(--oxford); cursor: pointer; }
  .svc-actions { display: flex; gap: 0.6rem; flex-wrap: wrap; justify-content: space-between; align-items: center; }
  .foot { font-size: 0.85rem; color: var(--ink-faint); margin-top: 1.2rem; }
  @media (max-width: 600px) { .it { flex-wrap: wrap; } .it-act { width: 100%; } .it-act .mini { width: 100%; } .sure { justify-content: flex-start; } }
</style>
</head>
<body>
<header><div class="header-inner">
  <div class="mark"><span class="dot"></span>Me&Co.</div>
  <a class="back" href="/portal/${esc(encodeURIComponent(slug))}">&larr; Back to your portal</a>
  <h1>Your files and links</h1>
  <p class="lede">Your logos, photos, documents, forms and links, all in one place. Open anything in a new tab, and add new ones whenever you find them.</p>
</div></header>
<main>
  ${banner}
  ${rec.intro ? `<div class="intro"><p>${esc(rec.intro)}</p></div>` : ''}
  <div class="add-row">
    <button type="button" class="primary-btn" id="open-add">Add a link or file</button>
    <p>You can remove anything you add yourself. If you would like something we added taken off, email us.</p>
  </div>
  ${merged.length ? sections : empty}
  <p class="foot">Files you add are private to your portal. Only you and Me&Co. can open them.</p>

  <dialog class="svc" id="dlg-add" aria-labelledby="dlg-add-h">
    <div class="svc-head"><h2 id="dlg-add-h">Add a link or file</h2><button type="button" class="svc-x" data-close aria-label="Close">&times;</button></div>
    <form id="add-form" novalidate>
      <div><label for="f-title">Name</label><input id="f-title" name="title" maxlength="140" placeholder="Spring newsletter" autocomplete="off"></div>
      <div><label for="f-kind">What kind is it?</label><select id="f-kind" name="kind"><option value="">Choose one</option>${kindOptions}</select></div>
      <fieldset class="how"><legend>What are you adding?</legend>
        <label class="opt"><input type="radio" name="how" value="link" checked> A link</label>
        <label class="opt"><input type="radio" name="how" value="file"> A file</label>
      </fieldset>
      <div id="w-link"><label for="f-url">Link</label><input id="f-url" name="url" type="text" inputmode="url" maxlength="800" placeholder="https://" autocomplete="off"></div>
      <div id="w-file" hidden><label for="f-file">File</label><input id="f-file" name="file" type="file" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf">
        <p class="hint">An image (PNG, JPG, WebP or GIF) or a PDF, up to 4 MB. Big photos are shrunk before they are sent. For anything larger, add a link to it instead.</p></div>
      <div><label for="f-note">A note (optional)</label><textarea id="f-note" name="note" maxlength="500" placeholder="Anything we should know about it"></textarea></div>
      <div class="err" role="alert" hidden></div>
      <div class="svc-actions"><button type="button" class="mini" data-close>Cancel</button><button class="primary-btn" type="submit">Add it</button></div>
    </form>
  </dialog>
</main>
<script>
(function () {
  var BOOT = ${boot};
  var FORM_ACTION = '/forms/client-request.html';
  var PORTAL = '/.netlify/functions/portal?slug=' + encodeURIComponent(BOOT.slug);
  var PAGE_URL = 'https://clients.weareme.co/portal/' + encodeURIComponent(BOOT.slug) + '/files';

  function postPortal(body) {
    return fetch(PORTAL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (j) {
          if (!res.ok || !j.ok) { var e = new Error((j && j.error) || 'That did not save. Please try again in a moment.'); e.status = res.status; throw e; }
          return j;
        });
      });
  }
  function done(msg) { location.href = location.pathname + '?msg=' + encodeURIComponent(msg); }
  function notify(fields, file) {
    var fd = new FormData();
    fd.append('form-name', 'client-request');
    fd.append('client', BOOT.clientName); fd.append('slug', BOOT.slug); fd.append('board', PAGE_URL);
    Object.keys(fields).forEach(function (k) { fd.append(k, fields[k] == null ? '' : fields[k]); });
    if (file) fd.append('attachment', file, file.name);
    return fetch(FORM_ACTION, { method: 'POST', body: fd }).then(function (r) { if (!r.ok) throw new Error('notify ' + r.status); });
  }

  // Big images are shrunk in the browser first so a phone photo still fits.
  function prepare(file) {
    return new Promise(function (resolve, reject) {
      if (!file) return resolve(null);
      var isPdf = file.type === 'application/pdf';
      if (!isPdf && !/^image\\/(png|jpeg|webp|gif)$/.test(file.type)) return reject(new Error('Please add a PNG, JPG, WebP or GIF image, or a PDF.'));
      if (isPdf || file.size <= 1.5 * 1024 * 1024) {
        if (file.size > BOOT.maxBytes) return reject(new Error('That file is over 4 MB. Please choose a smaller one, or add a link to it instead.'));
        return resolve(file);
      }
      var img = new Image(); var url = URL.createObjectURL(file);
      img.onload = function () {
        var s = Math.min(1, 2400 / Math.max(img.width, img.height));
        var cv = document.createElement('canvas'); cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        cv.toBlob(function (b) {
          URL.revokeObjectURL(url);
          if (!b || b.size > BOOT.maxBytes) return reject(new Error('That image is over 4 MB. Please choose a smaller one, or add a link to it instead.'));
          resolve(new File([b], file.name.replace(/\\.[a-z0-9]+$/i, '') + '.jpg', { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('We could not read that image. Try a PNG or JPG.')); };
      img.src = url;
    });
  }
  function toBase64(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(',')[1] || ''); };
      r.onerror = function () { reject(new Error('We could not read that file.')); };
      r.readAsDataURL(file);
    });
  }

  var dlg = document.getElementById('dlg-add');
  function openDialog() { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); }
  function closeDialog() { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); }
  document.getElementById('open-add').addEventListener('click', openDialog);
  dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target.closest('[data-close]')) closeDialog(); });
  if (location.hash === '#add') openDialog();

  var form = document.getElementById('add-form');
  var wLink = document.getElementById('w-link'), wFile = document.getElementById('w-file');
  form.querySelectorAll('input[name=how]').forEach(function (r) {
    r.addEventListener('change', function () {
      var file = form.elements.how.value === 'file';
      wLink.hidden = file; wFile.hidden = !file;
    });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var box = form.querySelector('.err'), btn = form.querySelector('button[type=submit]'), label = btn.textContent;
    function fail(m) { box.textContent = m; box.hidden = false; }
    box.hidden = true;
    var how = form.elements.how.value;
    var title = form.elements.title.value.trim(), kind = form.elements.kind.value, url = form.elements.url.value.trim(), note = form.elements.note.value.trim();
    var chosen = form.elements.file.files[0] || null;
    if (!title) return fail('Give it a short name so you can find it later.');
    if (!kind) return fail('Choose what kind of thing this is.');
    if (how === 'link' && !url) return fail('Paste the link first.');
    if (how === 'file' && !chosen) return fail('Choose the file to add.');
    btn.disabled = true; btn.textContent = 'Adding...';
    var prepared = null, itemId = null;
    var work = how === 'file' ? prepare(chosen) : Promise.resolve(null);
    work.then(function (p) {
      prepared = p;
      return p ? toBase64(p) : null;
    }).then(function (b64) {
      var body = { action: 'files-add', title: title, kind: kind, note: note };
      if (how === 'link') body.url = url; else body.upload = { name: prepared.name, data: b64 };
      return postPortal(body);
    }).then(function (res) {
      itemId = res.item.id;
      var fields = { kind: 'file', requestId: itemId, page: BOOT.labels[kind] || kind, request: title, link: how === 'link' ? (res.item.url || url) : '', note: note, fileKind: BOOT.labels[kind] || kind, fileName: prepared ? prepared.name : '' };
      var attach = prepared && prepared.size <= 3 * 1024 * 1024 ? prepared : null;
      return notify(fields, attach);
    }).then(function () { done('Added. It is on your list now.'); },
            function (ex) {
      if (itemId) return done('Added. It is on your list now.');
      btn.disabled = false; btn.textContent = label;
      fail(ex && ex.status === 401 ? 'Your session expired. Open your portal link again, then add this.' : (ex && ex.message) || 'That did not save. Please try again.');
    });
  });

  // Removing something you added: ask once, then remove.
  document.addEventListener('click', function (e) {
    var rm = e.target.closest('[data-remove]');
    var no = e.target.closest('[data-keep]');
    var yes = e.target.closest('[data-really]');
    if (rm) {
      var act = rm.closest('.it-act');
      act.dataset.before = act.innerHTML;
      act.innerHTML = '<div class="sure"><span>Remove this?</span><button type="button" class="mini mini-yes" data-really="' + rm.dataset.remove + '">Yes, remove</button><button type="button" class="mini" data-keep>Keep it</button></div>';
      return;
    }
    if (no) { var a = no.closest('.it-act'); a.innerHTML = a.dataset.before; return; }
    if (yes) {
      yes.disabled = true; yes.textContent = 'Removing...';
      postPortal({ action: 'files-remove', id: yes.dataset.really }).then(function () { done('Removed.'); }, function (ex) {
        var a2 = yes.closest('.it-act'); a2.innerHTML = a2.dataset.before;
        alert(ex && ex.status === 401 ? 'Your session expired. Open your portal link again.' : (ex && ex.message) || 'That did not remove. Please try again.');
      });
    }
  });
})();
</script>
</body>
</html>`;
}

module.exports = { renderFilesSection, renderFilesPage };
