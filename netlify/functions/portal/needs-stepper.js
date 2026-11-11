/* ============================================================
   Me&Co.: "What we need from you", one card at a time
   ------------------------------------------------------------
   A list of seven open questions at once is a wall. Melody said as much:
   she did not know what to do or where to look. So the panel shows one
   thing at a time, "1 of 7", with a bar, Back and Skip for now, and ends
   on a review screen with one Submit. Submit is the signature: every
   answer goes in one write (portal.js, action request-answers), each row
   is checked off on her board, and Mora hears through the client-request
   Netlify Form.

   Step kinds:
     decide   options as big buttons, our pick marked, Something else
     answer   one text box
     approve  See it, then Yes approve or Not yet with a note
     card     a stage that has its own page (an onboarding form, an
              agreement). The step opens it; it is not part of Submit.

   Choices are kept on the device as she goes (localStorage), so leaving
   halfway and coming back keeps them. Nothing reaches us until Submit.
   ============================================================ */

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeUrl(u) {
  return typeof u === 'string' && /^(https?:\/\/|\/)/i.test(u) ? u : null;
}

function stepBody(step) {
  const id = esc(step.id);
  const see = safeUrl(step.seeUrl);
  const seeLink = see ? `<a class="ns-see" href="${esc(see)}" target="_blank" rel="noopener">Look at it first &#8599;</a>` : '';
  if (step.kind === 'decide') {
    const opts = (step.options || []).slice(0, 4).map((o) => `
        <button type="button" class="ns-opt${o.recommended ? ' ns-pick' : ''}" data-ns-choice="${esc(o.label)}">
          <span class="ns-opt-label">${esc(o.label)}</span>
          ${o.detail ? `<span class="ns-opt-detail">${esc(o.detail)}</span>` : ''}
          ${o.recommended ? '<span class="ns-pick-chip">Our pick</span>' : ''}
        </button>`).join('');
    return `${seeLink}
      <div class="ns-opts" role="group" aria-label="Choose one">${opts}</div>
      ${step.other === false ? '' : `<button type="button" class="ns-link" data-ns-other>Something else</button>
      <div class="ns-other" hidden>
        <label class="ns-label" for="ns-other-${id}">Tell us in your own words</label>
        <textarea id="ns-other-${id}" maxlength="1000" placeholder="A few words is enough"></textarea>
        <button type="button" class="ns-next" data-ns-other-save>Use this answer</button>
      </div>`}`;
  }
  if (step.kind === 'answer') {
    return `${seeLink}
      <label class="ns-label" for="ns-ans-${id}">Your answer</label>
      <textarea id="ns-ans-${id}" maxlength="4000" placeholder="Type here. Short is fine."></textarea>
      <button type="button" class="ns-next" data-ns-answer-save>Next</button>`;
  }
  if (step.kind === 'approve') {
    return `${seeLink}
      <div class="ns-opts">
        <button type="button" class="ns-opt ns-pick" data-ns-approve><span class="ns-opt-label">Yes, approve</span><span class="ns-opt-detail">It is right as it is.</span></button>
        <button type="button" class="ns-opt" data-ns-notyet-open><span class="ns-opt-label">Not yet</span><span class="ns-opt-detail">Tell us what to change.</span></button>
      </div>
      <div class="ns-other" hidden>
        <label class="ns-label" for="ns-ny-${id}">What needs to change?</label>
        <textarea id="ns-ny-${id}" maxlength="1000" placeholder="A few words is enough"></textarea>
        <button type="button" class="ns-next" data-ns-notyet-save>Use this answer</button>
      </div>`;
  }
  // card: a stage with its own page
  const action = step.href
    ? `<a class="ns-next ns-go" href="${esc(step.href)}">${esc(step.action || 'Open it')}</a>`
    : `<button type="button" class="ns-next ns-go" data-jump-card="${esc(step.cardId)}">${esc(step.action || 'Open it')}</button>`;
  return `${step.noteHtml ? `<div class="ns-note">${step.noteHtml}</div>` : ''}
      ${action}
      <p class="ns-hint">This one has its own page. Come back here after.</p>`;
}

