/* ============================================================
   Me&Co. — the stepped, animated page shell
   ------------------------------------------------------------
   The animation and layout mechanics from
   public/proposals/melody-project2.html, the live quality bar,
   pulled out so more than one page can be built to it instead of
   each new page inventing its own worse version. Used by the
   /start entry point, the stage 1 inquiry, and the stage 2
   discovery brief.

   What it gives a page:
   - a fixed progress rail and a "Step n of m" chip that track the
     real position, not a decorative bar
   - panels that cross fade and rise on entry, with their children
     staggered, so a long form arrives a piece at a time instead of
     as a wall
   - a fixed footer with Back and Continue, which is what makes a
     multi step form feel like one object rather than a series of
     pages
   - real form furniture: fields, choice chips, multi select cards,
     all sized for a thumb on a phone (52px minimum targets)

   Motion rules, deliberate:
   - every animation is entrance only, nothing loops except the one
     cover arrow, because a looping animation next to a text field
     is exactly the "not adhd friendly" complaint that started this
   - prefers-reduced-motion turns all of it off, including the
     stagger delays, rather than merely shortening it

   Colour tokens come from theme.js, this file never restates them.
   ============================================================ */

const STEP_STYLE = `
  /* ---------- progress ---------- */
  .progress-rail { position: fixed; top: 0; left: 0; right: 0; height: 3px; background: var(--panel-2); z-index: 3000; }
  .progress-fill { height: 100%; width: 0; background: var(--blue); transition: width 0.55s cubic-bezier(0.65, 0, 0.35, 1); }
  .step-count {
    position: fixed; top: 12px; right: 16px; z-index: 3000;
    font-family: var(--mono); font-size: 0.68rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--ink-faint); background: var(--paper); padding: 5px 12px; border-radius: 12px; border: 1px solid var(--panel-2);
  }
  body.is-cover .step-count { display: none; }

  /* ---------- panels ---------- */
  .step-panel { display: none; }
  .step-panel.active { display: block; animation: panelIn 0.5s var(--ease-out) both; }
  @keyframes panelIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }

  /* The .stagger rules and the riseIn keyframe that used to live here
     were a near-duplicate of the ones now in theme.js, on a curve
     (cubic-bezier(0.16, 1, 0.3, 1)) the website uses nowhere. Because
     they were declared after BASE they silently won, so the onboarding
     flow would have kept its own easing while every other page moved to
     the site's. Deleted: theme.js owns the stagger for all pages. */

  .wrap { max-width: 44rem; margin: 0 auto; padding: 0 clamp(18px, 5vw, 28px); }
  .sheet {
    background: var(--white); border: var(--rule); border-radius: var(--radius); box-shadow: var(--shadow-hard);
    padding: clamp(26px, 6vw, 52px) clamp(22px, 5.5vw, 48px);
  }
  .panel-shell { padding: clamp(28px, 7vw, 56px) 0 40px; }
  body:not(.is-cover) { padding-bottom: 88px; }

  /* ---------- cover ---------- */
  .cover-shell {
    min-height: 88vh; min-height: 88svh; display: flex; flex-direction: column;
    align-items: center; justify-content: center; text-align: center; gap: 22px;
    padding: 56px 22px; max-width: 40rem; margin: 0 auto;
  }
  .cover-wordmark {
    display: inline-flex; align-items: center; gap: 10px;
    font-family: var(--display); font-weight: 800; font-size: 1.15rem; color: var(--oxford);
    background: var(--white); border: var(--rule); border-radius: 999px;
    padding: 10px 22px 10px 16px; box-shadow: var(--shadow-hard-sm);
  }
  .cover-wordmark .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--lime); flex: none; }
  .cover-h1 { font-size: clamp(1.9rem, 5.4vw, 2.9rem); line-height: 1.08; max-width: 17ch; letter-spacing: -0.02em; }
  .cover-sub { color: var(--ink-soft); font-size: 1.03rem; max-width: 46ch; margin: 0; }
  .cover-credit { margin: 0; font-size: 0.78rem; font-weight: 600; letter-spacing: 0.03em; color: var(--ink-faint); }
  .cover-arrow {
    margin-top: 6px; width: 52px; height: 52px; border-radius: 50%;
    border: 1.5px solid var(--blue); background: none; color: var(--blue); font-size: 1.3rem; cursor: pointer;
    display: flex; align-items: center; justify-content: center; animation: coverBounce 2s ease-in-out infinite;
  }
  .cover-arrow:hover { background: var(--blue); color: var(--white); }
  @keyframes coverBounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(6px); } }

  /* ---------- headings inside a step ---------- */
  .eyebrow {
    font-family: var(--mono); font-size: 0.68rem; font-weight: 700; letter-spacing: 0.12em;
    text-transform: uppercase; color: var(--lime-ink); margin: 0;
  }
  .step-h2 { font-size: clamp(1.4rem, 4.2vw, 1.9rem); margin: 0.45rem 0 0; letter-spacing: -0.015em; text-wrap: balance; }
  .step-blurb { color: var(--ink-soft); font-size: 0.98rem; margin: 0.55rem 0 0; max-width: 52ch; }

  /* ---------- fields ---------- */
  .field { display: block; margin-top: 1.5rem; }
  .field-title { display: block; font-family: var(--display); font-weight: 700; font-size: 1rem; color: var(--oxford); margin-bottom: 0.35rem; }
  .field-help { display: block; color: var(--ink-faint); font-size: 0.85rem; margin-bottom: 0.5rem; }
  .field .optional { font-family: var(--mono); font-size: 0.62rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-faint); margin-left: 8px; }
  input[type="text"], input[type="email"], input[type="url"], input[type="tel"], input[type="password"], textarea {
    width: 100%; font-family: var(--sans); font-size: 16px; color: var(--ink);
    background: var(--paper); border: 1px solid var(--panel-2); border-radius: var(--radius-sm);
    padding: 13px 15px; outline: none; min-height: 52px; resize: vertical;
    transition: border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
  }
  textarea { line-height: 1.6; }
  input:focus, textarea:focus { border-color: var(--oxford); background: var(--white); box-shadow: 0 0 0 4px rgba(30, 69, 251, 0.08); }

  .choice-row { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 0.2rem; }
  .choice {
    position: relative; display: inline-flex; align-items: center; min-height: 48px;
    padding: 11px 17px; border-radius: var(--radius-btn); cursor: pointer;
    background: var(--paper); border: 1px solid var(--panel-2); color: var(--ink-soft);
    font-size: 0.92rem; transition: transform 0.25s var(--ease-spring), background 0.16s ease, border-color 0.16s ease, color 0.16s ease;
  }
  .choice input { position: absolute; opacity: 0; pointer-events: none; }
  .choice:hover { border-color: var(--oxford); transform: translateY(-1px); }
  .choice.on { background: var(--oxford); border-color: var(--oxford); color: var(--white); }
  .choice.on::before { content: "\\2713"; margin-right: 8px; font-weight: 700; }

  .tier-grid { display: grid; gap: 10px; margin-top: 0.4rem; grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr)); }
  .tier {
    position: relative; display: block; cursor: pointer; text-align: left;
    background: var(--paper); border: 1px solid var(--panel-2); border-radius: var(--radius-sm); padding: 16px 18px;
    transition: transform 0.25s var(--ease-spring), border-color 0.16s ease, background 0.16s ease, box-shadow 0.16s ease;
  }
  .tier input { position: absolute; opacity: 0; pointer-events: none; }
  .tier:hover { transform: translateY(-2px); border-color: var(--oxford); }
  .tier.on { border-color: var(--blue); background: var(--white); box-shadow: 0 0 0 3px rgba(30, 69, 251, 0.14); }
  .tier b { display: block; font-family: var(--display); font-size: 1rem; color: var(--oxford); }
  .tier .price { display: block; font-family: var(--mono); font-size: 0.82rem; font-weight: 700; color: var(--blue-ink); margin-top: 3px; }
  .tier span.note { display: block; font-size: 0.85rem; color: var(--ink-soft); margin-top: 6px; }

  /* ---------- footer nav ---------- */
  .step-footer {
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 2500;
    background: var(--white); border-top: 1px solid var(--panel-2); box-shadow: 0 -12px 30px -20px rgba(10, 35, 66, 0.35);
  }
  body.is-cover .step-footer { display: none; }
  .step-footer-inner {
    max-width: 44rem; margin: 0 auto; display: flex; align-items: center; justify-content: space-between;
    gap: 10px; padding: 12px clamp(16px, 5vw, 28px);
  }
  .step-dots { display: flex; gap: 6px; }
  .step-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--panel-2); transition: background 0.3s ease, transform 0.3s ease; }
  .step-dot.on { background: var(--blue); transform: scale(1.3); }
  .btn {
    font-family: var(--display); font-weight: 700; font-size: 0.92rem; min-height: 48px;
    border: 1.5px solid var(--oxford); background: none; color: var(--oxford);
    border-radius: var(--radius-btn); padding: 11px 22px; cursor: pointer; white-space: nowrap;
    transition: background 0.18s ease, color 0.18s ease, opacity 0.18s ease;
  }
  .btn:hover { background: var(--panel); }
  .btn.solid { background: var(--oxford); border-color: var(--oxford); color: var(--white); }
  .btn.solid:hover { background: #061529; }
  .btn[disabled] { opacity: 0.5; pointer-events: none; }
  .btn.ghost { border-color: var(--panel-2); color: var(--ink-soft); }

  .error-box {
    display: none; margin-top: 1rem; background: #FBEDE7; border: 1px solid #E8B7A2; color: #8f3517;
    border-radius: var(--radius-sm); padding: 11px 13px; font-size: 0.9rem;
  }
  .error-box.show { display: block; animation: fadeUp 0.3s var(--ease-out) both; }
  .field.invalid input, .field.invalid textarea { border-color: #c05c33; background: #FDF5F1; }

  @media (max-width: 560px) {
    .step-footer-inner { padding: 10px 14px; }
    .btn { padding: 11px 16px; font-size: 0.88rem; }
  }

  @media (prefers-reduced-motion: reduce) {
    .step-panel.active, .stagger > *, .error-box.show { animation: none; }
    .stagger > * { animation-delay: 0s; }
    .cover-arrow { animation: none; }
    .progress-fill, .choice, .tier, .step-dot, input, textarea { transition: none; }
  }`;

