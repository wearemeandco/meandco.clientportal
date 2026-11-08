/* ============================================================
   Leave a review: one form, two doors.

   The portal dashboard opens it in a modal for a signed-in client.
   The public page at /review shows it to anyone Melody sends the
   link to, people she has helped who never had a portal, so that
   version also asks for their name, business and email, one
   question per screen.

   Both post the same static Netlify Form, client-review, registered
   by public/forms/client-review.html. source says which door it came
   through: "portal" or "shared link".

   review is the answer to "How was working with Melody?" and is the
   testimonial that can go on the website when publishName is "yes".
   improve is private feedback for Melody, never posted.
   ============================================================ */

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const REVIEW_CSS = `
  .review-form { display: grid; gap: 0.9rem; margin-top: 0.4rem; }
  .review-form[hidden] { display: none; }
  .review-form label { font-family: var(--mono); font-size: 0.7rem; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; display: block; margin-bottom: 0.35rem; }
  .review-form .review-hint { margin: -0.15rem 0 0.4rem; color: var(--ink-faint); font-size: 0.85rem; }
  .review-form textarea, .review-form input[type="text"], .review-form input[type="email"] {
    font: inherit; font-size: 16px; color: var(--ink); background: var(--paper); border: var(--rule-soft);
    border-radius: var(--radius-sm); padding: 0.7rem 0.8rem; width: 100%;
  }
  .review-form textarea { min-height: 7rem; resize: vertical; }
  .review-form textarea:focus, .review-form input[type="text"]:focus, .review-form input[type="email"]:focus { border-color: var(--oxford); background: var(--white); outline: none; }
  .review-step { display: grid; gap: 0.9rem; }

  /* ---- One question per screen ---- */
  .review-form-stepped .review-step { display: none; }
  .review-form-stepped .review-step.is-active { display: grid; animation: reviewStepIn 0.45s var(--ease-out, ease-out) both; }
  @keyframes reviewStepIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
  .review-form-stepped label[for] { font-family: var(--display); font-size: clamp(1.15rem, 4.5vw, 1.35rem); font-weight: 700; letter-spacing: -0.01em; text-transform: none; margin-bottom: 0.5rem; }
  .review-form-stepped .review-step > div > label:not([for]) { font-family: var(--display); font-size: clamp(1.15rem, 4.5vw, 1.35rem); font-weight: 700; letter-spacing: -0.01em; text-transform: none; margin-bottom: 0.5rem; }
  .review-progress { height: 4px; border-radius: 4px; background: var(--panel-2, #EEE9DC); overflow: hidden; }
  .review-progress-fill { display: block; height: 100%; width: 0; background: var(--blue); transition: width 0.45s var(--ease-out, ease-out); }
  .review-count { margin: -0.3rem 0 0; font-family: var(--mono); font-size: 0.68rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-faint); }
  .review-nav { display: flex; gap: 0.6rem; align-items: stretch; margin-top: 0.3rem; }
  .review-form .review-nav > * { flex: 1 1 auto; margin-top: 0; }
  .review-nav [hidden] { display: none; }
  .review-form .review-nav > .review-back {
    flex: 0 0 auto; font: inherit; font-weight: 600; min-height: 48px; padding: 0.7rem 1.1rem; cursor: pointer;
    background: var(--white); color: var(--oxford); border: var(--rule-soft); border-radius: var(--radius-btn, 999px);
  }
  @media (prefers-reduced-motion: reduce) {
    .review-form-stepped .review-step.is-active { animation: none; }
    .review-progress-fill { transition: none; }
  }
  .review-form input[type="file"] { font: inherit; font-size: 0.88rem; width: 100%; }
  .review-yn { display: flex; gap: 0.6rem; flex-wrap: wrap; }
  .review-yn label {
    display: flex; align-items: center; gap: 0.5rem; font-family: var(--sans); font-weight: 400;
    font-size: 1rem; text-transform: none; letter-spacing: 0; margin: 0;
    border: var(--rule-soft); border-radius: var(--radius-sm); padding: 0.6rem 1rem; min-height: 48px; cursor: pointer;
  }
  .review-yn input { width: 20px; height: 20px; margin: 0; }
  .review-err {
    background: #FBEDE7; border: 1.5px solid #E8B7A2; color: #8f3517; border-radius: var(--radius-sm);
    padding: 0.7rem 0.9rem; font-size: 0.92rem;
  }
  .review-err[hidden] { display: none; }
  .review-thanks p { margin: 0.4rem 0 0; color: var(--ink-soft); font-size: 0.95rem; }
`;

