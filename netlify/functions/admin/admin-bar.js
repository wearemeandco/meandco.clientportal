/* The admin bar Melody sees on top of a business's portal when she opens it
   from her admin. Everything under it is the client's own page, unchanged.
   The tiles are fixed templates: the template decides who gets the work
   (Everly, or Ida through Everly), and the boxes carry what is needed. The
   client never sees it. */

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* Template id -> who it goes to, and its boxes. Fixed: no AI chooses. */
const ASK_TEMPLATES = [
  { id: 'feature', icon: '✨', label: 'Add a feature', to: 'ida', fields: [
    { k: 'what', label: 'What do they need a way to do?', ph: 'My client needs a way to add images to their folders', area: true },
    { k: 'who', label: 'Who does it once it is built?', ph: 'The client, me, Everly, or it runs on its own' },
    { k: 'tool', label: 'Any tool it should use?', ph: 'Canva, Google Drive, Stripe, the portal...' },
    { k: 'done', label: 'How will you know it works?', ph: 'I add a photo to a folder and it shows up for them', area: true } ] },
  { id: 'we-talked', icon: '☎️', label: 'We just talked', to: 'everly', fields: [
    { k: 'need', label: 'What do they need', ph: 'In a sentence or two', area: true },
    { k: 'budget', label: 'Budget they mentioned', ph: 'A number, a range, or not yet' },
    { k: 'timeline', label: 'When do they need it', ph: 'A date, a season, or no rush' },
    { k: 'promised', label: 'What you promised them', ph: 'A proposal by Friday, a follow-up email...', area: true },
    { k: 'next', label: 'What happens next', ph: 'Send a proposal, more questions, a second call...', area: true } ] },
  { id: 'portal-update', icon: '🧩', label: 'Change their portal', to: 'ida', fields: [
    { k: 'what', label: 'What should change on their portal', ph: 'A new card, a status, a file to add...', area: true } ] },
  { id: 'follow-up', icon: '💌', label: 'Follow up with them', to: 'everly', fields: [
    { k: 'about', label: 'About what', ph: 'The invoice, their answers, a date...', area: true },
    { k: 'by', label: 'By when', type: 'date' } ] },
  { id: 'note', icon: '📝', label: 'Note', to: null, fields: [
    { k: 'note', label: 'Your note', ph: 'Anything Everly should know about them', area: true } ] },
  { id: 'other', icon: '＋', label: 'Something else', to: 'everly', fields: [
    { k: 'what', label: 'What do you need', ph: 'In your own words', area: true } ] },
];
const WHO = { ida: 'Everly hands it to Ida to build', everly: 'Everly handles it', null: 'Saved for Everly, nobody is woken' };

