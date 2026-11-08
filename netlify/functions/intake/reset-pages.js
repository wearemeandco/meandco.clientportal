/* ============================================================
   Me&Co.: passcode reset pages
   ------------------------------------------------------------
   /forgot        Forgot passcode, then Check your email
   /reset/<link>  Set a new passcode, then Passcode updated,
                  or Link expired when the link is old or used
   /signout       Signed out

   Every reply about an email address is the same whether or not the
   address is on file, so these pages cannot reveal who the clients are.
   ============================================================ */

const { renderAuthPage, escapeHtml, REVEAL_SCRIPT } = require('./auth-shell.js');

const MIN_LENGTH = 8;

/* ---- Forgot passcode, then Check your email ---- */

function renderForgotPage() {
  const body = `
    <!-- ===== FORGOT FORM ===== -->
    <form class="auth-form" id="forgot-form" data-section="forgot-form" novalidate>
      <div>
        <label for="forgot-email">Your email</label>
        <input id="forgot-email" name="email" type="email" autocomplete="email" inputmode="email" required>
      </div>
      <div class="auth-msg auth-msg-bad" id="forgot-error" role="alert" aria-live="assertive"></div>
      <button type="submit" class="auth-submit" data-action="forgot-submit">Email me a link</button>
      <a class="auth-link" href="/login">Back to sign in</a>
    </form>
    <!-- /FORGOT FORM -->

    <!-- ===== FORGOT SENT ===== -->
    <div id="forgot-sent" data-section="forgot-sent" hidden>
      <div class="auth-form">
        <div class="auth-msg auth-msg-good show" id="forgot-sent-note" role="status" aria-live="polite">If that email is on file, a link to set a new passcode is on its way. It works once, for one hour.</div>
        <button type="button" class="auth-submit" data-action="forgot-resend">Send it again</button>
        <a class="auth-link" href="/login">Back to sign in</a>
      </div>
      <p class="auth-foot">Nothing after a few minutes? Check your spam folder, or email <a href="mailto:melody@weareme.co">melody@weareme.co</a>.</p>
    </div>
    <!-- /FORGOT SENT -->`;

  const script = `
(function () {
  // Forgot passcode
  var form = document.getElementById('forgot-form');
  var submit = form.querySelector('[data-action="forgot-submit"]');
  var error = document.getElementById('forgot-error');
  var sent = document.getElementById('forgot-sent');
  var resend = document.querySelector('[data-action="forgot-resend"]');
  var lastEmail = '';
  function request(email) {
    return fetch('/.netlify/functions/intake?view=forgot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'forgot-request', email: email })
    }).then(function (res) { if (!res.ok) throw new Error('send'); });
  }
  function showSent() {
    form.hidden = true;
    sent.hidden = false;
    document.getElementById('auth-heading').textContent = 'Check your email';
    document.getElementById('auth-blurb').textContent = 'We sent the link to ' + lastEmail + '.';
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    error.classList.remove('show');
    var email = document.getElementById('forgot-email').value.trim();
    if (!email || email.indexOf('@') < 1) { error.textContent = 'Enter the email you use with Me&Co..'; error.classList.add('show'); return; }
    lastEmail = email;
    submit.disabled = true;
    submit.textContent = 'Sending...';
    request(email).then(showSent).catch(function () {
      submit.disabled = false;
      submit.textContent = 'Email me a link';
      error.textContent = 'That did not go through. Please try again in a moment.';
      error.classList.add('show');
    });
  });

  // Send it again
  resend.addEventListener('click', function () {
    resend.disabled = true;
    resend.textContent = 'Sending...';
    request(lastEmail).then(function () {
      resend.textContent = 'Sent again';
      setTimeout(function () { resend.disabled = false; resend.textContent = 'Send it again'; }, 20000);
    }).catch(function () {
      resend.disabled = false;
      resend.textContent = 'Send it again';
    });
  });
})();`;

  return renderAuthPage({
    title: 'Forgot passcode',
    label: 'Forgot passcode',
    heading: 'Reset your passcode',
    blurb: 'Enter the email you use with Me&Co. and we will send you a link to choose a new passcode.',
    body,
    script,
  });
}

/* ---- Set a new passcode, then Passcode updated ---- */