/* Generic stepped navigation. Panels are read from the DOM in source
   order, so a page adds or removes a step by adding or removing markup,
   never by also remembering to update a list in two places.

   A page can refuse an advance by defining window.MORA_STEP_GUARD(fromId),
   returning true to allow. That is how the inquiry enforces its three
   genuinely required fields without turning the whole form into a
   browser-native validation wall. */
const STEP_SCRIPT = `
(function () {
  var panels = [].slice.call(document.querySelectorAll('[data-step-panel]'));
  var ids = panels.map(function (p) { return p.getAttribute('data-step-panel'); });
  var fill = document.getElementById('progressFill');
  var count = document.getElementById('stepCount');
  var dots = document.getElementById('stepDots');
  var backBtn = document.getElementById('stepBack');
  var nextBtn = document.getElementById('stepNext');
  var current = ids[0];
  // A cover is scenery, not a step, so it gets no dot and no Back button.
  // Pages without a cover (the inquiry, the brief) start on a real step.
  var hasCover = ids[0] === 'cover';
  var dotIds = ids.filter(function (id) { return id !== 'cover'; });

  if (dots) {
    dots.innerHTML = dotIds.map(function () { return '<span class="step-dot"></span>'; }).join('');
  }

  function render() {
    var i = ids.indexOf(current);
    if (i < 0) i = 0;
    panels.forEach(function (p) { p.classList.toggle('active', p.getAttribute('data-step-panel') === current); });
    document.body.classList.toggle('is-cover', i === 0 && hasCover);
    document.body.setAttribute('data-step', current);
    var pos = dotIds.indexOf(current);
    var total = dotIds.length;
    if (fill) fill.style.width = (((pos + 1) / total) * 100) + '%';
    if (count) count.textContent = pos < 0 ? '' : 'Step ' + (pos + 1) + ' of ' + total;
    if (dots) {
      [].slice.call(dots.children).forEach(function (d, n) { d.classList.toggle('on', n <= pos); });
    }
    if (backBtn) backBtn.style.visibility = i <= (hasCover ? 1 : 0) ? 'hidden' : 'visible';
    if (nextBtn) {
      var last = i === ids.length - 1;
      nextBtn.style.visibility = last || panels[i].hasAttribute('data-hide-next') ? 'hidden' : 'visible';
      nextBtn.textContent = panels[i].getAttribute('data-next-label') || 'Continue';
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goTo(id) {
    if (ids.indexOf(id) === -1) return;
    current = id;
    render();
  }

  function step(delta) {
    var i = ids.indexOf(current);
    if (delta > 0 && typeof window.MORA_STEP_GUARD === 'function' && !window.MORA_STEP_GUARD(current)) return;
    goTo(ids[Math.min(ids.length - 1, Math.max(0, i + delta))]);
  }

  document.addEventListener('click', function (e) {
    var next = e.target.closest('[data-step-next]');
    if (next) { e.preventDefault(); step(1); return; }
    var prev = e.target.closest('[data-step-prev]');
    if (prev) { e.preventDefault(); step(-1); return; }
    var jump = e.target.closest('[data-step-go]');
    if (jump) { e.preventDefault(); goTo(jump.getAttribute('data-step-go')); }
  });

  /* Chips and cards are real labels wrapping a real input, so the form
     still submits and still works with a keyboard. This only mirrors the
     checked state into a class the CSS can see. */
  function syncChoices() {
    [].slice.call(document.querySelectorAll('.choice, .tier')).forEach(function (el) {
      var input = el.querySelector('input');
      if (input) el.classList.toggle('on', input.checked);
    });
  }
  document.addEventListener('change', syncChoices);
  syncChoices();

  window.MORA_STEP = { goTo: goTo, step: step, current: function () { return current; } };
  render();
})();`;

module.exports = { STEP_STYLE, STEP_SCRIPT };