function needsStepperHtml(steps) {
  const total = steps.length;
  const sendable = steps.filter((s) => s.kind !== 'card').length;
  const cards = steps.map((s, i) => `
    <div class="ns-step" data-ns-step="${i}" data-ns-id="${esc(s.id)}" data-ns-kind="${esc(s.kind)}" data-ns-title="${esc(s.title)}"${i === 0 ? '' : ' hidden'}>
      <p class="ns-where">${esc(s.where || '')}</p>
      <h3 class="ns-q">${esc(s.title)}</h3>
      ${s.why ? `<p class="ns-why">${esc(s.why)}</p>` : ''}
      ${stepBody(s)}
    </div>`).join('');
  return `
  <section class="needs ns" aria-labelledby="needs-heading" data-ns-total="${total}">
    <p class="microlabel">Your next step</p>
    <h2 id="needs-heading">What we need from you</h2>
    <p class="needs-sub">One at a time. ${sendable ? 'Nothing is sent until you press Submit at the end.' : ''}</p>
    <div class="ns-progress" aria-hidden="true"><span class="ns-bar"></span></div>
    <p class="ns-count" aria-live="polite"><span data-ns-pos>1</span> of ${total}</p>
    <div class="ns-stage">
      ${cards}
      <div class="ns-step ns-review" data-ns-review hidden>
        <p class="ns-where">Last step</p>
        <h3 class="ns-q">Check your answers, then submit</h3>
        <ol class="ns-list" data-ns-list></ol>
        <p class="ns-err" role="alert" hidden></p>
        <button type="button" class="ns-submit" data-ns-submit>Submit my answers</button>
        <p class="ns-hint">Submitting is your sign-off. Melody sees it right away.</p>
      </div>
      <div class="ns-step ns-sent" data-ns-sent hidden>
        <p class="ns-tick" aria-hidden="true">&#10003;</p>
        <h3 class="ns-q">Sent. Thank you!</h3>
        <p class="ns-why" data-ns-sent-msg>Everything is checked off, and Melody has it.</p>
      </div>
    </div>
    <div class="ns-nav">
      <button type="button" class="ns-link" data-ns-back hidden>&larr; Back</button>
      <button type="button" class="ns-link ns-skip" data-ns-skip>Skip for now &rarr;</button>
    </div>
  </section>`;
}

