/* Melody's Workflow tab: every step a client goes through, in order, each
   tagged with who runs it (System, Everly, Melody) and whether it is on. Any
   step can be changed, and a new step or feature can be asked for. Each ask
   is saved in the "workflow" store and wakes Everly, who hands it to Ida to
   build. Ida opens a pull request with a preview; Melody's approve is the
   merge. Everly reads and updates asks through /hooks/agent. */
const crypto = require('crypto');
const { FONT_LINK, TOKENS, BASE } = require('../portal/theme.js');

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const store = () => require('../portal/store').openStore('workflow');
const env = (k) => String(process.env[k] || '').trim();

/* The steps, in order. Status is read from this site's own settings where it
   can be, so a switch flipped in Netlify shows here on the next load. */
function steps() {
  const link = /^https:\/\//.test(env('BOOKING_URL'));
  const clientMail = env('CALLS_CLIENT_EMAILS').toLowerCase() === 'on';
  return [
    { id: 'inquiry', tool: 'Portal form', e: '📝', name: 'They fill in the interest form', who: 'system', what: 'Seven quick questions. The portal checks it is a real person.', on: 'on' },
    { id: 'got-it', tool: 'Resend', e: '💌', name: '"Got it. ¡Gracias!" email', who: 'system', what: 'Goes right away, in your colors, with what they told you.', on: 'on' },
    { id: 'book', tool: 'Booking link', e: '📅', name: 'They book a time with you', who: 'system', what: 'The book a time button in that email.', on: link ? 'on' : 'setup', why: link ? '' : 'Needs your booking link (BOOKING_URL)' },
    { id: 'nudge', tool: 'Resend', e: '🌿', name: 'Nudge if no booking in 2 days', who: 'system', what: 'One warm note. Booking a call cancels it.', on: link && clientMail ? 'on' : 'off', why: link && clientMail ? '' : 'Off until you ok the wording' },
    { id: 'call', tool: 'Phone or video', e: '☎️', name: 'The call', who: 'you', what: 'You talk. Tell Everly what you heard.', on: 'on' },
    { id: 'proposal', tool: 'Portal proposal', e: '📄', name: 'Proposal built for them', who: 'ai', what: 'Everly drafts it with exact scope and pricing. You approve it.', on: 'on' },
    { id: 'contract', tool: 'Signing tool', e: '✍️', name: 'Agreement', who: 'you', what: 'You review and sign.', on: 'on' },
    { id: 'payment', tool: 'Stripe', e: '💳', name: 'Payment', who: 'system', what: 'Stripe checkout, or you tell Everly it came in another way.', on: 'on' },
    { id: 'onboarding', tool: 'Portal', e: '🧩', name: 'Onboarding in their portal', who: 'system', what: 'Their questions, files and folders, saved as they go.', on: 'on' },
    { id: 'work', tool: 'Everly, Ida, GitHub', e: '🛠', name: 'The work', who: 'ai', what: 'Everly runs the system with you. Ida builds what needs code.', on: 'on' },
    { id: 'wrap', tool: 'Resend, portal', e: '🤍', name: 'Wrap and review', who: 'ai', what: 'Everything handed over, a thank you, one review ask.', on: 'on' },
  ];
}

const WHO = { system: 'System', ai: 'Everly (AI)', ida: 'Ida (AI)', you: 'You', client: 'Client', other: 'Other' };
const ON = { on: 'On', off: 'Off', setup: 'Needs setup' };

