/* ============================================================
   Me&Co.: the discovery brief, as a real flow
   ------------------------------------------------------------
   Like the proposal: animated and beautiful.
   So the mechanics here are the proposal's mechanics, not a fresh
   invention. Everything below is lifted from the real, live
   public/proposals/melody-project2.html and adapted:

     .mode-panel / .mode-panel.active   one screen visible at a time
     .progress-rail + .progress-fill    width transition, 0.5s,
                                        cubic-bezier(0.65,0,0.35,1)
     .step-count pill                   fixed, top right
     .step-footer                       fixed Back and Continue
     nsRise                             28px lift plus fade, stagger
                                        down the panel, 0.7s,
                                        cubic-bezier(0.22,0.75,0.25,1)
     body.is-cover                      chrome hidden on the cover

   What is added, and why each one is not decoration:

   - A dot rail of every step, always visible, current one lime. The
     proposal has three steps so a pill is enough. This has twelve.
     Knowing how much is left is the whole difference between a form
     someone finishes and a form someone abandons.
   - Autosave to localStorage on every keystroke, restored on return.
     Thirteen sections is more than one sitting. Losing that to a
     closed tab would be the last time anyone filled it in.
   - A per-step answered count, so partial progress reads as progress
     rather than as failure.
   - Review before send, the same promise onboarding-form.js already
     makes: nothing is submitted until you have seen it.

   Mobile first throughout. Real clients of this system fill things
   in on a phone: single column by default, 16px inputs so iOS does
   not zoom on focus, 52px minimum touch targets, the footer nav in
   thumb reach, the dot rail collapsing to the count pill under 720px.
   ============================================================ */

const { FONT_LINK, TOKENS, BASE } = require('../portal/theme.js');
const { buildBrief } = require('../portal/brief-schema.js');

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderField(sectionId, field) {
  const name = sectionId + '.' + field.id;
  const id = 'f-' + sectionId + '-' + field.id;
  const help = field.help ? `<p class="help" id="${id}-help">${escapeHtml(field.help)}</p>` : '';
  const describedBy = field.help ? ` aria-describedby="${id}-help"` : '';
  const req = field.required ? ' data-required="1"' : '';
  const reqMark = field.required ? ' <span class="req" title="Needed before you can send">needed</span>' : '';
  const head = `<div class="f-head"><label class="f-label" for="${id}">${escapeHtml(field.label)}${reqMark}</label>${help}</div>`;

  if (field.type === 'long') {
    return `<div class="f" data-field="${escapeHtml(name)}" data-type="long">
      ${head}
      <textarea id="${id}" name="${escapeHtml(name)}" rows="3"${describedBy}${req} data-label="${escapeHtml(field.label)}"></textarea>
    </div>`;
  }

  if (field.type === 'pick' || field.type === 'choose') {
    const multi = field.type === 'choose';
    const chips = (field.options || [])
      .map(
        (opt, i) => `<label class="chip">
          <input type="${multi ? 'checkbox' : 'radio'}" name="${escapeHtml(name)}" value="${escapeHtml(opt)}" ${multi ? '' : `id="${id}${i === 0 ? '' : '-' + i}"`}>
          <span>${escapeHtml(opt)}</span>
        </label>`
      )
      .join('');
    return `<div class="f" data-field="${escapeHtml(name)}" data-type="${field.type}" data-label="${escapeHtml(field.label)}">
      <div class="f-head"><span class="f-label" id="${id}">${escapeHtml(field.label)}${reqMark}</span>${help}</div>
      <div class="chips" role="group" aria-labelledby="${id}">${chips}</div>
      <input class="other" type="text" name="${escapeHtml(name)}.other" placeholder="Something else? Type it here" aria-label="${escapeHtml(field.label)}, something else">
    </div>`;
  }

  if (field.type === 'pages') {
    const opts = (field.options || [])
      .map(
        (opt) => `<label class="chip">
          <input type="checkbox" class="page-pick" name="${escapeHtml(name)}" value="${escapeHtml(opt)}">
          <span>${escapeHtml(opt)}</span>
        </label>`
      )
      .join('');
    const details = (field.options || [])
      .map((opt) => {
        const key = opt.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        return `<div class="page-detail" data-page="${escapeHtml(opt)}" hidden>
          <p class="page-detail-title">${escapeHtml(opt)}</p>
          <label class="mini"><span>Primary goal</span><input type="text" name="${escapeHtml(name)}.${key}.goal" data-label="${escapeHtml(opt)} primary goal"></label>
          <label class="mini"><span>Primary call to action</span><input type="text" name="${escapeHtml(name)}.${key}.cta" data-label="${escapeHtml(opt)} call to action"></label>
          <label class="mini"><span>Required content</span><textarea rows="2" name="${escapeHtml(name)}.${key}.content" data-label="${escapeHtml(opt)} required content"></textarea></label>
        </div>`;
      })
      .join('');
    return `<div class="f" data-field="${escapeHtml(name)}" data-type="pages" data-max="${field.max || 5}" data-label="${escapeHtml(field.label)}">
      <div class="f-head"><span class="f-label" id="${id}">${escapeHtml(field.label)}</span><p class="help">Pick up to ${field.max || 5}. Each one you pick opens three quick questions.</p></div>
      <div class="chips" role="group" aria-labelledby="${id}">${opts}</div>
      <p class="page-count" aria-live="polite">0 of ${field.max || 5} chosen</p>
      <div class="page-details">${details}</div>
    </div>`;
  }

  const inputType = field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : field.type === 'date' ? 'date' : 'text';
  const extra =
    field.type === 'email'
      ? ' inputmode="email" autocomplete="email"'
      : field.type === 'url'
        ? ' inputmode="url" spellcheck="false"'
        : '';
  return `<div class="f" data-field="${escapeHtml(name)}" data-type="${escapeHtml(field.type)}">
    ${head}
    <input id="${id}" name="${escapeHtml(name)}" type="${inputType}"${extra}${describedBy}${req} data-label="${escapeHtml(field.label)}"${field.placeholder ? ` placeholder="${escapeHtml(field.placeholder)}"` : ''}>
  </div>`;
}