const STEPPER_CSS = `
  .ns .needs-sub { margin-bottom: 0.9rem; }
  .ns-progress { height: 8px; background: var(--panel); border-radius: 99px; overflow: hidden; }
  .ns-bar { display: block; height: 100%; width: 0; background: var(--lime); border-right: 2px solid var(--oxford); transition: width 0.35s var(--ease-out); }
  .ns-count { font-family: var(--mono); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--oxford); margin: 0.5rem 0 0; }
  .ns-stage { margin-top: 0.9rem; }
  .ns-step { display: grid; gap: 0.7rem; animation: nsIn 0.3s var(--ease-out); }
  .ns-step[hidden] { display: none; }
  @keyframes nsIn { from { opacity: 0; transform: translateX(14px); } to { opacity: 1; transform: none; } }
  .ns-where { font-family: var(--mono); font-size: 0.68rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--lime-ink); margin: 0; }
  .ns-q { font-size: clamp(1.15rem, 4.2vw, 1.4rem); font-weight: 800; line-height: 1.3; margin: 0; letter-spacing: -0.01em; }
  .ns-why { margin: 0; color: var(--ink-soft); line-height: 1.55; }
  .ns-note { color: var(--ink-soft); line-height: 1.55; }
  .ns-note p { margin: 0 0 0.4rem; }
  .ns-see { justify-self: start; font-family: var(--display); font-weight: 700; color: var(--blue); text-decoration: underline; text-underline-offset: 3px; min-height: 44px; display: inline-flex; align-items: center; }
  .ns-opts { display: grid; gap: 0.55rem; }
  .ns-opt {
    position: relative; display: grid; gap: 0.2rem; text-align: left; width: 100%; min-height: 56px; padding: 0.85rem 1rem; cursor: pointer;
    background: var(--white); color: var(--oxford); border: var(--rule); border-radius: var(--radius-btn); box-shadow: var(--shadow-hard-sm); font-family: var(--sans);
    transition: transform 0.2s var(--ease-spring), box-shadow 0.2s var(--ease-out), background 0.2s;
  }
  .ns-opt:hover { background: var(--panel); transform: translateY(-2px); box-shadow: var(--shadow-hard); }
  .ns-opt.is-chosen { background: var(--lime); box-shadow: var(--shadow-hard); }
  .ns-opt-label { font-family: var(--display); font-weight: 700; font-size: 1.02rem; line-height: 1.3; padding-right: 5.5rem; }
  .ns-opt-detail { font-size: 0.88rem; color: var(--ink-soft); line-height: 1.45; }
  .ns-pick { border-color: var(--blue); }
  .ns-pick-chip { position: absolute; top: 0.8rem; right: 0.8rem; font-family: var(--mono); font-size: 0.62rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; background: var(--blue); color: var(--white); border-radius: var(--radius-pill); padding: 0.2rem 0.45rem; }
  .ns-label { font-family: var(--mono); font-size: 0.68rem; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: var(--oxford); }
  .ns textarea { width: 100%; min-height: 6rem; padding: 0.75rem 0.85rem; font: inherit; font-size: 1rem; color: var(--ink); background: var(--white); border: var(--rule); border-radius: var(--radius-sm); resize: vertical; }
  .ns-other { display: grid; gap: 0.55rem; }
  .ns-other[hidden] { display: none; }
  .ns-next, .ns-submit {
    justify-self: start; display: inline-flex; align-items: center; justify-content: center; min-height: 50px; padding: 0.6rem 1.4rem; cursor: pointer; text-decoration: none;
    font-family: var(--display); font-weight: 700; font-size: 1rem; border-radius: var(--radius-btn);
    background: var(--oxford); color: var(--white); border: var(--rule);
  }
  .ns-submit { background: var(--lime); color: var(--oxford); box-shadow: var(--shadow-hard); width: 100%; font-size: 1.05rem; min-height: 56px; }
  .ns-submit[disabled] { opacity: 0.6; cursor: progress; }
  .ns-link { background: none; border: 0; padding: 0.4rem 0.1rem; min-height: 44px; cursor: pointer; font-family: var(--display); font-weight: 700; font-size: 0.92rem; color: var(--oxford); text-decoration: underline; text-underline-offset: 3px; justify-self: start; }
  .ns-link[hidden] { display: none; }
  .ns-nav { display: flex; justify-content: space-between; gap: 1rem; margin-top: 0.8rem; border-top: var(--rule-soft); padding-top: 0.4rem; }
  .ns-skip { margin-left: auto; color: var(--ink-soft); }
  .ns-hint { margin: 0; font-size: 0.86rem; color: var(--ink-faint); }
  .ns-list { margin: 0; padding: 0; list-style: none; display: grid; gap: 0.5rem; }
  .ns-list li { display: grid; grid-template-columns: 1fr auto; gap: 0.15rem 0.8rem; align-items: start; padding: 0.75rem 0.9rem; background: var(--panel); border-radius: var(--radius-sm); }
  .ns-list .ns-lq { font-size: 0.9rem; color: var(--ink-soft); }
  .ns-list .ns-la { font-family: var(--display); font-weight: 700; color: var(--oxford); grid-column: 1; }
  .ns-list .ns-la.is-empty { color: var(--ink-faint); font-family: var(--sans); font-weight: 500; font-style: italic; }
  .ns-list .ns-change { grid-row: 1 / span 2; grid-column: 2; align-self: center; }
  .ns-err { margin: 0; color: #a3271b; }
  .ns-err[hidden] { display: none; }
  .ns-tick { margin: 0; width: 3rem; height: 3rem; border-radius: 50%; display: grid; place-items: center; background: var(--green-bg); color: var(--green); border: 2px solid var(--green); font-size: 1.5rem; font-weight: 700; }
  .ns.is-sent .ns-nav, .ns.is-sent .ns-count { display: none; }
`;

