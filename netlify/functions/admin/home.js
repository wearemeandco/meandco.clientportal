/* Melody's admin home: every business as a card, and one card to add a new
   business. Tapping a card opens that client's own portal, exactly as they see
   it, with the admin bar on top. Same theme as the portal. */
const { FONT_LINK, TOKENS, BASE } = require('../portal/theme.js');
const { clientNeed } = require('../portal/dashboard.js');

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function summarize(state, requests) {
  const cards = ((state && state.cards) || []).filter((c) => c && c.label);
  const done = cards.filter((c) => c.status === 'complete').length;
  const now = cards.find((c) => c.status === 'in_progress') || cards.find((c) => c.status !== 'complete' && !c.locked) || null;
  const waitingCards = cards.filter(clientNeed).length;
  const waitingRows = ((requests && requests.items) || []).filter((i) => i.status === 'needs').length;
  const ours = ((requests && requests.items) || []).filter((i) => i.status === 'received' || i.status === 'in_progress').length;
  return { total: cards.length, done, stage: now ? now.label : (cards.length && done === cards.length ? 'All done' : 'Not started'), waiting: waitingCards + waitingRows, ours };
}

function cardHtml(slug, client, s) {
  const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
  const state = s.waiting ? `<span class="ac-chip wait">🙋 ${s.waiting} waiting on them</span>` : `<span class="ac-chip ok">✓ nothing waiting on them</span>`;
  const ours = s.ours ? `<span class="ac-chip us">🛠 ${s.ours} with us</span>` : '';
  return `<a class="ac-card" href="/portal/${esc(slug)}">
    <span class="ac-dot" aria-hidden="true"></span>
    <b class="ac-name">${esc(client.name)}</b>
    <span class="ac-stage">${esc(s.stage)}</span>
    <span class="ac-bar" aria-label="${s.done} of ${s.total} steps done"><i style="width:${pct}%"></i></span>
    <span class="ac-count">${s.done} of ${s.total} steps done</span>
    <span class="ac-chips">${state}${ours}</span>
  </a>`;
}

