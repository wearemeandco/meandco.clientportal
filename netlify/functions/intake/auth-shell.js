/* ============================================================
   Me&Co.: sign in pages shell
   ------------------------------------------------------------
   One card layout for every page in the sign in flow: sign in,
   forgot passcode, check your email, set a new passcode, passcode
   updated, link expired, and signed out. Each page passes its own
   heading, text, and form; the frame, fonts and colours live here.
   ============================================================ */

const { FONT_LINK, TOKENS, BASE } = require('../portal/theme.js');

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const LOCK_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22315E" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10.5" width="16" height="10.5" rx="3"></rect><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"></path></svg>`;

const AUTH_STYLE = `
  [hidden] { display: none !important; }
  @keyframes authRise { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
  .auth-card { animation: authRise 0.6s cubic-bezier(0.22,0.75,0.25,1) both; }
  @media (prefers-reduced-motion: reduce) { .auth-card { animation: none; } }

  body { min-height: 100vh; min-height: 100svh; display: flex; align-items: center; justify-content: center; padding: clamp(20px, 6vw, 56px) 16px; }
  .auth-card { width: 100%; max-width: 27rem; background: var(--white); border-radius: var(--radius); box-shadow: var(--shadow); padding: clamp(26px, 6vw, 44px) clamp(22px, 5.5vw, 40px); }
  .auth-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 22px; }
  .auth-lock { width: 40px; height: 40px; flex: none; border-radius: 50%; background: var(--panel); display: flex; align-items: center; justify-content: center; }
  .auth-card h1 { font-weight: 800; font-size: clamp(1.35rem, 5.5vw, 1.65rem); margin: 0.3rem 0 0; letter-spacing: -0.015em; text-wrap: balance; }
  .auth-blurb { color: var(--ink-soft); font-size: 0.95rem; margin: 0.6rem 0 0; }

  .auth-form { margin-top: 1.5rem; display: flex; flex-direction: column; gap: 0.9rem; }
  .auth-form label { display: block; font-family: var(--mono); font-size: 0.68rem; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: var(--lime-ink); margin-bottom: 0.4rem; }
  .auth-form input { font-family: var(--sans); font-size: 16px; color: var(--ink); background: var(--paper); border: 1px solid var(--panel-2); border-radius: var(--radius-sm); padding: 14px; width: 100%; outline: none; min-height: 52px; }
  .auth-form input:focus { border-color: var(--oxford); background: var(--white); }
  .auth-field { position: relative; display: flex; align-items: center; }
  .auth-field input { padding-right: 74px; }
  .auth-reveal { position: absolute; right: 6px; min-height: 40px; padding: 0 12px; font-family: var(--sans); font-size: 0.85rem; font-weight: 600; color: var(--ink-soft); background: var(--white); border: 1px solid var(--panel-2); border-radius: 999px; cursor: pointer; }
  .auth-hint { font-size: 0.82rem; color: var(--ink-faint); margin: 0.35rem 0 0; }

  .auth-submit { display: block; text-align: center; text-decoration: none; font-family: var(--display); font-weight: 700; font-size: 1rem; background: var(--oxford); color: var(--white); border: none; border-radius: 999px; padding: 15px; cursor: pointer; width: 100%; min-height: 52px; margin-top: 1.5rem; }
  .auth-form .auth-submit { margin-top: 0; }
  .auth-submit:hover { background: #061529; }
  .auth-submit[disabled] { opacity: 0.6; pointer-events: none; }
  .auth-submit:focus-visible, .auth-link:focus-visible, .auth-reveal:focus-visible { outline: 3px solid var(--lime); outline-offset: 2px; }
  .auth-link { align-self: center; background: none; border: none; padding: 8px 4px; min-height: 40px; cursor: pointer; font-family: var(--sans); font-size: 0.92rem; font-weight: 600; color: var(--blue-ink); text-decoration: underline; }

  .auth-msg { display: none; border-radius: var(--radius-sm); padding: 12px 14px; font-size: 0.9rem; }
  .auth-msg.show { display: block; }
  .auth-msg-good { background: var(--green-bg); border: 1px solid #cfe8bd; color: var(--green); }
  .auth-msg-bad { background: #FBEDE7; border: 1px solid #E8B7A2; color: #8f3517; }

  .auth-foot { margin-top: 1.4rem; font-size: 0.88rem; color: var(--ink-faint); text-align: center; }
  .auth-foot a { color: var(--blue-ink); }
`;

/* Wraps one page of the sign in flow. body is trusted HTML built by the caller. */
function renderAuthPage({ title, label, heading, blurb, body, script }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>Me&Co. &middot; ${escapeHtml(title)}</title>
${FONT_LINK}
<style>
${TOKENS}
${BASE}
${AUTH_STYLE}
</style>
</head>
<body>
  <!-- ===== AUTH CARD ===== -->
  <main class="auth-card" id="auth-card">
    <div class="auth-head">
      <div class="mark"><span class="dot"></span>Me&Co.</div>
      <div class="auth-lock" aria-hidden="true">${LOCK_ICON}</div>
    </div>
    <p class="microlabel">${escapeHtml(label)}</p>
    <h1 id="auth-heading">${escapeHtml(heading)}</h1>
    <p class="auth-blurb" id="auth-blurb">${escapeHtml(blurb)}</p>
${body || ''}
  </main>
  <!-- /AUTH CARD -->
${script ? '<script>\n' + script + '\n</script>' : ''}
</body>
</html>`;
}

/* Show / Hide toggle for every passcode field on a page. */
const REVEAL_SCRIPT = `
  document.querySelectorAll('[data-action="reveal"]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var input = document.getElementById(btn.getAttribute('data-target'));
      var showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      btn.textContent = showing ? 'Show' : 'Hide';
      btn.setAttribute('aria-label', showing ? 'Show passcode' : 'Hide passcode');
      input.focus();
    });
  });`;

module.exports = { renderAuthPage, escapeHtml, REVEAL_SCRIPT };
