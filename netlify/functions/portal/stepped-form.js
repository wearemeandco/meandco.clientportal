/* ============================================================
   Me&Co.: one question per screen, for a portal card
   ------------------------------------------------------------
   A card opts in with "form": true plus "formStyle": "stepped", and
   carries its questions in card.questions. portal.js renders this page
   instead of the long onboarding form for that card.

   Everything structural is reused, nothing is restated:
   - the page shell, progress rail, footer and Back / Continue come from
     step-shell.js (STEP_STYLE, STEP_SCRIPT), the same ones the inquiry
     uses
   - colours, type and radii come from theme.js
   - answers are saved with the same "save-onboarding" action that
     onboarding-form.js uses, so a draft survives leaving and coming
     back, and a real send marks the card complete and writes the
     activity line
   - the send is a real Netlify Form named "<cardId>-<slug>", registered
     by a shadow block in public/forms/onboarding-questions.html, so the
     submission reaches the studio inbox the same way every other portal
     form does

   Question shape (card.questions[]):
     { id, section, text, type: "short" | "long" | "single" | "multi",
       options: [{ label, other?, fill? }] }
   An option with other: true opens a free text box. An option with
   fill: true is a sentence with ___ in it, and the text box fills the
   blank.
   ============================================================ */

const { FONT_LINK, TOKENS, BASE } = require('./theme.js');
const { STEP_STYLE, STEP_SCRIPT } = require('./step-shell.js');

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// JSON that is safe to place inside a script tag.
function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

// The one phrase that always counts as an answer.
const NOT_SURE = "Not sure yet, let's talk about it";

const EXTRA_STYLE = `
  .exit-link {
    display: inline-flex; align-items: center; min-height: 44px; margin-bottom: 0.4rem;
    font-family: var(--mono); font-size: 0.68rem; font-weight: 700; letter-spacing: 0.08em;
    text-transform: uppercase; color: var(--ink-soft); text-decoration: none;
  }
  .exit-link:hover { color: var(--oxford); text-decoration: underline; }
  .step-dots { display: none; }
  .save-state { flex: 1; text-align: center; font-family: var(--mono); font-size: 0.64rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-faint); min-width: 0; }
  .save-state.bad { color: #8f3517; }
  .choice-row.stack { flex-direction: column; flex-wrap: nowrap; }
  .choice-row.stack .choice { width: 100%; }
  .other-box { display: none; margin-top: 0.7rem; }
  .other-box.show { display: block; animation: fadeUp 0.35s var(--ease-out) both; }
  .q-error { margin: 0.8rem 0 0; font-size: 0.9rem; font-weight: 700; color: #8f3517; }
  .q-error:empty { display: none; }
  .btn[aria-disabled="true"] { opacity: 0.45; cursor: not-allowed; }
  .btn[aria-disabled="true"]:hover { transform: none; }
  .notsure-btn { display: inline-flex; align-items: center; min-height: 44px; margin-top: 0.7rem; padding: 0 1rem; background: var(--white); border: 1.5px solid var(--ink-faint); border-radius: var(--radius-btn); font-family: var(--display); font-weight: 600; font-size: 0.9rem; color: var(--ink-soft); cursor: pointer; }
  .notsure-btn:hover { border-color: var(--oxford); color: var(--oxford); }
  .notsure-btn[aria-pressed="true"] { background: var(--oxford); border-color: var(--oxford); color: var(--white); }
  .notsure-btn[aria-pressed="true"]::before { content: "\\2713"; margin-right: 8px; font-weight: 700; }
  .rev-a.need { color: #8f3517; font-style: normal; font-weight: 700; }
  .q-note { margin: 1rem 0 0; font-size: 0.88rem; color: var(--ink-faint); }
  .q-hint { font-family: var(--mono); font-size: 0.64rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-faint); margin: 1.1rem 0 0.5rem; }
  .cover-shell .btn { margin-top: 0.4rem; }
  .rev-sec { margin-top: 1.4rem; }
  .rev-sec h3 { font-family: var(--mono); font-size: 0.68rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--oxford); margin: 0 0 0.3rem; }
  .rev-row { border-top: var(--rule-soft); padding: 0.8rem 0; display: flex; gap: 0.8rem; justify-content: space-between; align-items: flex-start; }
  .rev-q { font-family: var(--display); font-weight: 700; font-size: 0.92rem; color: var(--oxford); margin: 0; }
  .rev-a { margin: 0.2rem 0 0; font-size: 0.92rem; color: var(--ink); white-space: pre-wrap; }
  .rev-a.blank { color: var(--ink-faint); font-style: italic; }
  .rev-edit { flex: none; min-height: 44px; min-width: 44px; background: none; border: 0; padding: 0 0.2rem; font-family: var(--display); font-weight: 700; font-size: 0.85rem; color: var(--blue-ink); cursor: pointer; text-decoration: underline; }
  .rev-summary { background: var(--paper); border: var(--rule-soft); border-radius: var(--radius-sm); padding: 0.9rem 1.1rem; font-size: 0.9rem; color: var(--ink-soft); margin-top: 1rem; }
  .rev-actions { display: flex; gap: 0.8rem; flex-wrap: wrap; margin-top: 1.4rem; }
  @media (max-width: 560px) { .step-footer-inner { gap: 6px; } .save-state { font-size: 0.58rem; } }
`;