function renderAdminHome(allClients, data) {
  const archivedCount = Object.keys(allClients).filter((slug) => allClients[slug].archived).length;
  const clients = {};
  Object.keys(allClients).forEach((slug) => { if (!allClients[slug].archived) clients[slug] = allClients[slug]; });
  const slugs = Object.keys(clients);
  const cards = slugs.map((slug) => cardHtml(slug, clients[slug], summarize((data[slug] || {}).state, (data[slug] || {}).requests))).join('');
  const calendarOn = !!require('../portal/client-mail.js').bookingUrl();
  const needing = slugs.filter((slug) => summarize((data[slug] || {}).state, (data[slug] || {}).requests).waiting).length;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">
<title>Your businesses · Me&amp;Co.</title>
${FONT_LINK}
<style>
${TOKENS}
${BASE}
.ad{max-width:1060px;margin:0 auto;padding:28px max(16px,env(safe-area-inset-left,0px)) 60px;display:grid;gap:22px}
.ad-head{display:flex;flex-wrap:wrap;gap:12px;align-items:end;justify-content:space-between}
.ad-head h1{margin:0;font-size:clamp(30px,6vw,42px);line-height:1.05}
.ad-head p{margin:4px 0 0;color:var(--ink-soft)}
.ad-links{display:flex;gap:14px;font-size:14px;font-weight:600}
.ad-grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(250px,1fr))}
.ac-card{display:grid;gap:8px;align-content:start;padding:20px;border-radius:var(--radius);background:var(--white);border:var(--rule);box-shadow:var(--shadow-hard);color:var(--ink);text-decoration:none;position:relative;transition:transform .2s var(--ease-spring),box-shadow .2s var(--ease-spring)}
.ac-card:hover{transform:translateY(-3px);box-shadow:var(--shadow-hard-lg)}
.ac-dot{position:absolute;top:18px;right:18px;width:12px;height:12px;border-radius:50%;background:var(--lime);border:1.5px solid var(--oxford)}
.ac-name{font-family:var(--display);font-size:21px;line-height:1.15;padding-right:20px}
.ac-stage{font-family:var(--mono);font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-soft)}
.ac-bar{height:10px;border-radius:99px;background:var(--panel);border:1px solid var(--panel-2);overflow:hidden}
.ac-bar i{display:block;height:100%;background:var(--oxford);border-radius:99px}
.ac-count{font-size:13px;color:var(--ink-faint)}
.ac-chips{display:flex;flex-wrap:wrap;gap:6px}
.ac-chip{font-size:12.5px;font-weight:700;padding:3px 9px;border-radius:var(--radius-pill)}
.ac-chip.wait{background:var(--lime);color:var(--oxford)}
.ac-chip.ok{background:var(--green-bg);color:var(--green)}
.ac-chip.us{background:var(--lavender);color:var(--oxford)}
.ac-add{display:grid;gap:10px;align-content:start;padding:20px;border-radius:var(--radius);border:2px dashed var(--oxford);background:var(--paper)}
.ac-add b{font-family:var(--display);font-size:21px}
.ac-add input{width:100%;min-height:46px;padding:10px 12px;border:var(--rule);border-radius:var(--radius-btn);font:inherit;background:var(--white)}
.ac-add button{min-height:48px;border-radius:var(--radius-btn);border:var(--rule);background:var(--oxford);color:var(--white);font:700 16px var(--display);cursor:pointer;box-shadow:var(--shadow-hard)}
.ac-opts{display:grid;gap:6px;margin:0;padding:10px 12px;border:1px solid var(--panel-2);border-radius:var(--radius-btn);background:var(--white)}
.ac-opts legend{font-size:13px;font-weight:700;padding:0 4px;color:var(--ink-soft)}
.ac-opts label{display:flex;gap:8px;align-items:flex-start;font-size:14px;line-height:1.35}
.ac-opts input{width:auto;min-height:0;margin-top:3px}
.ac-opts label.off{opacity:.5}
.ac-add .ac-sends{margin:0;font-size:14px;font-weight:700;color:var(--oxford)}
.ac-add .ac-note{font-size:13.5px;color:var(--ink-soft);min-height:1em}
body{padding-bottom:110px}
.ab-dock{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:60;display:flex;gap:4px;padding:6px;border-radius:18px;background:var(--white);border:var(--rule);box-shadow:var(--shadow-hard-lg);width:min(400px,calc(100% - 24px))}
.ab-dock a{flex:1;display:grid;justify-items:center;gap:2px;padding:8px 4px;border-radius:12px;color:var(--oxford);font:700 12.5px var(--sans);text-decoration:none}
.ab-dock span{font-size:20px;line-height:1}
.ab-dock .on{background:var(--lime);box-shadow:inset 0 0 0 1.5px var(--oxford)}
</style></head><body>
<main class="ad">
  <header class="ad-head">
    <div><h1>Your businesses</h1><p>${slugs.length} ${slugs.length === 1 ? 'business' : 'businesses'}${needing ? ' · ' + needing + ' waiting on something from them' : ''}. Tap one to see their portal and everything in it.</p></div>
    ${archivedCount ? `<div class="ad-links"><a href="/admin/archived">Archived (${archivedCount})</a></div>` : ''}
  </header>
  <section class="ad-grid">
    ${cards}
    <form class="ac-add" id="addClient">
      <b>+ Add a business</b>
      <input name="name" placeholder="The business name" required>
      <input name="email" type="email" placeholder="Their email" required>
      <fieldset class="ac-opts">
        <legend>What happens when you create</legend>
        <label><input type="checkbox" name="createPortal" checked> Create their portal</label>
        <label><input type="checkbox" name="locked"> Locked portal (shows "being set up" until you unlock it)</label>
        <label><input type="checkbox" name="sendInvite"> Send the welcome invite</label>
        <label><input type="checkbox" name="sendBrief"> Send the brief</label>
        ${calendarOn ? '<label><input type="checkbox" name="sendCalendar"> Calendar invite</label>' : ''}
      </fieldset>
      <p class="ac-sends" id="addSends" aria-live="polite">This sends no email.</p>
      <button type="submit">Create</button>
      <p class="ac-note" id="addNote" aria-live="polite"></p>
    </form>
  </section>