/* opts: source ("portal" | "shared link"), client, slug, askName,
   stepped (one question per screen, with Back and Continue),
   submitClass (the page's own primary button classes), thanksHtml. */
function reviewFormHtml(opts) {
  const o = opts || {};
  const nameSteps = o.askName ? `
    <div class="review-step" data-review-step="name">
      <div>
        <label for="review-name">Your name</label>
        <input id="review-name" type="text" name="name" maxlength="120" autocomplete="name" required>
      </div>
      <div>
        <label for="review-business">Your business (optional)</label>
        <input id="review-business" type="text" name="business" maxlength="160" autocomplete="organization">
      </div>
    </div>
    <div class="review-step" data-review-step="email">
      <div>
        <label for="review-email">Your email</label>
        <p class="review-hint">So Melody can say thank you. Never posted.</p>
        <input id="review-email" type="email" name="email" maxlength="200" autocomplete="email" inputmode="email" required>
      </div>
    </div>` : '';
  return `
  <form id="review-form" class="review-form${o.stepped ? ' review-form-stepped' : ''}" novalidate>
    <input type="hidden" name="source" value="${escapeHtml(o.source || '')}">
    <input type="hidden" name="client" value="${escapeHtml(o.client || '')}">
    <input type="hidden" name="slug" value="${escapeHtml(o.slug || '')}">
    ${o.stepped ? `<div class="review-progress" aria-hidden="true"><span class="review-progress-fill"></span></div>
    <p class="review-count" aria-live="polite"></p>` : ''}
    ${nameSteps}
    <div class="review-step" data-review-step="review">
      <div>
        <label for="review-text">How was working with Melody?</label>
        <textarea id="review-text" name="review" maxlength="4000" required placeholder="Tell us in your own words"></textarea>
      </div>
    </div>
    <div class="review-step" data-review-step="improve">
      <div>
        <label for="review-improve">How can the work improve?</label>
        <p class="review-hint">Just for Melody. This one never goes on the website.</p>
        <textarea id="review-improve" name="improve" maxlength="4000" placeholder="Optional"></textarea>
      </div>
    </div>
    <div class="review-step" data-review-step="publish">
      <div>
        <label>Leave a testimonial</label>
        <p class="review-hint">May we post your answer to "How was working with Melody?" on the Me&Co. website with your name and business?</p>
        <div class="review-yn" role="radiogroup" aria-label="May we post your answer on the website with your name and business?">
          <label><input type="radio" name="publishName" value="yes" required> Yes</label>
          <label><input type="radio" name="publishName" value="no"> No</label>
        </div>
      </div>
    </div>
    <div class="review-step" data-review-step="headshot">
      <div>
        <label for="review-headshot">A headshot (optional)</label>
        <input id="review-headshot" type="file" name="headshot" accept="image/png,image/jpeg,image/webp,image/gif">
      </div>
      <div id="review-headshot-yn" hidden>
        <label>May we use your headshot beside your review on the website?</label>
        <div class="review-yn" role="radiogroup" aria-label="May we use your headshot beside your review?">
          <label><input type="radio" name="publishHeadshot" value="yes"> Yes</label>
          <label><input type="radio" name="publishHeadshot" value="no"> No</label>
        </div>
      </div>
    </div>
    <div class="review-err" role="alert" hidden></div>
    ${o.stepped ? `<div class="review-nav">
      <button type="button" class="review-back" data-action="review-back">Back</button>
      <button type="button" class="${escapeHtml(o.submitClass || 'btn')}" data-action="review-next">Continue</button>
      <button type="submit" class="${escapeHtml(o.submitClass || 'btn')}">Send my review</button>
    </div>` : `<button type="submit" class="${escapeHtml(o.submitClass || 'btn')}">Send my review</button>`}
  </form>
  <div class="review-thanks" id="review-thanks" hidden>
    ${o.thanksHtml || '<p>Thank you, this means a lot. We have your review.</p>'}
  </div>`;
}

/* Validation and the Netlify Form post. Exposes window.resetReviewForm
   so the portal modal can start fresh after a sent review. */
