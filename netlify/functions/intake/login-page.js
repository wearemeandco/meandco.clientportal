/* ============================================================
   Me&Co.: client sign in (/login)
   ------------------------------------------------------------
   Email and passcode, with a link to Forgot passcode. Posts
   { action: 'passcode-login', email, passcode } to the intake
   function, which matches the email to a client and sets the same
   signed session cookie the portal's own lock screen sets.

   The reply never says whether an email was recognised, so this
   page cannot be used to find out who the studio's clients are.
   ============================================================ */

const { renderAuthPage, escapeHtml, REVEAL_SCRIPT } = require('./auth-shell.js');

function renderLoginPage(opts) {
  const options = opts || {};
  const notice = options.notice ? String(options.notice) : '';
  const good = !!options.good;

  const body = `
    <div class="auth-msg ${good ? 'auth-msg-good' : 'auth-msg-bad'}${notice ? ' show' : ''}" id="login-notice" role="alert" aria-live="assertive">${escapeHtml(notice)}</div>

    <!-- ===== LOGIN FORM ===== -->
    <form class="auth-form" id="login-form" data-section="login-form" novalidate>
      <div>
        <label for="login-email">Your email</label>
        <input id="login-email" name="email" type="email" autocomplete="email" inputmode="email" required>
      </div>
      <div>
        <label for="login-passcode">Passcode</label>
        <div class="auth-field">
          <input id="login-passcode" name="passcode" type="password" autocomplete="current-password" required>
          <button type="button" class="auth-reveal" data-action="reveal" data-target="login-passcode" aria-label="Show passcode">Show</button>
        </div>
      </div>
      <div class="auth-msg auth-msg-bad" id="login-error" role="alert" aria-live="assertive"></div>
      <button type="submit" class="auth-submit" data-action="login-submit">Open my portal</button>
      <a class="auth-link" href="/forgot" data-action="forgot">Forgot passcode?</a>
    </form>
    <!-- /LOGIN FORM -->

    <p class="auth-foot">New here? <a href="/start/inquiry">Start with a two minute inquiry</a>.</p>`;

  const script = `
(function () {
${REVEAL_SCRIPT}

  // Sign in
  var form = document.getElementById('login-form');
  var submit = form.querySelector('[data-action="login-submit"]');
  var error = document.getElementById('login-error');
  function fail(text) { error.textContent = text; error.classList.add('show'); submit.disabled = false; submit.textContent = 'Open my portal'; }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    error.classList.remove('show');
    var email = document.getElementById('login-email').value.trim();
    var passcode = document.getElementById('login-passcode').value;
    if (!email || !passcode) { fail('Enter your email and your passcode.'); return; }
    submit.disabled = true;
    submit.textContent = 'Checking...';
    fetch('/.netlify/functions/intake?view=login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ action: 'passcode-login', email: email, passcode: passcode })
    })
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (r) {
        if (r.ok && r.data.ok && r.data.redirect) { window.location.replace(r.data.redirect); return; }
        fail((r.data && r.data.error) || 'That email and passcode did not match.');
      })
      .catch(function () { fail('Something went wrong on our side. Please try again in a moment.'); });
  });
})();`;

  return renderAuthPage({
    title: 'Sign in',
    label: 'Already a client',
    heading: 'Open your portal',
    blurb: 'Sign in with your email and the passcode from your welcome email.',
    body,
    script,
  });
}

module.exports = { renderLoginPage };