function renderSectionPanel(section, index, total) {
  const fields = section.fields.map((f) => renderField(section.id, f)).join('');
  return `<div class="mode-panel" data-mode-panel="${escapeHtml(section.id)}">
    <div class="wrap step-shell">
      <div class="sheet">
        <div class="sheet-head">
          <p class="microlabel rise">${escapeHtml(section.kicker)}</p>
          <h2 class="rise d2">${escapeHtml(section.title)}</h2>
          <p class="sheet-blurb rise d3">${escapeHtml(section.blurb)}</p>
        </div>
        <div class="sheet-body rise d4">${fields}</div>
        <div class="sheet-foot rise d5">
          <button type="button" class="step-btn solid step-next">${index === total - 1 ? 'Review everything' : 'Next'} &rarr;</button>
          <button type="button" class="step-btn ghost step-prev">&larr; Back</button>
        </div>
      </div>
    </div>
  </div>`;
}

/* The brief strategy is logic based: an inquiry first, then a brief
   customized after the discovery call, carrying only the questions that
   are relevant to that client.

   All thirteen sections exist below. Melody decides which of them a
   given client sees. This function accepts a pre-resolved section list,
   which discovery-bank.js produces from her per-client selection made at
   /admin/<slug>/brief after the real call. Never call buildBrief() from
   here and render all thirteen to everybody. Passing no sections still
   renders the full variant, so the schema stays testable on its own
   (scripts/verify-gate.js relies on that). */
