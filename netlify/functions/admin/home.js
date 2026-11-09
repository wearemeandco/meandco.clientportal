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

function renderAdminHome(clients, data) {
  const slugs = Object.keys(clients);
  const cards = slugs.map((slug) => cardHtml(slug, clients[slug], summarize((data[slug] || {}).state, (data[slug] || {}).requests))).join('');
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
  </header>
  <section class="ad-grid">
    ${cards}
    <form class="ac-add" id="addClient">
      <b>+ Add a business</b>
      <input name="name" placeholder="The business name" required>
      <input name="email" type="email" placeholder="Their email" required>
      <button type="submit">Create their portal</button>
      <p class="ac-note" id="addNote" aria-live="polite"></p>
    </form>
  </section>
</main>
<nav class="ab-dock" aria-label="Your tabs"><a class="on" href="/admin" aria-current="page"><span aria-hidden="true">👥</span>Businesses</a><a href="/admin/workflow"><span aria-hidden="true">⚙️</span>Settings</a><a href="/admin/inquiries"><span aria-hidden="true">📥</span>Inquiries</a></nav>
<script>
document.getElementById('addClient').addEventListener('submit', function (e) {
  e.preventDefault();
  var f = e.target, note = document.getElementById('addNote');
  var name = f.name.value.trim(), email = f.email.value.trim();
  note.textContent = 'Creating...';
  function post(b) { return fetch('/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(function (r) { return r.json(); }); }
  post({ action: 'create-client', slug: name, name: name }).then(function (r) {
    if (!r.ok) throw new Error(r.error || 'That did not work.');
    var slug = r.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '');
    return post({ action: 'set-emails', slug: slug, emails: [email] }).then(function () { note.textContent = 'Created. Opening their portal...'; setTimeout(function () { location.href = '/portal/' + slug; }, 700); });
  }).catch(function (ex) { note.textContent = ex.message; });
});
</script>
</body></html>`;
}

module.exports = { renderAdminHome, summarize };