function adminBarHtml(client) {
  const slug = client.slug;
  const WHO_SHORT = { ida: 'Ida builds it', everly: 'Everly handles it', null: 'Just a note' };
  const tiles = ASK_TEMPLATES.map((t) => `<button type="button" class="ab-tpl" data-tpl="${t.id}"><span class="ab-ico" aria-hidden="true">${t.icon}</span>${esc(t.label)}<small>${esc(WHO_SHORT[t.to])}</small></button>`).join('');
  const first = String(client.welcomeName || client.name || '').split(/[\s,]+/)[0];
  const forms = ASK_TEMPLATES.map((t) => `<form class="ab-form" data-form="${t.id}" hidden>
      <p class="ab-route">${t.icon} ${esc(t.label)} · <b>${esc(WHO[t.to])}</b></p>
      <div class="ab-prog"><span class="ab-step-n">1 of ${t.fields.length}</span><span class="ab-bar"><i style="width:${Math.round(100 / t.fields.length)}%"></i></span></div>
      ${t.fields.map((f, i) => `<label class="ab-step" data-step="${i}"${i ? ' hidden' : ''}><span class="ab-q">${esc(f.label)}</span>${f.area ? `<textarea name="${f.k}" placeholder="${esc(f.ph || '')}" rows="4"></textarea>` : `<input name="${f.k}" type="${f.type || 'text'}" placeholder="${esc(f.ph || '')}">`}</label>`).join('')}
      <div class="ab-row"><button type="button" class="ab-cancel ab-back">← Back</button><button type="button" class="ab-send ab-next"${t.fields.length < 2 ? ' hidden' : ''}>Next →</button><button type="submit" class="ab-send ab-go"${t.fields.length > 1 ? ' hidden' : ''}>${t.to ? 'Send to ' + (t.to === 'ida' ? 'Ida' : 'Everly') : 'Save note'}</button></div>
    </form>`).join('');
  return `<style>
#welcome{display:none!important}
.ab [hidden]{display:none!important}
.ab{position:sticky;top:0;z-index:50;background:var(--paper);border-bottom:var(--rule);font-family:var(--sans)}
.ab-top{max-width:1060px;margin:0 auto;padding:10px max(16px,env(safe-area-inset-left,0px));display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between}
.ab-who{display:flex;flex-wrap:wrap;gap:8px 10px;align-items:center;font-size:14px;color:var(--ink-soft)}
.ab-who a{color:var(--oxford);font-weight:700;text-decoration:none}
.ab-tag{font:700 11px var(--mono);letter-spacing:.08em;text-transform:uppercase;background:var(--lime);color:var(--oxford);padding:4px 9px;border-radius:var(--radius-pill);border:1.5px solid var(--oxford);transform:rotate(-2deg);display:inline-block}
.ab-acts{display:flex;gap:8px;flex-wrap:wrap}
.ab-acts button,.ab-acts a{min-height:42px;padding:0 16px;border-radius:var(--radius-btn);border:var(--rule);background:var(--white);color:var(--oxford);font:700 14.5px var(--display);cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:6px;box-shadow:var(--shadow-hard-sm);transition:transform .15s var(--ease-spring),box-shadow .15s var(--ease-spring)}
.ab-acts button:active,.ab-acts a:active{transform:translateY(2px);box-shadow:0 0 0 0 var(--oxford)}
.ab-acts .ab-ask{background:var(--lime)}
.ab-panel{max-width:1060px;margin:0 auto;padding:4px max(16px,env(safe-area-inset-left,0px)) 16px}
.ab-card{display:grid;gap:14px;padding:18px;border-radius:var(--radius);background:var(--white);border:var(--rule);box-shadow:var(--shadow-hard)}
.ab-card h2{margin:0;font-size:21px;line-height:1.2}
.ab-card .ab-sub{margin:6px 0 0;font-size:14px;color:var(--ink-soft)}
.ab-tpls{display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}
.ab-tpl{display:grid;gap:4px;justify-items:start;text-align:left;padding:12px 14px;border-radius:var(--radius-sm);border:var(--rule);background:var(--paper);color:var(--oxford);font:700 15px var(--display);cursor:pointer;box-shadow:var(--shadow-hard-sm);transition:transform .15s var(--ease-spring)}
.ab-tpl:hover{transform:translateY(-2px)}
.ab-tpl .ab-ico{font-size:22px;line-height:1}
.ab-tpl small{font:600 12px var(--sans);color:var(--ink-soft)}
.ab-tpl[aria-pressed="true"]{background:var(--lavender)}
.ab-form{display:grid;gap:10px;padding:14px;border-radius:var(--radius-sm);background:var(--panel);border:1.5px solid var(--panel-2)}
.ab-form label{display:grid;gap:4px;font-size:14px;font-weight:600;color:var(--oxford)}
.ab-form input,.ab-form textarea{width:100%;padding:10px 12px;border:var(--rule);border-radius:var(--radius-btn);font:15px var(--sans);background:var(--white);color:var(--ink)}
.ab-route{margin:0;font-size:15px;color:var(--ink-soft)}
.ab-prog{display:flex;align-items:center;gap:10px}
.ab-step-n{font:700 11.5px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-soft);white-space:nowrap}
.ab-bar{flex:1;height:8px;border-radius:99px;background:var(--white);border:1px solid var(--panel-2);overflow:hidden}
.ab-bar i{display:block;height:100%;background:var(--oxford);border-radius:99px;transition:width .25s var(--ease-out)}
.ab-q{font-family:var(--display);font-size:20px;line-height:1.2;color:var(--oxford)}
.ab-picked .ab-tpls,.ab-picked .ab-head{display:none}
.ab-route b{color:var(--oxford)}
.ab-row{display:flex;gap:8px;flex-wrap:wrap}
.ab-send{min-height:46px;padding:0 18px;border-radius:var(--radius-btn);border:var(--rule);background:var(--lime);color:var(--oxford);font:800 15px var(--display);cursor:pointer;box-shadow:var(--shadow-hard)}
.ab-cancel{min-height:46px;padding:0 14px;border-radius:var(--radius-btn);border:var(--rule);background:var(--white);color:var(--oxford);font:600 14px var(--sans);cursor:pointer}

body{padding-bottom:110px}
.ab-top{max-width:1060px;margin:0 auto;padding:10px max(16px,env(safe-area-inset-left,0px));display:flex;flex-wrap:wrap;gap:8px 10px;align-items:center}
.ab-who{font-size:14px;color:var(--ink-soft)}
.ab-back{min-height:38px;display:inline-flex;align-items:center;padding:0 14px;border-radius:var(--radius-pill);border:var(--rule);background:var(--white);color:var(--oxford);font:700 14px var(--display);text-decoration:none;box-shadow:var(--shadow-hard-sm)}
.ab-back:hover{background:var(--lime)}
.ab{position:static;border-bottom:var(--rule)}
.ab-dock{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:60;display:flex;gap:4px;padding:6px;border-radius:18px;background:var(--white);border:var(--rule);box-shadow:var(--shadow-hard-lg);width:min(520px,calc(100% - 24px))}
.ab-dock a,.ab-dock button{flex:1;display:grid;justify-items:center;gap:2px;padding:8px 4px;border-radius:12px;border:0;background:transparent;color:var(--oxford);font:700 12.5px var(--sans);text-decoration:none;cursor:pointer}
.ab-dock span{font-size:20px;line-height:1}
.ab-dock .on,.ab-dock [aria-expanded="true"]{background:var(--lime);box-shadow:inset 0 0 0 1.5px var(--oxford)}
.ab-sheet{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(96px + env(safe-area-inset-bottom,0px));z-index:59;width:min(620px,calc(100% - 24px));max-height:calc(100vh - 140px);overflow:auto;padding:0}
.ab-card{position:relative}
.ab-x{position:absolute;top:10px;right:12px;width:36px;height:36px;border-radius:50%;border:var(--rule);background:var(--white);font:700 20px/1 var(--sans);color:var(--oxford);cursor:pointer}
.ab-head{padding-right:40px}
.ab-done{margin:0;padding:10px 14px;border-radius:var(--radius-sm);background:var(--green-bg);color:var(--green);font-weight:700}
</style>
<div class="ab" role="region" aria-label="Admin view">
  <div class="ab-top"><a class="ab-back" href="/admin">&larr; Back to my admin</a><span class="ab-tag">Admin view</span><span class="ab-who">This is exactly what ${esc(first)} sees</span></div>
  <div class="ab-sheet ab-panel" hidden><div class="ab-card">
    <button type="button" class="ab-x" aria-label="Close">×</button>
    <div class="ab-head"><h2>What do you need for ${esc(first)}?</h2>
    <p class="ab-sub">Pick one. It goes straight to the right teammate.</p></div>
    <div class="ab-tpls">${tiles}</div>
    ${forms}
    <p class="ab-done" hidden></p>
  </div></div>
  <nav class="ab-dock" aria-label="Your tabs">
    <a href="/admin"><span aria-hidden="true">👥</span>Businesses</a>
    <button type="button" class="ab-ask" aria-expanded="false"><span aria-hidden="true">⚡</span>Ask</button>
    <a href="/admin/${esc(slug)}/edit"><span aria-hidden="true">✏️</span>Edit</a>
    <a href="/admin/workflow"><span aria-hidden="true">⚙️</span>Settings</a>
    <a href="/admin/inquiries"><span aria-hidden="true">📥</span>Inquiries</a>
  </nav>
</div>
<script>
(function () {
  var bar = document.querySelector('.ab'), panel = bar.querySelector('.ab-panel'), ask = bar.querySelector('.ab-ask');
  var done = bar.querySelector('.ab-done');
  function openSheet(open) { panel.hidden = !open; ask.setAttribute('aria-expanded', String(open)); if (!open) show(''); }
  ask.addEventListener('click', function () { openSheet(panel.hidden); });
  bar.querySelector('.ab-x').addEventListener('click', function () { openSheet(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) openSheet(false); });
  var card = bar.querySelector('.ab-card');
  function step(f, i) {
    var steps = f.querySelectorAll('.ab-step'), n = steps.length;
    i = Math.max(0, Math.min(n - 1, i)); f.dataset.at = i;
    steps.forEach(function (st, j) { st.hidden = j !== i; });
    f.querySelector('.ab-step-n').textContent = (i + 1) + ' of ' + n;
    f.querySelector('.ab-bar i').style.width = Math.round(((i + 1) / n) * 100) + '%';
    f.querySelector('.ab-next').hidden = i === n - 1;
    f.querySelector('.ab-go').hidden = i !== n - 1;
    var inp = steps[i].querySelector('input,textarea'); if (inp) inp.focus();
  }
  function show(id) {
    bar.querySelectorAll('.ab-tpl').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.tpl === id)); });
    bar.querySelectorAll('.ab-form').forEach(function (f) { f.hidden = f.dataset.form !== id; });
    card.classList.toggle('ab-picked', !!id);
    if (id) done.hidden = true;
    var f = bar.querySelector('[data-form="' + id + '"]'); if (f) step(f, 0);
  }
  bar.querySelectorAll('.ab-form').forEach(function (f) {
    f.querySelector('.ab-next').addEventListener('click', function () { step(f, Number(f.dataset.at || 0) + 1); });
    f.querySelector('.ab-back').addEventListener('click', function () { var at = Number(f.dataset.at || 0); if (at > 0) step(f, at - 1); else show(''); });
    f.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); var nx = f.querySelector('.ab-next'); if (!nx.hidden) nx.click(); else f.requestSubmit(); } });
  });
  bar.querySelectorAll('.ab-tpl').forEach(function (b) { b.addEventListener('click', function () { show(b.dataset.tpl); }); });
  bar.querySelectorAll('.ab-form').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var fields = {}; new FormData(f).forEach(function (v, k) { fields[k] = String(v); });
      var btn = f.querySelector('.ab-send'); btn.disabled = true;
      fetch('/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ask', slug: ${JSON.stringify(String(slug))}, template: f.dataset.form, fields: fields }) })
        .then(function (r) { return r.json(); })
        .then(function (r) { btn.disabled = false; if (!r.ok) throw new Error(r.error || 'That did not send.'); f.reset(); show(''); done.textContent = r.message; done.hidden = false; })
        .catch(function (ex) { btn.disabled = false; done.textContent = ex.message; done.hidden = false; });
    });
  });
})();
</script>`;
}

/* Puts the bar at the very top of a portal page. */
function withAdminBar(pageHtml, client) {
  return String(pageHtml).replace(/<body([^>]*)>/i, (m) => m + adminBarHtml(client));
}

module.exports = { ASK_TEMPLATES, adminBarHtml, withAdminBar };