function questionPanel(q, index, total) {
  const isChoice = q.type === 'single' || q.type === 'multi';
  const name = escapeHtml(q.id);
  const last = index === total - 1;
  let field = '';
  if (q.type === 'short') {
    field = `<label class="field"><span class="field-title" style="position:absolute;left:-9999px">${escapeHtml(q.text)}</span><input type="text" name="${name}" data-q="${name}" autocomplete="off" maxlength="300"></label><button type="button" class="notsure-btn" data-notsure-btn="${name}" aria-pressed="false">${escapeHtml(NOT_SURE)}</button>`;
  } else if (q.type === 'long') {
    field = `<label class="field"><span class="field-title" style="position:absolute;left:-9999px">${escapeHtml(q.text)}</span><textarea name="${name}" data-q="${name}" rows="6" maxlength="5000"></textarea></label><button type="button" class="notsure-btn" data-notsure-btn="${name}" aria-pressed="false">${escapeHtml(NOT_SURE)}</button>`;
  } else if (isChoice) {
    const kind = q.type === 'multi' ? 'checkbox' : 'radio';
    const opts = (q.options || [])
      .concat([{ label: NOT_SURE, notSure: true }])
      .map(
        (o, i) => `<label class="choice"><input type="${kind}" name="${name}" value="${escapeHtml(o.label)}" data-q="${name}" data-other="${o.other || o.fill ? '1' : ''}" data-fill="${o.fill ? '1' : ''}" data-notsure="${o.notSure ? '1' : ''}" id="${name}-o${i}"><span>${escapeHtml(o.label)}</span></label>`
      )
      .join('');
    const hasOther = (q.options || []).some((o) => o.other || o.fill);
    const fillOpt = (q.options || []).find((o) => o.fill);
    field = `<div class="field"><div class="choice-row stack" role="${q.type === 'multi' ? 'group' : 'radiogroup'}" aria-label="${escapeHtml(q.text)}">${opts}</div>${
      hasOther
        ? `<div class="other-box" data-other-for="${name}"><label><span class="field-title">${fillOpt ? 'Your domain name' : 'Tell us more'}</span><input type="text" data-other-input="${name}" autocomplete="off" maxlength="300"></label></div>`
        : ''
    }</div>`;
  }
  const hint = q.type === 'multi' ? '<p class="q-hint">Pick all that apply</p>' : q.type === 'single' ? '<p class="q-hint">Pick one</p>' : '';
  return `
<div class="step-panel" data-step-panel="${name}" data-next-label="${last ? 'Review my answers' : 'Continue'}">
  <div class="wrap panel-shell">
    <a class="exit-link" href="/portal/__SLUG__" data-exit>&larr; Back to your portal</a>
    <div class="sheet stagger">
      <p class="eyebrow">${escapeHtml(q.section)} &middot; Question ${index + 1} of ${total}</p>
      <h2 class="step-h2">${escapeHtml(q.text)}</h2>
      ${hint}
      ${field}
      <p class="q-error" id="err-${name}" role="alert" data-err-for="${name}"></p>
      <p class="q-note">Not sure? Choose Not sure yet, and we'll talk it through together on your strategy session.</p>
    </div>
  </div>
</div>`;
}