async function listAsks() {
  const st = store();
  const l = await st.list().catch(() => ({ blobs: [] }));
  const out = [];
  for (const b of l.blobs || []) { const r = await st.get(b.key, { type: 'json' }).catch(() => null); if (r) out.push(r); }
  return out.sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

/* Saves the ask, then wakes Everly to hand it to Ida. */
async function sendBuildAsk(body, clients) {
  const what = String(body.what || '').replace(/\u2014/g, ',').trim().slice(0, 3000);
  if (!what) throw new Error('Say what should happen.');
  const step = steps().find((s) => s.id === body.step);
  const forWho = String(body.forWho || 'all');
  const client = forWho !== 'all' && clients[forWho] ? clients[forWho].name : '';
  const at = new Date().toISOString();
  const id = 'wf-' + at.replace(/\D/g, '').slice(0, 14) + '-' + crypto.randomBytes(2).toString('hex');
  const who = Object.keys(WHO).indexOf(String(body.who)) !== -1 ? String(body.who) : '';
  const rec = { id, at, kind: step ? 'change' : 'new', step: step ? step.id : '', stepName: step ? step.name : '', forWho, client, who, tool: String(body.tool || '').trim().slice(0, 120), what, done: String(body.done || '').trim().slice(0, 1000), status: 'sent' };
  await store().setJSON(id, rec);
  const { wakeEverly } = require('../lib/everly.js');
  const woke = await wakeEverly('Portal: Melody asked for a workflow change, ask ' + id + '. Read it with node tools/portal.mjs read workflow and hand it to Ida.');
  if (!woke.fired) { rec.status = 'saved'; rec.wakeNote = String(woke.why || 'wake failed'); }
  await store().setJSON(id, rec);
  return { id, message: rec.status === 'sent' ? 'Sent. Everly hands it to Ida, and the preview comes to you.' : 'Saved here. Everly picks it up on her next run.' };
}

function renderWorkflows(clients, asks, textLast) {
  const textConnected = !!(process.env.INKBOX_API_KEY && process.env.EVERLY_INKBOX_IDENTITY_ID && process.env.MELODY_PHONE);
  const textStatus = !textConnected ? 'Not set up yet: needs INKBOX_API_KEY, EVERLY_INKBOX_IDENTITY_ID and MELODY_PHONE in Netlify.' : textLast ? 'Last text: ' + new Date(textLast.at).toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' · ' + textLast.why : 'Settings are in. No text has arrived yet.';
  const list = steps();
  const opts = Object.keys(clients).map((s) => `<option value="${esc(s)}">${esc(clients[s].name || s)}</option>`).join('');
  const stepRows = list.map((s, i) => `<li class="wf-step">
      <span class="wf-n">${i + 1}</span>
      <span class="wf-e" aria-hidden="true">${s.e}</span>
      <span class="wf-body"><b>${esc(s.name)}</b><span>${esc(s.what)}</span><span class="wf-tool">🧰 ${esc(s.tool || '')}</span>${s.why ? `<em>${esc(s.why)}</em>` : ''}</span>
      <span class="wf-tags"><i class="who ${s.who}">${WHO[s.who]}</i><i class="st ${s.on}">${ON[s.on]}</i></span>
      <button type="button" class="wf-edit" data-step="${esc(s.id)}" data-name="${esc(s.name)}">Change</button>
    </li>`).join('');
  const askRows = asks.length ? asks.slice(0, 12).map((a) => `<li><b>${esc(a.stepName || 'New')}</b> ${esc(a.what.length > 110 ? a.what.slice(0, 110) + '...' : a.what)}<i class="st ${a.status === 'live' ? 'on' : a.status === 'sent' || a.status === 'building' || a.status === 'preview' || a.status === 'saved' ? 'setup' : 'off'}">${esc({ sent: 'With Everly', building: 'Ida is building', preview: 'Preview ready', live: 'Live', saved: 'Waiting for Everly' }[a.status] || a.status)}</i></li>`).join('') : '<li class="wf-none">Nothing asked yet. Anything you add shows here with where it is.</li>';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">
<title>Settings · Me&amp;Co.</title>
${FONT_LINK}
<style>
${TOKENS}
${BASE}
body{padding-bottom:110px}
.ad{max-width:860px;margin:0 auto;padding:28px 16px 60px;display:grid;gap:20px}
.ad h1{margin:0;font-size:clamp(30px,6vw,42px);line-height:1.05}
.ad-head p{margin:4px 0 0;color:var(--ink-soft)}
.wf-add{display:flex;align-items:center;gap:12px;width:100%;padding:18px 20px;border-radius:var(--radius);border:2px dashed var(--oxford);background:var(--paper);font:700 19px var(--display);color:var(--oxford);cursor:pointer;text-align:left}
.wf-add span{font-size:26px}
.wf-add small{display:block;font:500 14px var(--sans);color:var(--ink-soft)}
.wf-list,.wf-asks{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.wf-step{display:grid;grid-template-columns:28px 34px 1fr auto;gap:10px;align-items:center;padding:14px 16px;border-radius:var(--radius);background:var(--white);border:var(--rule);box-shadow:var(--shadow-hard)}
.wf-n{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:var(--oxford);color:var(--white);font:700 13px var(--mono)}
.wf-e{font-size:24px;text-align:center}
.wf-body{display:grid;gap:2px;min-width:0}
.wf-body b{font-family:var(--display);font-size:17px}
.wf-body span{font-size:14px;color:var(--ink-soft)}
.wf-tool{font-size:12.5px!important;color:var(--ink-faint)!important}
.wf-body em{font-style:normal;font-size:13px;font-weight:700;color:var(--oxford)}
.wf-tags{display:flex;flex-direction:column;gap:4px;align-items:flex-end}
.wf-tags i,.wf-asks i{font-style:normal;font:700 11px var(--mono);letter-spacing:.06em;text-transform:uppercase;padding:3px 8px;border-radius:var(--radius-pill);white-space:nowrap}
.who.system{background:var(--panel);color:var(--oxford)}
.who.ai{background:var(--lavender);color:var(--oxford)}
.who.you{background:var(--lime);color:var(--oxford)}
.who.ida{background:var(--lavender);color:var(--oxford)}
.who.client,.who.other{background:var(--panel-2);color:var(--oxford)}
.st.on{background:var(--green-bg);color:var(--green)}
.st.off{background:var(--panel-2);color:var(--ink-soft)}
.st.setup{background:var(--lime);color:var(--oxford)}
.wf-edit{grid-column:3 / -1;justify-self:start;min-height:36px;padding:6px 14px;border-radius:var(--radius-btn);border:var(--rule);background:var(--white);font:700 14px var(--sans);color:var(--oxford);cursor:pointer}
.wf-edit:hover{background:var(--lime)}
.wf-sec{font:700 12px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-soft);margin:6px 0 -6px}
.wf-asks li{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:12px 14px;border-radius:14px;background:var(--white);border:1px solid var(--panel-2);font-size:14.5px}
.wf-asks li i{margin-left:auto}
.wf-none{color:var(--ink-faint)}
.wf-text{display:grid;gap:10px;padding:16px;border-radius:var(--radius);background:var(--white);border:var(--rule)}
.wf-text .wf-edit{grid-column:auto}
.wf-text-note{font-size:14px;color:var(--ink-soft)}
.sheet{position:fixed;inset:0;z-index:80;display:grid;align-items:end;justify-items:center;background:rgba(10,35,66,.35)}
.sheet[hidden]{display:none!important}
.sheet form{width:min(560px,100%);margin:0 0 0;padding:22px 20px calc(22px + env(safe-area-inset-bottom,0px));border-radius:22px 22px 0 0;background:var(--white);border:var(--rule);display:grid;gap:12px}
.sheet h2{margin:0;font-size:24px}
.sheet .prog{font:700 12px var(--mono);color:var(--ink-soft)}
.sheet label{display:grid;gap:6px;font-weight:700}
.sheet textarea,.sheet select{width:100%;min-height:48px;padding:10px 12px;border:var(--rule);border-radius:var(--radius-btn);font:inherit;background:var(--white)}
.sheet textarea{min-height:120px}
.sheet .q[hidden]{display:none!important}
.sheet .hint{font-weight:500;font-size:13.5px;color:var(--ink-soft)}
.sheet .row{display:flex;gap:10px}
.sheet .row button{flex:1;min-height:48px;border-radius:var(--radius-btn);border:var(--rule);font:700 16px var(--display);cursor:pointer}
.sheet .back{background:var(--white);color:var(--oxford)}
.sheet .next{background:var(--oxford);color:var(--white);box-shadow:var(--shadow-hard)}
.sheet .note{min-height:1em;font-size:14px;color:var(--ink-soft)}
.ab-dock{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:60;display:flex;gap:4px;padding:6px;border-radius:18px;background:var(--white);border:var(--rule);box-shadow:var(--shadow-hard-lg);width:min(400px,calc(100% - 24px))}
.ab-dock a{flex:1;display:grid;justify-items:center;gap:2px;padding:8px 4px;border-radius:12px;color:var(--oxford);font:700 12.5px var(--sans);text-decoration:none}
.ab-dock span{font-size:20px;line-height:1}
.ab-dock .on{background:var(--lime);box-shadow:inset 0 0 0 1.5px var(--oxford)}
@media (max-width:560px){.wf-step{grid-template-columns:26px 1fr auto}.wf-e{display:none}.wf-edit{grid-column:2 / -1}}
</style></head><body>
<main class="ad">
  <header class="ad-head"><h1>Settings</h1><p>Your workflow, every step a client goes through, and requests for changes. Change a step or ask for something new: Everly hands it to Ida, and you approve the preview.</p></header>
  <button type="button" class="wf-add" data-step="" data-name=""><span aria-hidden="true">＋</span><span>Request a change<small>A new step, a feature, or a change to your admin or portal. Like "my client needs a way to add images to their folders"</small></span></button>
  <p class="wf-sec">Your workflow</p>
  <ol class="wf-list">${stepRows}</ol>
  <p class="wf-sec">Your requests</p>
  <ul class="wf-asks">${askRows}</ul>
  <p class="wf-sec">Texting Everly</p>
  <div class="wf-text"><span>💬 Text Everly from your phone, like texting a teammate. Connect once after the three texting settings are in Netlify.</span><button type="button" class="wf-edit" id="inkboxConnect">Connect texting</button><span class="wf-text-note" id="inkboxNote" aria-live="polite">${esc(textStatus)}</span></div>
</main>
<div class="sheet" id="sheet" hidden>
  <form id="wf">
    <span class="prog" id="prog">1 of 5</span>
    <h2 id="title">Request a change</h2>
    <label class="q" data-q="0">What should happen?<span class="hint">Say it like you would to a person.</span><textarea name="what" placeholder="My client needs a way to add images to their folders"></textarea></label>
    <label class="q" data-q="1" hidden>Who does this step?<span class="hint">You, an AI, the system on its own, the client, or someone else.</span><select name="who"><option value="">Not sure, Everly decides</option><option value="you">Me</option><option value="ai">Everly (AI)</option><option value="ida">Ida (AI, builds code)</option><option value="system">System (runs on its own)</option><option value="client">The client</option><option value="other">Someone else</option></select></label>
    <label class="q" data-q="2" hidden>Which tool?<span class="hint">Optional. Like Canva, Stripe, Google Drive, the portal.</span><textarea name="tool" style="min-height:56px" placeholder="The portal"></textarea></label>
    <label class="q" data-q="3" hidden>Who is it for?<select name="forWho"><option value="all">Every client</option>${opts}</select></label>
    <label class="q" data-q="4" hidden>How will you know it works?<span class="hint">Optional. One line is plenty.</span><textarea name="done" placeholder="I add a photo to a folder and it shows up in their portal"></textarea></label>
    <p class="note" id="note" aria-live="polite"></p>
    <div class="row"><button type="button" class="back" id="back">Close</button><button type="button" class="next" id="next">Next &rarr;</button></div>
  </form>
</div>
<nav class="ab-dock" aria-label="Your tabs"><a href="/admin"><span aria-hidden="true">👥</span>Businesses</a><a href="/admin/everly"><span aria-hidden="true">🤖</span>Everly</a><a class="on" href="/admin/workflow" aria-current="page"><span aria-hidden="true">⚙️</span>Settings</a><a href="/admin/inquiries"><span aria-hidden="true">📥</span>Inquiries</a></nav>
<script>
(function () {
  var ib = document.getElementById('inkboxConnect');
  if (ib) ib.addEventListener('click', function () {
    var n = document.getElementById('inkboxNote'); n.textContent = 'Connecting...';
    fetch('/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'inkbox-connect' }) })
      .then(function (r) { return r.json(); }).then(function (r) { n.textContent = r.ok ? 'Connected. Text Everly to try it.' : r.error; })
      .catch(function () { n.textContent = 'That did not connect. Try again in a minute.'; });
  });
})();
(function () {
  var sheet = document.getElementById('sheet'), f = document.getElementById('wf'), qs = f.querySelectorAll('.q'), at = 0, step = '';
  var next = document.getElementById('next'), back = document.getElementById('back'), note = document.getElementById('note');
  function show() {
    qs.forEach(function (q, i) { q.hidden = i !== at; });
    document.getElementById('prog').textContent = (at + 1) + ' of ' + qs.length;
    back.textContent = at ? '\\u2190 Back' : 'Close';
    next.innerHTML = at === qs.length - 1 ? 'Send to Everly' : 'Next &rarr;';
    var el = qs[at].querySelector('textarea,select'); if (el) el.focus();
  }
  document.querySelectorAll('[data-step]').forEach(function (b) {
    b.addEventListener('click', function () {
      step = b.getAttribute('data-step'); at = 0; f.reset(); note.textContent = '';
      document.getElementById('title').textContent = step ? 'Change: ' + b.getAttribute('data-name') : 'Request a change';
      sheet.hidden = false; show();
    });
  });
  back.addEventListener('click', function () { if (at) { at--; show(); } else sheet.hidden = true; });
  sheet.addEventListener('click', function (e) { if (e.target === sheet) sheet.hidden = true; });
  next.addEventListener('click', function () {
    if (at === 0 && !f.what.value.trim()) { note.textContent = 'Say what should happen first.'; return; }
    note.textContent = '';
    if (at < qs.length - 1) { at++; show(); return; }
    next.disabled = true; note.textContent = 'Sending...';
    fetch('/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'build-request', step: step, what: f.what.value, who: f.who.value, tool: f.tool.value, forWho: f.forWho.value, done: f.done.value }) })
      .then(function (r) { return r.json(); })
      .then(function (r) { next.disabled = false; if (!r.ok) throw new Error(r.error || 'That did not send.'); note.textContent = r.message; setTimeout(function () { location.reload(); }, 1400); })
      .catch(function (ex) { next.disabled = false; note.textContent = ex.message; });
  });
})();
</script>
</body></html>`;
}

/* Everly's update to an ask: where the build is, the pull request, the preview. */
async function updateAsk(id, patch) {
  const st = store();
  const rec = await st.get(String(id), { type: 'json' }).catch(() => null);
  if (!rec) throw new Error('No ask ' + id);
  const allowed = ['sent', 'building', 'preview', 'live', 'declined'];
  if (patch.status && allowed.indexOf(patch.status) === -1) throw new Error('status is one of ' + allowed.join(', '));
  for (const k of ['status', 'pr', 'preview', 'note']) if (patch[k] != null) rec[k] = String(patch[k]).replace(/\u2014/g, ',').slice(0, 1000);
  rec.updatedAt = new Date().toISOString();
  await st.setJSON(rec.id, rec);
  return rec;
}

module.exports = { steps, listAsks, sendBuildAsk, updateAsk, renderWorkflows };