const REVIEW_SCRIPT = `
(function () {
  var form = document.getElementById('review-form');
  if (!form) return;
  var thanks = document.getElementById('review-thanks');
  var headshot = document.getElementById('review-headshot');
  var headshotYn = document.getElementById('review-headshot-yn');
  var errBox = form.querySelector('.review-err');
  function field(name) { var el = form.querySelector('[name="' + name + '"]'); return el ? el.value.trim() : ''; }
  function fail(msg) { errBox.textContent = msg; errBox.hidden = false; }

  // One question per screen
  var stepped = form.classList.contains('review-form-stepped');
  var steps = Array.prototype.slice.call(form.querySelectorAll('[data-review-step]'));
  var at = 0;
  var backBtn = form.querySelector('[data-action="review-back"]');
  var nextBtn = form.querySelector('[data-action="review-next"]');
  var sendBtn = form.querySelector('button[type="submit"]');
  var fill = form.querySelector('.review-progress-fill');
  var count = form.querySelector('.review-count');
  function isEmail(v) { return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(v); }
  function checkStep(name) {
    if (name === 'name' && !field('name')) return 'Please add your name first.';
    if (name === 'email' && !isEmail(field('email'))) return 'Please add an email we can reach you at.';
    if (name === 'review' && !field('review')) return 'Please tell us how working with Melody was.';
    if (name === 'publish' && !form.querySelector('[name="publishName"]:checked')) return 'Please choose yes or no on posting your testimonial.';
    return '';
  }
  function show(i) {
    at = i;
    errBox.hidden = true;
    steps.forEach(function (s, n) { s.classList.toggle('is-active', n === at); });
    var last = at === steps.length - 1;
    backBtn.hidden = at === 0;
    nextBtn.hidden = last;
    sendBtn.hidden = !last;
    fill.style.width = Math.round(((at + 1) / steps.length) * 100) + '%';
    count.textContent = 'Step ' + (at + 1) + ' of ' + steps.length;
    var first = steps[at].querySelector('input:not([type="hidden"]):not([type="radio"]):not([type="file"]), textarea');
    if (first && window.matchMedia('(hover: hover)').matches) first.focus({ preventScroll: true });
  }
  function next() {
    var msg = checkStep(steps[at].getAttribute('data-review-step'));
    if (msg) return fail(msg);
    if (at < steps.length - 1) show(at + 1);
  }
  if (stepped) {
    nextBtn.addEventListener('click', next);
    backBtn.addEventListener('click', function () { if (at > 0) show(at - 1); });
    form.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'file' && at < steps.length - 1) { e.preventDefault(); next(); }
    });
    show(0);
  }

  window.resetReviewForm = function () {
    thanks.hidden = true;
    form.hidden = false;
    form.reset();
    headshotYn.hidden = true;
    headshotYn.querySelectorAll('input').forEach(function (r) { r.required = false; });
    errBox.hidden = true;
    if (stepped) show(0);
  };

  headshot.addEventListener('change', function () {
    var has = headshot.files && headshot.files.length > 0;
    headshotYn.hidden = !has;
    headshotYn.querySelectorAll('input').forEach(function (r) { r.required = has; if (!has) r.checked = false; });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    errBox.hidden = true;
    var askName = !!form.querySelector('[name="name"]');
    var text = field('review');
    var publishName = form.querySelector('[name="publishName"]:checked');
    var hasHeadshot = headshot.files && headshot.files.length > 0;
    var publishHeadshot = form.querySelector('[name="publishHeadshot"]:checked');
    function fail(msg) { errBox.textContent = msg; errBox.hidden = false; }
    if (askName && !field('name')) return fail('Please add your name first.');
    if (form.querySelector('[name="email"]') && !isEmail(field('email'))) return fail('Please add an email we can reach you at.');
    if (!text) return fail('Please tell us how working with Melody was.');
    if (!publishName) return fail('Please choose yes or no on posting your testimonial.');
    if (hasHeadshot && !publishHeadshot) return fail('Please choose yes or no on using your headshot.');
    var btn = form.querySelector('button[type="submit"]');
    var label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Sending...';
    var fd = new FormData();
    fd.append('form-name', 'client-review');
    ['source', 'client', 'slug', 'name', 'business', 'email'].forEach(function (k) { fd.append(k, field(k)); });
    fd.append('review', text);
    fd.append('improve', field('improve'));
    fd.append('publishName', publishName.value);
    fd.append('publishHeadshot', hasHeadshot ? publishHeadshot.value : '');
    if (hasHeadshot) fd.append('headshot', headshot.files[0], headshot.files[0].name);
    fetch('/forms/client-review.html', { method: 'POST', body: fd })
      .then(function (res) { if (!res.ok) throw new Error('send'); })
      .then(function () {
        btn.disabled = false; btn.textContent = label;
        form.hidden = true;
        thanks.hidden = false;
      })
      .catch(function () {
        btn.disabled = false; btn.textContent = label;
        fail('That did not send. Please try again in a moment.');
      });
  });
})();
`;

module.exports = { REVIEW_CSS, REVIEW_SCRIPT, reviewFormHtml, escapeHtml };