</main>
<nav class="ab-dock" aria-label="Your tabs"><a class="on" href="/admin" aria-current="page"><span aria-hidden="true">👥</span>Businesses</a><a href="/admin/everly"><span aria-hidden="true">🤖</span>Everly</a><a href="/admin/workflow"><span aria-hidden="true">⚙️</span>Settings</a><a href="/admin/inquiries"><span aria-hidden="true">📥</span>Inquiries</a></nav>
<script>
(function () {
  var form = document.getElementById('addClient');
  var sends = document.getElementById('addSends');
  var note = document.getElementById('addNote');
  function box(n) { return form.elements[n]; }
  function refresh() {
    var portal = box('createPortal').checked;
    ['locked', 'sendInvite', 'sendBrief'].forEach(function (n) {
      box(n).disabled = !portal;
      if (!portal) box(n).checked = false;
      box(n).parentNode.className = portal ? '' : 'off';
    });
    var list = [];
    if (box('sendInvite').checked) list.push('invite');
    if (box('sendBrief').checked) list.push('brief');
    if (box('sendCalendar') && box('sendCalendar').checked) list.push('calendar invite');
    sends.textContent = list.length ? 'This sends: ' + list.join(', ') : 'This sends no email.';
  }
  form.addEventListener('change', refresh);
  refresh();
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = form.name.value.trim(), email = form.email.value.trim();
    var submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    note.textContent = 'Creating...';
    fetch('/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      action: 'create-client', slug: name, name: name, email: email,
      createPortal: box('createPortal').checked, locked: box('locked').checked,
      sendInvite: box('sendInvite').checked, sendBrief: box('sendBrief').checked,
      sendCalendar: !!(box('sendCalendar') && box('sendCalendar').checked)
    }) }).then(function (r) { return r.json(); }).then(function (r) {
      if (!r.ok) throw new Error(r.error || 'That did not work.');
      note.textContent = r.message + ' Opening...';
      setTimeout(function () { location.href = box('createPortal').checked ? '/portal/' + r.slug : '/admin/' + r.slug + '/edit'; }, 1200);
    }).catch(function (ex) { note.textContent = ex.message; submit.disabled = false; });
  });
})();
</script>
</body></html>`;
}

/* The archived businesses, each with Unarchive and a link to the Edit page,
   where an archived client can be deleted for good. */
function renderArchivedList(clients) {
  const slugs = Object.keys(clients).filter((slug) => clients[slug].archived);
  const rows = slugs.map((slug) => {
    const c = clients[slug];
    const when = c.archivedAt ? new Date(c.archivedAt).toISOString().slice(0, 10) : '';
    return `<li class="ar-row" data-slug="${esc(slug)}">
      <div><b class="ar-name">${esc(c.name)}</b><span class="ar-meta">${when ? 'Archived ' + esc(when) : 'Archived'}</span></div>
      <div class="ar-acts"><button type="button" class="ar-unarchive" data-slug="${esc(slug)}">Unarchive</button><a href="/admin/${esc(slug)}/edit">Edit page</a></div>
    </li>`;
  }).join('');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">
<title>Archived businesses · Me&amp;Co.</title>
${FONT_LINK}
<style>
${TOKENS}
${BASE}
.ad{max-width:760px;margin:0 auto;padding:28px max(16px,env(safe-area-inset-left,0px)) 60px;display:grid;gap:18px}
.ad h1{margin:0;font-size:clamp(28px,6vw,38px);line-height:1.05}
.ad p{margin:4px 0 0;color:var(--ink-soft)}
.ar-list{list-style:none;margin:0;padding:0;display:grid;gap:12px}
.ar-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;padding:16px;border-radius:var(--radius);background:var(--white);border:var(--rule)}
.ar-name{display:block;font-family:var(--display);font-size:19px}
.ar-meta{font-size:13px;color:var(--ink-faint)}
.ar-acts{display:flex;gap:12px;align-items:center;font-weight:600}
.ar-acts button{min-height:44px;padding:0 16px;border-radius:var(--radius-btn);border:var(--rule);background:var(--white);color:var(--oxford);font:700 14.5px var(--display);cursor:pointer}
.ar-note{min-height:1em;font-size:14px;color:var(--ink-soft)}
</style></head><body>
<main class="ad">
  <header><a href="/admin">&larr; All businesses</a><h1>Archived businesses</h1><p>${slugs.length ? 'Their portals are closed. Nothing was removed, and Unarchive opens a portal again.' : 'No archived businesses.'}</p></header>
  <ul class="ar-list">${rows}</ul>
  <p class="ar-note" id="arNote" aria-live="polite"></p>
</main>
<script>
document.querySelectorAll('.ar-unarchive').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var note = document.getElementById('arNote');
    note.textContent = 'Unarchiving...';
    fetch('/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'unarchive-client', slug: btn.getAttribute('data-slug') }) })
      .then(function (r) { return r.json(); })
      .then(function (r) {
        if (!r.ok) { note.textContent = r.error || 'That did not work.'; return; }
        var row = btn.closest('.ar-row'); row.parentNode.removeChild(row);
        note.textContent = r.message;
      })
      .catch(function () { note.textContent = 'That did not work.'; });
  });
});
</script>
</body></html>`;
}

module.exports = { renderAdminHome, renderArchivedList, summarize };
