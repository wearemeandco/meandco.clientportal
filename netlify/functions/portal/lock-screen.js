/* ============================================================
   Me&Co. — portal lock screen
   ------------------------------------------------------------
   The first thing a client ever sees, so it carries the whole
   first impression of the studio. It runs the same theme as the
   invoices and receipts (theme.js): paper ground, one soft-shadowed
   white document, Syne over Prompt, the lime dot wordmark. Never a
   different typeface from the documents this studio sends out.

   Two usability additions, both for the person typing a long
   passcode into a phone with one hand:
   - a Show / Hide toggle on the field, so a mistyped character is
     findable instead of a wall of dots
   - the error message is a live region, announced rather than just
     coloured

   The gate itself is untouched: same POST to the same endpoint,
   same field name, same success redirect, same failure copy.
   ============================================================ */

const { FONT_LINK, TOKENS, BASE } = require('./theme.js');

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderLockScreen(client, opts) {
  const options = opts || {};
  const name = escapeHtml(client.name || 'your portal');
  const kicker = escapeHtml(client.kicker || 'Me&Co.');
  const blurb = escapeHtml(client.blurb || 'This page is private. Enter the passcode you were sent.');
  const initialError = options.error ? escapeHtml(options.error) : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>Me&Co. &middot; Client Portal</title>
${FONT_LINK}
<style>
${TOKENS}
${BASE}

  body {
    min-height: 100vh; min-height: 100svh;
    display: flex; align-items: center; justify-content: center;
    padding: clamp(20px, 6vw, 56px) 16px;
  }
  .card {
    width: 100%; max-width: 27rem;
    background: var(--white);
    border-radius: var(--radius);
    border: var(--rule); box-shadow: var(--shadow-hard-lg);
    padding: clamp(26px, 6vw, 44px) clamp(22px, 5.5vw, 40px);
    animation: fadeUp 0.6s var(--ease-out) backwards;
  }
  .card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 22px; }
  .lock {
    width: 40px; height: 40px; flex: none;
    border-radius: 50%; background: var(--panel);
    display: flex; align-items: center; justify-content: center;
  }
  h1 { font-weight: 800; font-size: clamp(1.35rem, 5.5vw, 1.65rem); margin: 0.3rem 0 0; letter-spacing: -0.015em; text-wrap: balance; }
  .blurb { color: var(--ink-soft); font-size: 0.95rem; margin: 0.6rem 0 0; }

  form { margin-top: 1.6rem; display: flex; flex-direction: column; gap: 0.9rem; }
  label { display: block; font-family: var(--mono); font-size: 0.68rem; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: var(--lime-ink); margin-bottom: 0.4rem; }
  .field { position: relative; display: flex; align-items: center; }
  input {
    font-family: var(--sans); font-size: 16px; color: var(--ink);
    background: var(--paper); border: var(--rule-soft);
    border-radius: var(--radius-sm); padding: 14px 74px 14px 14px; width: 100%; outline: none;
    min-height: 52px; letter-spacing: 0.02em;
  }
  input:focus { border-color: var(--oxford); background: var(--white); }
  .reveal {
    position: absolute; right: 6px; min-height: 40px; padding: 0 12px;
    font-family: var(--sans); font-size: 0.85rem; font-weight: 600; color: var(--ink-soft);
    background: var(--white); border: var(--rule-soft); border-radius: var(--radius-btn); cursor: pointer;
  }
  .reveal:hover { background: var(--panel); }
  .error {
    display: none; background: #FBEDE7; border: 1px solid #E8B7A2;
    color: #8f3517; border-radius: var(--radius-sm); padding: 11px 13px; font-size: 0.9rem;
  }
  .error.show { display: block; }
  button.submit {
    font-family: var(--display); font-weight: 700; font-size: 1rem;
    background: var(--oxford); color: var(--white); border: var(--rule-strong);
    border-radius: var(--radius-btn); padding: 15px; cursor: pointer; width: 100%; min-height: 52px;
    box-shadow: var(--shadow-hard-sm);
    transition: transform 0.25s var(--ease-spring), box-shadow 0.2s var(--ease-out), background 0.2s;
  }
  button.submit:hover { background: #061529; transform: translateY(-2px); box-shadow: var(--shadow-hard-lg); }
  button.submit:active { transform: translateY(2px); box-shadow: 0 0 0 0 var(--oxford); }
  button.submit[disabled] { opacity: 0.6; pointer-events: none; }
  .foot { margin-top: 1.4rem; font-size: 0.88rem; color: var(--ink-faint); }
  .foot a { color: var(--blue-ink); }
</style>
</head>
<body>
  <div class="card" id="card">
    <div class="card-head">
      <div class="mark"><span class="dot"></span>Me&Co.</div>
      <div class="lock" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22315E" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="4" y="10.5" width="16" height="10.5" rx="3"></rect>
          <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"></path>
        </svg>
      </div>
    </div>
    <p class="microlabel">${kicker}</p>
    <h1>${name}</h1>
    <p class="blurb">${blurb}</p>
    <form id="gate-form">
      <div>
        <label for="passcode">Passcode</label>
        <div class="field">
          <input id="passcode" name="passcode" type="password" autocomplete="current-password" required>
          <button type="button" class="reveal" id="reveal" aria-label="Show passcode">Show</button>
        </div>
      </div>
      <div class="error${initialError ? ' show' : ''}" id="error" role="alert" aria-live="assertive">${initialError}</div>
      <button type="submit" class="submit" id="submit">Open my portal</button>
    </form>
    <!-- ===== LOCK FORGOT ===== -->
    <section id="lock-forgot">
      <p class="foot"><a href="#lock-forgot" data-action="forgot-open">Forgot passcode?</a></p>
      <div data-section="lock-forgot-panel" style="display:none">
        <form data-action="forgot-send">
          <div>
            <label for="forgot-email">Your email</label>
            <div class="field"><input id="forgot-email" name="email" type="email" autocomplete="email" required></div>
          </div>
          <button type="submit" class="submit" data-action="forgot-submit">Email me a sign-in link</button>
        </form>
      </div>
      <p class="foot" data-section="lock-forgot-reply" role="status" aria-live="polite" style="display:none"></p>
    </section>
    <!-- /LOCK FORGOT -->
  </div>
  <script>
    (function () {
      var form = document.getElementById('gate-form');
      var input = document.getElementById('passcode');
      var submit = document.getElementById('submit');
      var errBox = document.getElementById('error');
      var reveal = document.getElementById('reveal');
      var slug = ${JSON.stringify(client.slug)};
      // Forgot passcode
      var forgotOpen = document.querySelector('[data-action="forgot-open"]');
      var forgotPanel = document.querySelector('[data-section="lock-forgot-panel"]');
      var forgotForm = document.querySelector('[data-action="forgot-send"]');
      var forgotBtn = document.querySelector('[data-action="forgot-submit"]');
      var forgotReply = document.querySelector('[data-section="lock-forgot-reply"]');
      forgotOpen.addEventListener('click', function (e) {
        e.preventDefault();
        forgotPanel.style.display = forgotPanel.style.display === 'none' ? 'block' : 'none';
      });
      forgotForm.addEventListener('submit', function (e) {
        e.preventDefault();
        forgotBtn.disabled = true;
        forgotBtn.textContent = 'Sending...';
        fetch('/.netlify/functions/portal?slug=' + encodeURIComponent(slug), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ action: 'forgot', email: forgotForm.email.value })
        })
          .then(function (res) { return res.json(); })
          .catch(function () { return {}; })
          .then(function (data) {
            forgotReply.textContent = (data && data.message) || 'If that email is on file, a link to set a new passcode is on its way.';
            forgotReply.style.display = 'block';
            forgotPanel.style.display = 'none';
            forgotBtn.disabled = false;
            forgotBtn.textContent = 'Email me a sign-in link';
          });
      });
      reveal.addEventListener('click', function () {
        var showing = input.type === 'text';
        input.type = showing ? 'password' : 'text';
        reveal.textContent = showing ? 'Show' : 'Hide';
        reveal.setAttribute('aria-label', showing ? 'Show passcode' : 'Hide passcode');
        input.focus();
      });
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        errBox.classList.remove('show');
        submit.disabled = true;
        submit.textContent = 'Checking...';
        fetch('/.netlify/functions/portal?slug=' + encodeURIComponent(slug), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ passcode: input.value })
        })
          .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
          .then(function (r) {
            if (r.ok && r.data.ok) { window.location.replace('/portal/' + slug); return; }
            submit.disabled = false;
            submit.textContent = 'Open my portal';
            errBox.textContent = (r.data && r.data.error) || 'That passcode did not work.';
            errBox.classList.add('show');
          })
          .catch(function () {
            submit.disabled = false;
            submit.textContent = 'Open my portal';
            errBox.textContent = 'Something went wrong, please try again.';
            errBox.classList.add('show');
          });
      });
    })();
  </script>
</body>
</html>`;
}

module.exports = { renderLockScreen, escapeHtml };