function stepperScript(slug, clientName) {
  return `
(function () {
  var root = document.querySelector('.ns'); if (!root) return;
  var SLUG = ${JSON.stringify(String(slug))};
  var CLIENT = ${JSON.stringify(String(clientName || ''))};
  var KEY = 'mora_needs_' + SLUG;
  var steps = Array.prototype.slice.call(root.querySelectorAll('[data-ns-step]'));
  var review = root.querySelector('[data-ns-review]');
  var sent = root.querySelector('[data-ns-sent]');
  var bar = root.querySelector('.ns-bar');
  var pos = root.querySelector('[data-ns-pos]');
  var back = root.querySelector('[data-ns-back]');
  var skip = root.querySelector('[data-ns-skip]');
  var total = steps.length;
  var at = 0;
  var answers = {};
  try { answers = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { answers = {}; }
  var ids = steps.map(function (s) { return s.dataset.nsId; });
  Object.keys(answers).forEach(function (k) { if (ids.indexOf(k) === -1) delete answers[k]; });
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(answers)); } catch (e) {} }
  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }

  function paintChosen(step) {
    var a = answers[step.dataset.nsId];
    step.querySelectorAll('[data-ns-choice]').forEach(function (b) { b.classList.toggle('is-chosen', !!a && a.kind === 'decide' && a.text === b.getAttribute('data-ns-choice')); });
    var ap = step.querySelector('[data-ns-approve]'); if (ap) ap.classList.toggle('is-chosen', !!a && a.kind === 'approve');
    var ta = step.querySelector('textarea');
    if (ta && a && !ta.value) {
      if (a.kind === 'answer' || a.kind === 'not_yet') ta.value = a.text;
      if (a.kind === 'decide' && a.text === 'Something else') ta.value = a.note || '';
    }
  }
  function show(i, quiet) {
    at = i;
    steps.forEach(function (s, k) { s.hidden = k !== i; });
    review.hidden = i !== total;
    var shown = Math.min(i + 1, total);
    pos.textContent = i >= total ? total : shown;
    bar.style.width = Math.round(((i >= total ? total : i) / total) * 100) + '%';
    back.hidden = i === 0;
    skip.hidden = i >= total;
    if (i < total) paintChosen(steps[i]); else buildReview();
    if (!quiet) root.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function next() { show(at + 1); }
  function choose(step, a) {
    answers[step.dataset.nsId] = a; persist(); paintChosen(step);
    setTimeout(next, 280);
  }
  function label(a) {
    if (!a) return null;
    if (a.kind === 'decide') return a.text === 'Something else' ? a.note : a.text;
    if (a.kind === 'approve') return 'Yes, approve';
    if (a.kind === 'not_yet') return 'Not yet: ' + a.text;
    return a.text;
  }
  function buildReview() {
    var list = review.querySelector('[data-ns-list]');
    list.innerHTML = steps.map(function (s, i) {
      if (s.dataset.nsKind === 'card') return '<li><span class="ns-lq">' + esc(s.dataset.nsTitle) + '</span><span class="ns-la is-empty">On its own page</span><button type="button" class="ns-link ns-change" data-ns-goto="' + i + '">Open</button></li>';
      var l = label(answers[s.dataset.nsId]);
      return '<li><span class="ns-lq">' + esc(s.dataset.nsTitle) + '</span><span class="ns-la' + (l ? '' : ' is-empty') + '">' + (l ? esc(l) : 'Skipped, still open') + '</span><button type="button" class="ns-link ns-change" data-ns-goto="' + i + '">' + (l ? 'Change' : 'Answer') + '</button></li>';
    }).join('');
    var n = Object.keys(answers).length;
    var btn = review.querySelector('[data-ns-submit]');
    btn.disabled = !n;
    btn.textContent = n ? 'Submit my answers (' + n + ')' : 'Answer at least one to submit';
  }

  root.addEventListener('click', function (e) {
    var t = e.target;
    var step = t.closest('[data-ns-step]');
    var c = t.closest('[data-ns-choice]');
    if (c && step) return choose(step, { kind: 'decide', text: c.getAttribute('data-ns-choice') });
    if (t.closest('[data-ns-other]')) { var o = step.querySelector('.ns-other'); o.hidden = false; o.querySelector('textarea').focus(); return; }
    if (t.closest('[data-ns-other-save]')) { var v = step.querySelector('.ns-other textarea').value.trim(); if (!v) return step.querySelector('.ns-other textarea').focus(); return choose(step, { kind: 'decide', text: 'Something else', note: v }); }
    if (t.closest('[data-ns-answer-save]')) { var v2 = step.querySelector('textarea').value.trim(); if (!v2) return step.querySelector('textarea').focus(); return choose(step, { kind: 'answer', text: v2 }); }
    if (t.closest('[data-ns-approve]')) return choose(step, { kind: 'approve', text: '' });
    if (t.closest('[data-ns-notyet-open]')) { var o2 = step.querySelector('.ns-other'); o2.hidden = false; o2.querySelector('textarea').focus(); return; }
    if (t.closest('[data-ns-notyet-save]')) { var v3 = step.querySelector('.ns-other textarea').value.trim(); if (!v3) return step.querySelector('.ns-other textarea').focus(); return choose(step, { kind: 'not_yet', text: v3 }); }
    if (t.closest('[data-ns-back]')) return show(Math.max(0, at - 1));
    if (t.closest('[data-ns-skip]')) return next();
    var g = t.closest('[data-ns-goto]');
    if (g) return show(Number(g.getAttribute('data-ns-goto')));
    if (t.closest('[data-ns-submit]')) return submit(t.closest('[data-ns-submit]'));
  });

  function submit(btn) {
    var err = review.querySelector('.ns-err'); err.hidden = true;
    var list = Object.keys(answers).map(function (id) { var a = answers[id]; return { id: id, kind: a.kind, text: a.text, note: a.note || '' }; });
    if (!list.length) return;
    btn.disabled = true; btn.textContent = 'Sending...';
    fetch('/.netlify/functions/portal?slug=' + encodeURIComponent(SLUG), {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'request-answers', answers: list })
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (j) {
        if (!res.ok || !j.ok) throw new Error((j && j.error) || 'That did not send. Please try again in a moment.');
        return j;
      });
    }).then(function (j) {
      var summary = steps.filter(function (s) { return answers[s.dataset.nsId]; }).map(function (s) { return s.dataset.nsTitle + ': ' + label(answers[s.dataset.nsId]); }).join('\\n');
      var fd = new FormData();
      fd.append('form-name', 'client-request'); fd.append('client', CLIENT); fd.append('slug', SLUG);
      fd.append('board', 'https://clients.weareme.co/portal/' + encodeURIComponent(SLUG) + '/requests');
      fd.append('kind', 'answers'); fd.append('request', 'What we need from you: ' + j.saved.length + ' answered'); fd.append('note', summary);
      fetch('/forms/client-request.html', { method: 'POST', body: fd }).catch(function () {});
      try { localStorage.removeItem(KEY); } catch (e) {}
      var left = steps.filter(function (s) { return !answers[s.dataset.nsId] && s.dataset.nsKind !== 'card'; }).length;
      root.querySelector('[data-ns-sent-msg]').textContent = 'Everything you answered is checked off, and Melody has it.' + (left ? ' ' + left + ' still open for later.' : '');
      steps.forEach(function (s) { s.hidden = true; }); review.hidden = true; sent.hidden = false;
      bar.style.width = '100%'; root.classList.add('is-sent');
    }).catch(function (ex) { btn.disabled = false; buildReview(); err.textContent = ex.message; err.hidden = false; });
  }

  // Resume where she left off: first step without an answer.
  var first = 0;
  while (first < total && answers[steps[first].dataset.nsId]) first++;
  if (first > 0) show(first, true); else { bar.style.width = '0%'; paintChosen(steps[0]); }
})();`;
}

module.exports = { needsStepperHtml, STEPPER_CSS, stepperScript };