function renderBriefForm(opts) {
  const options = opts || {};
  const brief = buildBrief(options.variant);
  const meta = options.meta || brief.meta;
  const sections = options.sections && options.sections.length ? options.sections : brief.sections;
  const total = sections.length;
  const stepOrder = ['cover'].concat(sections.map((s) => s.id)).concat(['review', 'sent']);
  const formName = 'discovery-brief';

  const dots = sections
    .map(
      (s, i) => `<button type="button" class="dot-step" data-mode="${escapeHtml(s.id)}" aria-label="Step ${i + 1} of ${total}, ${escapeHtml(s.title)}" title="${i + 1}. ${escapeHtml(s.title)}"><span class="bar"></span></button>`
    )
    .join('');

  const otherVariant = brief.variant === 'nonprofit' ? 'business' : 'nonprofit';
  const otherLabel = brief.variant === 'nonprofit' ? 'Not a nonprofit?' : 'Are you a nonprofit?';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>Me&Co. &middot; Project brief</title>
${FONT_LINK}
<style>
${TOKENS}
${BASE}

  /* ---- chrome, straight off the proposal ---- */
  .progress-rail { position: fixed; top: 0; left: 0; right: 0; height: 4px; background: var(--panel-2); z-index: 3000; }
  .progress-fill { height: 100%; background: var(--lime); width: 0%; transition: width 0.5s cubic-bezier(0.65,0,0.35,1); }
  .step-count {
    position: fixed; top: 12px; right: 14px; z-index: 3000;
    font-family: var(--mono); font-size: 0.66rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--ink-soft); background: var(--white); padding: 6px 12px; border-radius: 999px; border: 1px solid var(--panel-2);
    box-shadow: var(--shadow-sm);
  }
  body.is-cover .step-count, body.is-cover .dot-rail, body.is-cover .step-footer { display: none; }
  body.is-done .step-footer, body.is-done .dot-rail { display: none; }

  /* ---- dot rail: twelve steps is too many for a pill alone ---- */
  .dot-rail { display: none; }
  @media (min-width: 900px) {
    .dot-rail {
      display: flex; flex-direction: column; gap: 7px;
      position: fixed; left: 20px; top: 50%; transform: translateY(-50%); z-index: 2600;
    }
    .dot-step { border: none; background: none; padding: 4px 6px; cursor: pointer; display: block; }
    .dot-step .bar { display: block; width: 26px; height: 4px; border-radius: 3px; background: var(--panel-2); transition: background 0.3s ease, width 0.3s ease; }
    .dot-step.done .bar { background: var(--green); }
    .dot-step.current .bar { background: var(--lime); width: 40px; }
  }

  .wrap { max-width: 44rem; margin: 0 auto; padding: 0 18px; }
  .mode-panel { display: none; }
  .mode-panel.active { display: block; }

  @keyframes nsRise { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: translateY(0); } }
  .mode-panel.active .rise { animation: nsRise 0.7s cubic-bezier(0.22,0.75,0.25,1) both; }
  .mode-panel.active .rise.d2 { animation-delay: 0.09s; }
  .mode-panel.active .rise.d3 { animation-delay: 0.18s; }
  .mode-panel.active .rise.d4 { animation-delay: 0.28s; }
  .mode-panel.active .rise.d5 { animation-delay: 0.40s; }
  @media (prefers-reduced-motion: reduce) { .mode-panel.active .rise { animation: none; } .progress-fill { transition: none; } }

  /* ---- cover ---- */
  .cover-shell { min-height: 92vh; min-height: 92svh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 22px; padding: 56px 20px; max-width: 40rem; margin: 0 auto; }
  .cover-wordmark { display: inline-flex; align-items: center; gap: 10px; font-family: var(--display); font-weight: 800; font-size: 1.15rem; color: var(--oxford); background: var(--white); border: 1px solid var(--panel-2); border-radius: 999px; padding: 10px 22px 10px 16px; box-shadow: var(--shadow); }
  .cover-wordmark .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--lime); flex: none; }
  .cover-h1 { font-size: clamp(1.9rem, 7.5vw, 3rem); max-width: 17ch; line-height: 1.1; letter-spacing: -0.02em; }
  .cover-sub { color: var(--ink-soft); font-size: clamp(1rem, 3.6vw, 1.08rem); max-width: 42ch; }
  .cover-facts { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
  .fact { font-family: var(--mono); font-size: 0.64rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-soft); background: var(--white); border: 1px solid var(--panel-2); border-radius: 999px; padding: 7px 13px; }
  .cover-arrow { margin-top: 6px; width: 56px; height: 56px; border-radius: 50%; border: none; background: var(--oxford); color: var(--paper); font-size: 1.3rem; cursor: pointer; display: flex; align-items: center; justify-content: center; animation: coverBounce 2s ease-in-out infinite; }
  .cover-arrow:hover { background: #061529; }
  @keyframes coverBounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(6px); } }
  @media (prefers-reduced-motion: reduce) { .cover-arrow { animation: none; } }
  .variant-switch { font-size: 0.86rem; color: var(--ink-faint); }
  .variant-switch a { color: var(--blue-ink); }
  .resumed { display: none; background: var(--green-bg); border: 1px solid #cfe8bd; color: var(--green); border-radius: var(--radius-sm); padding: 11px 14px; font-size: 0.88rem; max-width: 34rem; }
  .resumed.show { display: block; }

  /* ---- a step ---- */
  body:not(.is-cover) { padding-bottom: 92px; }
  .step-shell { padding: 26px 0 30px; }
  .sheet { background: var(--white); border: 1px solid var(--panel-2); border-radius: var(--radius); box-shadow: var(--shadow); padding: clamp(22px, 5.5vw, 40px); }
  .sheet-head h2 { font-size: clamp(1.4rem, 5.6vw, 2rem); margin: 0.35rem 0 0; letter-spacing: -0.02em; text-wrap: balance; }
  .sheet-blurb { color: var(--ink-soft); font-size: 0.95rem; margin: 0.6rem 0 0; max-width: 46ch; }
  .sheet-body { margin-top: clamp(20px, 5vw, 30px); border-top: 1px solid var(--panel-2); padding-top: clamp(18px, 4.5vw, 26px); }

  .f { margin-bottom: 26px; }
  .f:last-child { margin-bottom: 6px; }
  .f-head { margin-bottom: 8px; }
  .f-label { display: block; font-family: var(--display); font-weight: 700; font-size: 1rem; color: var(--oxford); }
  .req { font-family: var(--mono); font-size: 0.58rem; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: var(--lime-ink); border: 1px solid var(--panel-2); border-radius: 999px; padding: 2px 7px; vertical-align: 2px; }
  .help { color: var(--ink-faint); font-size: 0.85rem; margin: 0.3rem 0 0; }

  input[type="text"], input[type="email"], input[type="url"], input[type="date"], textarea, .other {
    width: 100%; font-family: var(--sans); font-size: 16px; color: var(--ink);
    background: var(--paper); border: 1px solid var(--panel-2); border-radius: var(--radius-sm);
    padding: 13px 14px; outline: none; min-height: 52px; resize: vertical;
  }
  textarea { line-height: 1.55; }
  input:focus, textarea:focus { border-color: var(--oxford); background: var(--white); }
  .f.answered .f-label::after { content: " \\2713"; color: var(--green); font-size: 0.9em; }

  .chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip { position: relative; display: inline-flex; }
  .chip input { position: absolute; opacity: 0; width: 100%; height: 100%; margin: 0; cursor: pointer; }
  .chip span {
    display: inline-flex; align-items: center; min-height: 44px; padding: 9px 16px;
    border: 1px solid var(--panel-2); border-radius: 999px; background: var(--paper);
    font-size: 0.9rem; color: var(--ink-soft); cursor: pointer;
    transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
  }
  .chip input:checked + span { background: var(--oxford); border-color: var(--oxford); color: var(--paper); transform: translateY(-1px); }
  .chip input:focus-visible + span { outline: 3px solid var(--blue); outline-offset: 2px; }
  .chip input:disabled + span { opacity: 0.4; cursor: not-allowed; }
  @media (prefers-reduced-motion: reduce) { .chip span { transition: none; } .chip input:checked + span { transform: none; } }
  .other { margin-top: 10px; }

  .page-count { font-family: var(--mono); font-size: 0.66rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-faint); margin: 10px 0 0; }
  .page-details { margin-top: 6px; }
  .page-detail { border: 1px solid var(--line, #E4E0D0); border-radius: var(--radius-sm); background: var(--paper); padding: 14px 16px; margin-top: 12px; }
  .page-detail[hidden] { display: none; }
  .page-detail-title { font-family: var(--display); font-weight: 700; color: var(--oxford); margin: 0 0 8px; font-size: 0.98rem; }
  .mini { display: block; margin-top: 10px; }
  .mini > span { display: block; font-family: var(--mono); font-size: 0.62rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-faint); margin-bottom: 5px; }

  .sheet-foot { display: flex; flex-direction: column-reverse; gap: 10px; margin-top: 28px; border-top: 1px solid var(--panel-2); padding-top: 20px; }
  @media (min-width: 560px) { .sheet-foot { flex-direction: row; justify-content: space-between; } }

  .step-btn { font-family: var(--display); font-weight: 700; font-size: 0.95rem; border-radius: 999px; padding: 14px 22px; min-height: 52px; cursor: pointer; border: 1px solid var(--oxford); background: none; color: var(--oxford); }
  .step-btn.solid { background: var(--oxford); color: var(--white); }
  .step-btn.solid:hover { background: #061529; }
  .step-btn.ghost { border-color: var(--panel-2); color: var(--ink-soft); }
  .step-btn.ghost:hover { background: var(--panel); }
  .step-btn[disabled] { opacity: 0.55; pointer-events: none; }

  /* ---- fixed footer nav, thumb reach on a phone ---- */
  .step-footer { position: fixed; bottom: 0; left: 0; right: 0; z-index: 2500; background: var(--white); border-top: 1px solid var(--panel-2); box-shadow: 0 -12px 30px -20px rgba(34,49,94,0.35); padding-bottom: env(safe-area-inset-bottom); }
  .step-footer-inner { max-width: 44rem; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 14px; }
  .footer-where { font-family: var(--mono); font-size: 0.62rem; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; color: var(--ink-faint); text-align: center; flex: 1; min-width: 0; }
  .footer-where b { display: block; color: var(--oxford); font-family: var(--sans); font-size: 0.8rem; letter-spacing: 0; text-transform: none; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .step-footer .step-btn { padding: 12px 16px; min-height: 48px; font-size: 0.88rem; }

  /* ---- review ---- */
  .rev-note { border: 1px solid var(--line, #E4E0D0); border-radius: var(--radius-sm); background: var(--paper); padding: 14px 16px; font-size: 0.9rem; color: var(--ink-soft); margin-bottom: 20px; }
  .rev-sec { border-top: 1px solid var(--panel-2); padding: 18px 0 4px; }
  .rev-sec-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .rev-sec h3 { font-size: 1.05rem; margin: 0; }
  .rev-edit { background: none; border: none; color: var(--blue-ink); font-family: var(--sans); font-weight: 600; font-size: 0.85rem; cursor: pointer; padding: 6px 0; text-decoration: underline; }
  .rev-row { margin-top: 12px; }
  .rev-row .q { font-size: 0.82rem; color: var(--ink-faint); }
  .rev-row .a { font-size: 0.94rem; color: var(--ink); white-space: pre-wrap; margin-top: 2px; }
  .rev-row .a.blank { color: var(--ink-faint); font-style: italic; }
  .rev-missing { background: #FBEDE7; border: 1px solid #E8B7A2; color: #8f3517; border-radius: var(--radius-sm); padding: 12px 14px; font-size: 0.9rem; margin-bottom: 18px; display: none; }
  .rev-missing.show { display: block; }

  /* ---- sent ---- */
  .sent-shell { min-height: 80vh; min-height: 80svh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 16px; padding: 60px 20px; max-width: 36rem; margin: 0 auto; }
  .sent-tick { width: 72px; height: 72px; border-radius: 50%; background: var(--lime); display: flex; align-items: center; justify-content: center; animation: nsPop 0.55s cubic-bezier(0.34,1.56,0.64,1) both; }
  @keyframes nsPop { from { opacity: 0; transform: scale(0.82); } to { opacity: 1; transform: scale(1); } }
  @media (prefers-reduced-motion: reduce) { .sent-tick { animation: none; } }
  .sent-shell h2 { font-size: clamp(1.6rem, 6vw, 2.2rem); }
  .sent-shell p { color: var(--ink-soft); max-width: 40ch; }
</style>
</head>
<body class="is-cover">

<div class="progress-rail"><div class="progress-fill" id="progressFill"></div></div>
<div class="step-count" id="stepCount">Step 1 of ${total}</div>
<nav class="dot-rail" id="dotRail" aria-label="Brief progress">${dots}</nav>

<div class="mode-panel active" data-mode-panel="cover">
  <div class="cover-shell">
    <div class="cover-wordmark rise"><span class="dot"></span>Me&Co.</div>
    <h1 class="cover-h1 rise d2">${escapeHtml(meta.coverTitle)}</h1>
    <p class="cover-sub rise d3">${escapeHtml(meta.coverSub)}</p>
    <div class="cover-facts rise d4">
      <span class="fact">${total} steps</span>
      <span class="fact">About 15 minutes</span>
      <span class="fact">Saves as you go</span>
    </div>
    <div class="resumed rise d4" id="resumed">We found answers you started earlier and put them back in. Pick up wherever you left off.</div>
    <button class="cover-arrow step-next rise d5" aria-label="Start the brief">&darr;</button>
    <p class="variant-switch rise d5">${escapeHtml(otherLabel)} <a href="/discovery/${otherVariant}">Switch to the ${escapeHtml(otherVariant === 'nonprofit' ? 'nonprofit' : 'business')} version</a></p>
  </div>
</div>

${sections.map((s, i) => renderSectionPanel(s, i, total)).join('\n')}

<div class="mode-panel" data-mode-panel="review">
  <div class="wrap step-shell">
    <div class="sheet">
      <div class="sheet-head">
        <p class="microlabel rise">Last step</p>
        <h2 class="rise d2">Read it back before it goes.</h2>
        <p class="sheet-blurb rise d3">Nothing has been sent yet. Change anything you want, blanks are completely fine, then send it when you are happy.</p>
      </div>
      <div class="sheet-body rise d4">
        <div class="rev-missing" id="revMissing" role="alert"></div>
        <div class="rev-note">Whatever you leave blank we will simply ask about on the call. This is a starting point, not an exam.</div>
        <div id="revList"></div>
      </div>
      <div class="sheet-foot rise d5">
        <button type="button" class="step-btn solid" id="sendBtn">Send my brief</button>
        <button type="button" class="step-btn ghost step-prev">&larr; Back</button>
      </div>
    </div>
  </div>
</div>

<div class="mode-panel" data-mode-panel="sent">
  <div class="sent-shell">
    <div class="sent-tick" aria-hidden="true">
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#22315E" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5"></path></svg>
    </div>
    <h2>That is the hard part done.</h2>
    <p id="sentMsg">Your brief is with Melody. You will hear back within two working days, and the first thing you get will be a plan, not more questions.</p>
    <p class="variant-switch"><a href="/">Back to the start</a></p>
  </div>
</div>

<div class="step-footer">
  <div class="step-footer-inner">
    <button type="button" class="step-btn ghost step-prev" id="footerBack">&larr;</button>
    <div class="footer-where"><span id="footerCount">Step 1 of ${total}</span><b id="footerName">&nbsp;</b></div>
    <button type="button" class="step-btn solid step-next" id="footerNext">Next &rarr;</button>
  </div>
</div>

<script>
(function () {
  var STEP_ORDER = ${JSON.stringify(stepOrder)};
  var SECTIONS = ${JSON.stringify(sections.map((s) => ({ id: s.id, title: s.title, kicker: s.kicker })))};
  var VARIANT = ${JSON.stringify(brief.variant)};
  var FORM_NAME = ${JSON.stringify(formName)};
  /* Set when this brief is being filled in from inside a real client's
     portal (/portal/<slug>/brief), which is the only way stage 2 is ever
     reached now. Empty means an anonymous draft, which only the local
     staging store accepts. */
  var SLUG = ${JSON.stringify(options.slug || '')};
  var STORE_KEY = 'mora-discovery-brief-' + VARIANT + (SLUG ? '-' + SLUG : '');
  var SECTION_IDS = SECTIONS.map(function (s) { return s.id; });

  function panels() { return document.querySelectorAll('.mode-panel'); }
  function currentMode() {
    var mode = 'cover';
    panels().forEach(function (p) { if (p.classList.contains('active')) mode = p.dataset.modePanel; });
    return mode;
  }

  function goToMode(mode) {
    panels().forEach(function (p) { p.classList.toggle('active', p.dataset.modePanel === mode); });
    document.body.classList.toggle('is-cover', mode === 'cover');
    document.body.classList.toggle('is-done', mode === 'sent');

    var si = SECTION_IDS.indexOf(mode);
    var shown = si >= 0 ? si + 1 : (mode === 'cover' ? 0 : SECTION_IDS.length);
    var pct = (shown / SECTION_IDS.length) * 100;
    document.getElementById('progressFill').style.width = pct + '%';

    var label = si >= 0 ? 'Step ' + (si + 1) + ' of ' + SECTION_IDS.length
      : mode === 'review' ? 'Review' : mode === 'sent' ? 'Sent' : 'Step 1 of ' + SECTION_IDS.length;
    document.getElementById('stepCount').textContent = label;
    document.getElementById('footerCount').textContent = label;
    document.getElementById('footerName').textContent = si >= 0 ? SECTIONS[si].title : (mode === 'review' ? 'Read it back' : '\\u00a0');

    document.querySelectorAll('.dot-step').forEach(function (d, i) {
      d.classList.toggle('current', d.dataset.mode === mode);
      d.classList.toggle('done', si >= 0 ? i < si : mode === 'review' || mode === 'sent');
    });

    document.getElementById('footerBack').disabled = (mode === 'cover');
    document.getElementById('footerNext').style.visibility = (mode === 'review' || mode === 'sent') ? 'hidden' : 'visible';

    if (mode === 'review') buildReview();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try { history.replaceState(null, '', '#' + mode); } catch (e) {}
  }

  function stepBy(delta) {
    var i = STEP_ORDER.indexOf(currentMode());
    if (i < 0) i = 0;
    goToMode(STEP_ORDER[Math.min(STEP_ORDER.length - 1, Math.max(0, i + delta))]);
  }

  document.querySelectorAll('.step-next').forEach(function (b) { b.addEventListener('click', function () { stepBy(1); }); });
  document.querySelectorAll('.step-prev').forEach(function (b) { b.addEventListener('click', function () { stepBy(-1); }); });
  document.querySelectorAll('.dot-step').forEach(function (d) { d.addEventListener('click', function () { goToMode(d.dataset.mode); }); });

  /* ---- the pages widget ---- */
  document.querySelectorAll('.f[data-type="pages"]').forEach(function (wrap) {
    var max = parseInt(wrap.dataset.max, 10) || 5;
    var boxes = wrap.querySelectorAll('.page-pick');
    var counter = wrap.querySelector('.page-count');
    function sync() {
      var picked = 0;
      boxes.forEach(function (b) { if (b.checked) picked += 1; });
      boxes.forEach(function (b) { b.disabled = !b.checked && picked >= max; });
      wrap.querySelectorAll('.page-detail').forEach(function (d) {
        var on = false;
        boxes.forEach(function (b) { if (b.checked && b.value === d.dataset.page) on = true; });
        if (on) d.removeAttribute('hidden'); else d.setAttribute('hidden', '');
      });
      counter.textContent = picked + ' of ' + max + ' chosen';
    }
    boxes.forEach(function (b) { b.addEventListener('change', sync); });
    wrap.sync = sync;
    sync();
  });

  /* ---- answered marks, so progress reads as progress ---- */
  function markAnswered() {
    document.querySelectorAll('.f').forEach(function (f) {
      var filled = false;
      f.querySelectorAll('input, textarea').forEach(function (el) {
        if (el.type === 'checkbox' || el.type === 'radio') { if (el.checked) filled = true; }
        else if (String(el.value || '').trim()) filled = true;
      });
      f.classList.toggle('answered', filled);
    });
  }

  /* ---- autosave ---- */
  function collect() {
    var out = {};
    document.querySelectorAll('input, textarea').forEach(function (el) {
      if (!el.name) return;
      if (el.type === 'checkbox') {
        if (!el.checked) return;
        if (!Array.isArray(out[el.name])) out[el.name] = [];
        out[el.name].push(el.value);
      } else if (el.type === 'radio') {
        if (el.checked) out[el.name] = el.value;
      } else if (String(el.value || '').trim()) {
        out[el.name] = el.value;
      }
    });
    return out;
  }

  function restore(data) {
    if (!data) return false;
    var any = false;
    Object.keys(data).forEach(function (name) {
      var value = data[name];
      var els = document.querySelectorAll('[name="' + (window.CSS && CSS.escape ? CSS.escape(name) : name.replace(/"/g, '\\\\"')) + '"]');
      if (!els.length) return;
      els.forEach(function (el) {
        if (el.type === 'checkbox') {
          if (Array.isArray(value) && value.indexOf(el.value) !== -1) { el.checked = true; any = true; }
        } else if (el.type === 'radio') {
          if (el.value === value) { el.checked = true; any = true; }
        } else if (typeof value === 'string') {
          el.value = value; any = true;
        }
      });
    });
    document.querySelectorAll('.f[data-type="pages"]').forEach(function (w) { if (w.sync) w.sync(); });
    return any;
  }

  var saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { localStorage.setItem(STORE_KEY, JSON.stringify({ at: Date.now(), data: collect() })); } catch (e) {}
    }, 350);
  }

  document.addEventListener('input', function () { markAnswered(); save(); });
  document.addEventListener('change', function () { markAnswered(); save(); });

  try {
    var saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (saved && saved.data && restore(saved.data)) {
      document.getElementById('resumed').classList.add('show');
    }
  } catch (e) {}
  markAnswered();

  /* ---- review ---- */
  function labelFor(el) {
    return el.dataset.label || (el.closest('.f') && el.closest('.f').dataset.label) || el.name;
  }

  function buildReview() {
    var html = '';
    var missing = [];
    SECTIONS.forEach(function (sec) {
      var panel = document.querySelector('.mode-panel[data-mode-panel="' + sec.id + '"]');
      if (!panel) return;
      var rows = '';
      panel.querySelectorAll('.f').forEach(function (f) {
        var type = f.dataset.type;
        var label = f.dataset.label || (f.querySelector('.f-label') ? f.querySelector('.f-label').textContent.replace(/\\s*needed$/, '').trim() : '');
        var answer = '';
        if (type === 'choose' || type === 'pick') {
          var picked = [];
          f.querySelectorAll('input[type=checkbox]:checked, input[type=radio]:checked').forEach(function (b) { picked.push(b.value); });
          var other = f.querySelector('.other');
          if (other && other.value.trim()) picked.push(other.value.trim());
          answer = picked.join(', ');
        } else if (type === 'pages') {
          var parts = [];
          f.querySelectorAll('.page-detail:not([hidden])').forEach(function (d) {
            var bits = [];
            d.querySelectorAll('input, textarea').forEach(function (el) {
              if (String(el.value || '').trim()) bits.push(el.dataset.label.replace(d.dataset.page + ' ', '') + ': ' + el.value.trim());
            });
            parts.push(d.dataset.page + (bits.length ? ' (' + bits.join('; ') + ')' : ''));
          });
          answer = parts.join('\\n');
        } else {
          var el = f.querySelector('input, textarea');
          if (el) { answer = String(el.value || '').trim(); if (!label) label = labelFor(el); }
          var reqEl = f.querySelector('[data-required]');
          if (reqEl && !answer) missing.push(label + ' (' + sec.title + ')');
        }
        rows += '<div class="rev-row"><div class="q">' + esc(label) + '</div><div class="a' + (answer ? '' : ' blank') +
          '">' + esc(answer || 'Left blank') + '</div></div>';
      });
      html += '<div class="rev-sec"><div class="rev-sec-head"><h3>' + esc(sec.title) +
        '</h3><button type="button" class="rev-edit" data-jump="' + esc(sec.id) + '">Change this section</button></div>' + rows + '</div>';
    });
    document.getElementById('revList').innerHTML = html;
    document.querySelectorAll('.rev-edit').forEach(function (b) {
      b.addEventListener('click', function () { goToMode(b.dataset.jump); });
    });
    var box = document.getElementById('revMissing');
    if (missing.length) {
      box.textContent = 'Still needed before this can send: ' + missing.join(', ') + '.';
      box.classList.add('show');
    } else {
      box.classList.remove('show');
    }
    document.getElementById('sendBtn').disabled = missing.length > 0;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ---- send ----
     Two destinations on purpose.
     1. A real Netlify Forms post, urlencoded to /, the same mechanism
        that already delivers Melody's onboarding answers today. The
        matching shadow form lives in public/forms/discovery-brief.html
        or Netlify never registers the fields and they vanish silently.
     2. A JSON post to the intake function, which writes an inspectable
        record under data/staging/discovery-briefs/. That is what makes
        a submission findable on Melody's own machine rather than
        only inside someone's Netlify dashboard. */
  function readable(data) {
    var lines = [];
    SECTIONS.forEach(function (sec) {
      lines.push('== ' + sec.title + ' ==');
      Object.keys(data).forEach(function (k) {
        if (k.indexOf(sec.id + '.') !== 0) return;
        var v = data[k];
        lines.push('- ' + k.slice(sec.id.length + 1) + ': ' + (Array.isArray(v) ? v.join(', ') : v));
      });
      lines.push('');
    });
    return lines.join('\\n');
  }

  document.getElementById('sendBtn').addEventListener('click', function () {
    var btn = this;
    btn.disabled = true;
    btn.textContent = 'Sending...';
    var data = collect();
    var payload = {
      variant: VARIANT,
      slug: SLUG,
      submittedAt: new Date().toISOString(),
      answers: data,
      readable: readable(data)
    };

    /* Inside a portal, the answers belong on that client's record, where
       Melody already reads everything else about them. That post is the
       one that matters, so it is the one whose result decides success.
       Netlify Forms and the staging file stay as the belt and braces they
       were built to be. */
    var portalPost = SLUG
      ? fetch('/.netlify/functions/portal?slug=' + encodeURIComponent(SLUG), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ action: 'save-brief', answers: data, readable: payload.readable, submit: true })
        }).then(function (r) { return r.json(); }).then(function (d) { return !!(d && d.ok); }).catch(function () { return false; })
      : Promise.resolve(null);

    var encoded = new URLSearchParams();
    encoded.append('form-name', FORM_NAME);
    encoded.append('variant', VARIANT);
    encoded.append('org_name', data['org.org_name'] || '');
    encoded.append('contact_name', data['org.contact_name'] || '');
    encoded.append('contact_email', data['org.contact_email'] || '');
    encoded.append('current_url', data['current.current_url'] || '');
    encoded.append('brief_readable', payload.readable);
    encoded.append('brief_json', JSON.stringify(data));

    // Posted at the shadow file's own path rather than at /, because /
    // is now the entry page and is served by a function. Netlify Forms
    // accepts a submission at any static path on the site, and this is
    // the exact path the form is registered from, so the two can never
    // drift apart.
    var netlifyPost = fetch('/forms/discovery-brief.html', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: encoded.toString()
    }).then(function (r) { return r.ok; }).catch(function () { return false; });

    var stagePost = fetch('/.netlify/functions/intake?view=submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); }).catch(function () { return { ok: false }; });

    Promise.all([netlifyPost, stagePost, portalPost]).then(function (res) {
      var staged = res[1] && res[1].ok;
      // In a portal, the portal write is the real one. Outside it, the
      // old two destination rule still applies unchanged.
      if (SLUG && !res[2]) {
        btn.disabled = false;
        btn.textContent = 'Send my brief';
        var portalBox = document.getElementById('revMissing');
        portalBox.textContent = 'That did not send. Your answers are still saved here, please try again in a moment.';
        portalBox.classList.add('show');
        return;
      }
      if (!SLUG && !res[0] && !staged) {
        btn.disabled = false;
        btn.textContent = 'Send my brief';
        var box = document.getElementById('revMissing');
        box.textContent = 'That did not send. Your answers are still saved here, please try again in a moment.';
        box.classList.add('show');
        return;
      }
      try { localStorage.removeItem(STORE_KEY); } catch (e) {}
      goToMode('sent');
    });
  });

  /* Deep link back into a step, so a half-finished brief can be
     reopened at the right place rather than from the cover. */
  var hash = (window.location.hash || '').replace('#', '');
  goToMode(STEP_ORDER.indexOf(hash) > 0 && hash !== 'sent' ? hash : 'cover');
})();
</script>
</body>
</html>`;
}

module.exports = { renderBriefForm };