function renderSteppedForm(client, card, savedAnswers) {
  const questions = Array.isArray(card.questions) ? card.questions : [];
  const total = questions.length;
  const slug = client.slug;
  const formName = card.id + '-' + slug;
  const saved = savedAnswers || {};
  const hasSaved = Object.keys(saved).some((k) => k !== '__sel' && saved[k]);

  const panels = questions.map((q, i) => questionPanel(q, i, total).replace('__SLUG__', encodeURIComponent(slug))).join('\n');
  const shadowFields = questions.map((q) => `<textarea name="${escapeHtml(q.id)}"></textarea>`).join('');

  const body = `
<div class="progress-rail"><div class="progress-fill" id="progressFill"></div></div>
<div class="step-count" id="stepCount"></div>

<div class="step-panel" data-step-panel="cover" data-hide-next>
  <div class="cover-shell">
    <div class="cover-wordmark"><span class="dot"></span>Me&Co.</div>
    <h1 class="cover-h1">${escapeHtml(card.coverTitle || 'Tell us about your marketplace.')}</h1>
    <p class="cover-sub">${total} short questions, one at a time. Your answers save as you go, so you can leave and come back whenever you like. Nothing is sent until you press send on the last screen.</p>
    <button class="btn solid" type="button" data-step-next id="startBtn">${hasSaved ? 'Pick up where you left off' : 'Start'}</button>
    <a class="exit-link" href="/portal/${encodeURIComponent(slug)}" data-exit>&larr; Back to your portal</a>
  </div>
</div>

${panels}

<div class="step-panel" data-step-panel="review" data-hide-next>
  <div class="wrap panel-shell">
    <a class="exit-link" href="/portal/${encodeURIComponent(slug)}" data-exit>&larr; Back to your portal</a>
    <div class="sheet stagger">
      <p class="eyebrow">Last step</p>
      <h2 class="step-h2">Read it back before it goes.</h2>
      <p class="step-blurb">Nothing has been sent yet. Tap Edit on anything you want to change. Every question needs an answer, and Not sure yet always counts.</p>
      <div class="rev-summary" id="revSummary"></div>
      <div id="revList"></div>
      <div class="error-box" id="sendError" role="alert"></div>
      <div class="rev-actions">
        <button class="btn solid" type="button" id="sendBtn" disabled>Send my answers</button>
      </div>
    </div>
  </div>
</div>

<form name="${escapeHtml(formName)}" method="POST" data-netlify="true" action="/forms/thanks.html?slug=${encodeURIComponent(slug)}" id="netlify-form" hidden>
  <input type="hidden" name="form-name" value="${escapeHtml(formName)}" />
  <input type="hidden" name="client" value="${escapeHtml(client.name || '')}" />
  <input type="hidden" name="cardId" value="${escapeHtml(card.id)}" />
  <textarea name="answers-readable"></textarea>
  ${shadowFields}
</form>

<div class="step-footer">
  <div class="step-footer-inner">
    <button class="btn ghost" type="button" id="stepBack" data-step-prev>&larr; Back</button>
    <div class="step-dots" id="stepDots"></div>
    <span class="save-state" id="saveState" aria-live="polite"></span>
    <button class="btn solid" type="button" id="stepNext" data-step-next>Continue</button>
  </div>
</div>`;

  const script = `
(function () {
  var QUESTIONS = ${jsonForScript(questions)};
  var NOT_SURE = ${jsonForScript(NOT_SURE)};
  var SAVED = ${jsonForScript(saved)};
  var SLUG = ${jsonForScript(slug)};
  var CARD_ID = ${jsonForScript(card.id)};
  var LOCAL_KEY = 'mora-stepped-' + SLUG + '-' + CARD_ID;
  var TOTAL = QUESTIONS.length;
  var byId = {};
  QUESTIONS.forEach(function (q) { byId[q.id] = q; });

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return [].slice.call((root || document).querySelectorAll(sel)); }

  /* ---------- reading answers out of the page ---------- */
  function selection(q) {
    var panel = $('[data-step-panel="' + q.id + '"]');
    if (!panel) return null;
    if (q.type === 'short' || q.type === 'long') {
      var el = $('[data-q="' + q.id + '"]', panel);
      return { text: el ? el.value : '' };
    }
    var choices = [];
    $all('input[data-q="' + q.id + '"]', panel).forEach(function (i) { if (i.checked) choices.push(i.value); });
    var otherInput = $('[data-other-input="' + q.id + '"]', panel);
    return { choices: choices, other: otherInput ? otherInput.value : '' };
  }

  function flatten(q, sel) {
    if (!sel) return '';
    if (q.type === 'short' || q.type === 'long') return String(sel.text || '').trim();
    var other = String(sel.other || '').trim();
    var parts = sel.choices.map(function (label) {
      var opt = (q.options || []).filter(function (o) { return o.label === label; })[0] || {};
      if (opt.fill) return other ? label.replace(/_+/, other) : label.replace(/,.*$/, '');
      if (opt.other) return other ? label + ': ' + other : label;
      return label;
    });
    return parts.join(', ');
  }

  function collect() {
    var answers = {};
    var sel = {};
    QUESTIONS.forEach(function (q) {
      var s = selection(q);
      answers[q.id] = flatten(q, s);
      if (q.type === 'single' || q.type === 'multi') sel[q.id] = s;
    });
    answers.__sel = sel;
    return answers;
  }

  /* ---------- is a question answered ---------- */
  function isAnswered(q) {
    var s = selection(q);
    if (!s) return false;
    if (q.type === 'short' || q.type === 'long') return String(s.text || '').trim() !== '';
    if (!s.choices.length) return false;
    var needsText = s.choices.some(function (label) {
      var opt = (q.options || []).filter(function (o) { return o.label === label; })[0];
      return !!(opt && (opt.other || opt.fill));
    });
    return !needsText || String(s.other || '').trim() !== '';
  }
  function isNotSure(q) {
    var s = selection(q);
    if (!s) return false;
    if (q.type === 'short' || q.type === 'long') return String(s.text || '').trim() === NOT_SURE;
    return s.choices.indexOf(NOT_SURE) !== -1;
  }
  function hintFor(q) {
    if (q.type === 'short' || q.type === 'long') return 'Write an answer, or tap Not sure yet';
    var s = selection(q);
    if (s && s.choices.length) return 'Add a few words in the box, or choose Not sure yet';
    return q.type === 'multi' ? 'Pick at least one, or choose Not sure yet' : 'Pick one, or choose Not sure yet';
  }
  function clearHint(qid) {
    var e = $('[data-err-for="' + qid + '"]');
    if (e) e.textContent = '';
  }
  function syncNotSureBtn(qid) {
    var q = byId[qid];
    if (!q || (q.type !== 'short' && q.type !== 'long')) return;
    var b = $('[data-notsure-btn="' + qid + '"]');
    if (b) b.setAttribute('aria-pressed', isNotSure(q) ? 'true' : 'false');
  }
  function refreshNext() {
    var btn = $('#stepNext');
    var q = byId[document.body.getAttribute('data-step')];
    if (!btn) return;
    btn.setAttribute('aria-disabled', q && !isAnswered(q) ? 'true' : 'false');
  }

  /* ---------- putting saved answers back ---------- */
  function restore(data) {
    if (!data) return;
    var sel = data.__sel || {};
    QUESTIONS.forEach(function (q) {
      var panel = $('[data-step-panel="' + q.id + '"]');
      if (!panel) return;
      if (q.type === 'short' || q.type === 'long') {
        var el = $('[data-q="' + q.id + '"]', panel);
        if (el && typeof data[q.id] === 'string') el.value = data[q.id];
        return;
      }
      var s = sel[q.id];
      if (!s) return;
      $all('input[data-q="' + q.id + '"]', panel).forEach(function (i) {
        i.checked = (s.choices || []).indexOf(i.value) !== -1;
        var lab = i.closest('.choice');
        if (lab) lab.classList.toggle('on', i.checked);
      });
      var oi = $('[data-other-input="' + q.id + '"]', panel);
      if (oi && typeof s.other === 'string') oi.value = s.other;
      syncOther(q.id);
    });
    QUESTIONS.forEach(function (q) { syncNotSureBtn(q.id); });
  }

  function syncOther(qid) {
    var panel = $('[data-step-panel="' + qid + '"]');
    var box = $('[data-other-for="' + qid + '"]', panel);
    if (!box) return;
    var on = $all('input[data-q="' + qid + '"]', panel).some(function (i) { return i.checked && i.getAttribute('data-other'); });
    box.classList.toggle('show', on);
  }

  function readLocal() {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null'); } catch (e) { return null; }
  }
  function writeLocal(a) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(a)); } catch (e) {}
  }
  function clearLocal() {
    try { localStorage.removeItem(LOCAL_KEY); } catch (e) {}
  }

  // Answers saved on this device always win. The server copy fills in only
  // on a device that has nothing saved, so it can never replace them.
  var local = readLocal();
  var localHasAnswers = !!local && Object.keys(local).some(function (k) { return k !== '__sel' && local[k]; });
  restore(localHasAnswers ? local : SAVED);

  /* ---------- saving ---------- */
  var saveState = $('#saveState');
  var saveTimer = null;
  var inflight = Promise.resolve();
  var sending = false;
  var lastSent = '';
  function setSave(text, bad) {
    if (!saveState) return;
    saveState.textContent = text;
    saveState.classList.toggle('bad', !!bad);
  }
  function post(submitted) {
    var answers = collect();
    writeLocal(answers);
    return fetch('/.netlify/functions/portal?slug=' + encodeURIComponent(SLUG), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ action: 'save-onboarding', cardId: CARD_ID, answers: answers, submit: !!submitted })
    }).then(function (res) {
      if (!res.ok) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          var err = new Error((body && body.error) || 'That did not save.');
          err.status = res.status;
          throw err;
        });
      }
      return res.json();
    });
  }
  function saveDraft() {
    var snapshot = JSON.stringify(collect());
    if (sending || snapshot === lastSent) return inflight;
    setSave('Saving...');
    inflight = post(false).then(function () {
      lastSent = snapshot;
      setSave('Saved');
    }).catch(function (err) {
      if (err && err.status === 401) setSave('Not saved: open your portal link again', true);
      else setSave('Not saved yet, will retry', true);
    });
    return inflight;
  }
  function scheduleSave() {
    writeLocal(collect());
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDraft, 700);
  }
  document.addEventListener('input', function (e) {
    var t = e.target;
    var qid = t && t.getAttribute && (t.getAttribute('data-q') || t.getAttribute('data-other-input'));
    if (qid) { syncNotSureBtn(qid); clearHint(qid); refreshNext(); }
    if (e.target.closest && e.target.closest('[data-step-panel]')) scheduleSave();
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    var qid = t && t.getAttribute && t.getAttribute('data-q');
    if (qid) {
      var panel = $('[data-step-panel="' + qid + '"]');
      /* Not sure yet and the real choices never sit together. */
      if (t.type === 'checkbox' && t.checked) {
        var tns = t.getAttribute('data-notsure') === '1';
        $all('input[data-q="' + qid + '"]', panel).forEach(function (i) {
          var ns = i.getAttribute('data-notsure') === '1';
          if (i !== t && (tns || ns)) i.checked = false;
        });
      }
      $all('input[data-q="' + qid + '"]', panel).forEach(function (i) {
        var lab = i.closest('.choice');
        if (lab) lab.classList.toggle('on', i.checked);
      });
      syncOther(qid);
      clearHint(qid);
      refreshNext();
    }
    scheduleSave();
  });

  /* The Not sure yet button under a written answer. */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-notsure-btn]');
    if (!b) return;
    var qid = b.getAttribute('data-notsure-btn');
    var el = $('[data-q="' + qid + '"]', $('[data-step-panel="' + qid + '"]'));
    if (!el) return;
    el.value = el.value.trim() === NOT_SURE ? '' : NOT_SURE;
    syncNotSureBtn(qid);
    clearHint(qid);
    refreshNext();
    scheduleSave();
  });
  /* Typing over the phrase replaces it instead of adding to it. */
  document.addEventListener('keydown', function (e) {
    var t = e.target;
    if (!t || !t.getAttribute || !t.getAttribute('data-q')) return;
    if ((t.tagName === 'INPUT' && t.type === 'text') || t.tagName === 'TEXTAREA') {
      if (t.value === NOT_SURE && e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) t.value = '';
    }
  });

  /* Continue waits for an answer, and says why when pressed early. */
  window.MORA_STEP_GUARD = function (id) {
    var q = byId[id];
    if (!q || isAnswered(q)) return true;
    var e = $('[data-err-for="' + id + '"]');
    if (e) { e.textContent = ''; setTimeout(function () { e.textContent = hintFor(q); }, 30); }
    return false;
  };
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('[data-step-next],[data-step-prev]')) { clearTimeout(saveTimer); saveDraft(); }
  });
  $all('[data-exit]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      var href = a.getAttribute('href');
      clearTimeout(saveTimer);
      saveDraft().then(function () { window.location.href = href; });
    });
  });

  /* ---------- progress shows questions, not panels ---------- */
  var obs = new MutationObserver(function () {
    var cur = document.body.getAttribute('data-step');
    refreshNext();
    var idx = QUESTIONS.map(function (q) { return q.id; }).indexOf(cur);
    var count = $('#stepCount');
    var fill = $('#progressFill');
    if (idx >= 0) {
      count.textContent = 'Question ' + (idx + 1) + ' of ' + TOTAL;
      fill.style.width = (((idx + 1) / TOTAL) * 100) + '%';
      var panel = $('[data-step-panel="' + cur + '"]');
      var first = panel && panel.querySelector('input[type="text"], textarea');
      if (first && !(window.matchMedia && window.matchMedia('(pointer: coarse)').matches)) {
        try { first.focus({ preventScroll: true }); } catch (e) {}
      }
    } else if (cur === 'review') {
      count.textContent = 'Last step';
      fill.style.width = '100%';
      buildReview();
    }
  });
  obs.observe(document.body, { attributes: true, attributeFilter: ['data-step'] });
  refreshNext();

  /* Enter moves to the next question from a one line box. */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
    var t = e.target;
    if (t && t.tagName === 'INPUT' && t.type === 'text') {
      e.preventDefault();
      window.MORA_STEP.step(1);
    }
  });

  /* ---------- review ---------- */
  function buildReview() {
    var list = $('#revList');
    list.innerHTML = '';
    var answered = 0;
    var notSure = 0;
    var lastSection = null;
    var wrap = null;
    QUESTIONS.forEach(function (q) {
      var s = selection(q);
      var a = flatten(q, s);
      var done = isAnswered(q);
      if (done) answered += 1;
      if (done && isNotSure(q)) notSure += 1;
      if (q.section !== lastSection) {
        lastSection = q.section;
        wrap = document.createElement('div');
        wrap.className = 'rev-sec';
        var h = document.createElement('h3');
        h.textContent = q.section;
        wrap.appendChild(h);
        list.appendChild(wrap);
      }
      var row = document.createElement('div');
      row.className = 'rev-row';
      var left = document.createElement('div');
      var qq = document.createElement('p'); qq.className = 'rev-q'; qq.textContent = q.text;
      var aa = document.createElement('p'); aa.className = 'rev-a' + (done ? '' : ' need'); aa.textContent = done ? a : 'Needs an answer';
      left.appendChild(qq); left.appendChild(aa);
      var edit = document.createElement('button');
      edit.type = 'button'; edit.className = 'rev-edit'; edit.textContent = 'Edit';
      edit.setAttribute('data-step-go', q.id);
      edit.setAttribute('aria-label', 'Edit your answer to: ' + q.text);
      row.appendChild(left); row.appendChild(edit);
      wrap.appendChild(row);
    });
    var missing = TOTAL - answered;
    $('#revSummary').textContent = answered + ' of ' + TOTAL + ' answered.' +
      (missing ? ' ' + missing + (missing === 1 ? ' question still needs' : ' questions still need') + ' an answer before you can send. Tap Edit on it, or choose Not sure yet.' : '') +
      (notSure ? ' ' + notSure + (notSure === 1 ? ' is' : ' are') + ' marked Not sure yet, and we will talk them through on your strategy session.' : '');
    var sb = $('#sendBtn');
    if (sb && !sending) sb.disabled = missing > 0;
  }

  /* ---------- sending ---------- */
  $('#sendBtn').addEventListener('click', function () {
    if (sending) return;
    if (!QUESTIONS.every(isAnswered)) { buildReview(); return; }
    var btn = this;
    var box = $('#sendError');
    box.classList.remove('show');
    sending = true;
    btn.disabled = true;
    var label = btn.textContent;
    btn.textContent = 'Sending...';
    clearTimeout(saveTimer);
    var form = $('#netlify-form');
    var readable = [];
    var lastSection = null;
    var talk = QUESTIONS.filter(isNotSure);
    if (talk.length) {
      readable.push('To talk through on the strategy session');
      talk.forEach(function (q) { readable.push(q.id.replace('q', '') + '. ' + q.text); });
    }
    QUESTIONS.forEach(function (q) {
      var a = flatten(q, selection(q));
      var ta = form.querySelector('textarea[name="' + q.id + '"]');
      if (ta) ta.value = a;
      if (q.section !== lastSection) { lastSection = q.section; readable.push(''); readable.push(q.section.toUpperCase()); }
      readable.push(q.id.replace('q', '') + '. ' + q.text);
      readable.push('   ' + a);
    });
    form.querySelector('textarea[name="answers-readable"]').value = readable.join('\\n').trim();
    // Netlify Forms is the copy Melody receives. The answers on this device
    // are cleared only after it accepts them.
    inflight.then(function () {
      return fetch('/forms/onboarding-questions.html', { method: 'POST', body: new FormData(form) });
    }).then(function (res) {
      if (!res.ok) { var e = new Error('send'); e.status = res.status; throw e; }
      return post(true).catch(function () { return null; });
    }).then(function () {
      clearLocal();
      window.location.href = form.getAttribute('action');
    }).catch(function (err) {
      sending = false;
      btn.disabled = false;
      btn.textContent = label;
      box.textContent = (err && err.status === 401)
        ? 'Your session has expired, so this did not send. Open your portal link again in a new tab, then come back and press send. Your answers are still here.'
        : 'This did not send, and nothing has been lost. Please try again in a moment, or reply to any email from us and we will take it from there.';
      box.classList.add('show');
    });
  });
})();`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>${escapeHtml(card.label)} &middot; ${escapeHtml(client.name)} &middot; Me&Co.</title>
${FONT_LINK}
<style>
${TOKENS}
${BASE}
${STEP_STYLE}
${EXTRA_STYLE}
</style>
</head>
<body>
${body}
<script>
${STEP_SCRIPT}
${script}
</script>
</body>
</html>`;
}

module.exports = { renderSteppedForm };