function renderResetPage(token) {
  const body = `
    <!-- ===== RESET FORM ===== -->
    <form class="auth-form" id="reset-form" data-section="reset-form" novalidate>
      <div>
        <label for="reset-passcode">New passcode</label>
        <div class="auth-field">
          <input id="reset-passcode" name="passcode" type="password" autocomplete="new-password" minlength="${MIN_LENGTH}" required>
          <button type="button" class="auth-reveal" data-action="reveal" data-target="reset-passcode" aria-label="Show passcode">Show</button>
        </div>
        <p class="auth-hint">At least ${MIN_LENGTH} characters.</p>
      </div>
      <div>
        <label for="reset-confirm">Type it again</label>
        <div class="auth-field">
          <input id="reset-confirm" name="confirm" type="password" autocomplete="new-password" required>
          <button type="button" class="auth-reveal" data-action="reveal" data-target="reset-confirm" aria-label="Show passcode">Show</button>
        </div>
      </div>
      <div class="auth-msg auth-msg-bad" id="reset-error" role="alert" aria-live="assertive"></div>
      <button type="submit" class="auth-submit" data-action="reset-submit">Save my new passcode</button>
    </form>
    <!-- /RESET FORM -->

    <!-- ===== RESET DONE ===== -->
    <div id="reset-done" data-section="reset-done" hidden>
      <a class="auth-submit" id="reset-open" href="/login">Open my portal</a>
    </div>
    <!-- /RESET DONE -->`;

  const script = `
(function () {
${REVEAL_SCRIPT}

  // Set a new passcode
  var TOKEN = ${JSON.stringify(String(token)).replace(/</g, '\\u003c')};
  var form = document.getElementById('reset-form');
  var submit = form.querySelector('[data-action="reset-submit"]');
  var error = document.getElementById('reset-error');
  function fail(text) { error.textContent = text; error.classList.add('show'); submit.disabled = false; submit.textContent = 'Save my new passcode'; }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    error.classList.remove('show');
    var passcode = document.getElementById('reset-passcode').value;
    var confirm = document.getElementById('reset-confirm').value;
    if (passcode.length < ${MIN_LENGTH}) { fail('Your new passcode needs at least ${MIN_LENGTH} characters.'); return; }
    if (passcode !== confirm) { fail('The two passcodes do not match. Type them again.'); return; }
    submit.disabled = true;
    submit.textContent = 'Saving...';
    fetch('/.netlify/functions/intake?view=reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ action: 'reset-passcode', token: TOKEN, passcode: passcode })
    })
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (r) {
        if (!(r.ok && r.data.ok)) { fail((r.data && r.data.error) || 'That did not save. Please try again.'); return; }
        // Passcode updated
        form.hidden = true;
        document.getElementById('reset-done').hidden = false;
        document.getElementById('reset-open').href = r.data.redirect || '/login';
        document.getElementById('auth-heading').textContent = 'Passcode updated';
        document.getElementById('auth-blurb').textContent = 'All set. Use your new passcode from now on. You are signed in on this device.';
      })
      .catch(function () { fail('Something went wrong on our side. Please try again in a moment.'); });
  });
})();`;

  return renderAuthPage({
    title: 'Set a new passcode',
    label: 'Forgot passcode',
    heading: 'Set a new passcode',
    blurb: 'Choose a passcode you will remember. It replaces your old one.',
    body,
    script,
  });
}

/* ---- Link expired or used ---- */

function renderExpiredPage() {
  const body = `
    <!-- ===== RESET EXPIRED ===== -->
    <div id="reset-expired" data-section="reset-expired">
      <a class="auth-submit" href="/forgot">Send me a new link</a>
      <p class="auth-foot"><a href="/login">Back to sign in</a></p>
    </div>
    <!-- /RESET EXPIRED -->`;
  return renderAuthPage({
    title: 'Link expired',
    label: 'Forgot passcode',
    heading: 'This link has expired',
    blurb: 'Links to set a new passcode work once, for one hour. Ask for a new one and it will be in your inbox in a minute.',
    body,
  });
}

/* ---- Signed out ---- */

function renderSignedOutPage() {
  const body = `
    <!-- ===== SIGNED OUT ===== -->
    <div id="signed-out" data-section="signed-out">
      <a class="auth-submit" href="/login">Sign in again</a>
    </div>
    <!-- /SIGNED OUT -->`;
  return renderAuthPage({
    title: 'Signed out',
    label: 'Your portal',
    heading: 'You are signed out',
    blurb: 'Your portal is locked on this device. Everything you saved is still there for next time.',
    body,
  });
}

module.exports = { MIN_LENGTH, renderForgotPage, renderResetPage, renderExpiredPage, renderSignedOutPage, escapeHtml };
