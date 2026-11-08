/* ============================================================
   Me&Co.: public review page, /review
   ------------------------------------------------------------
   The link Melody can text or email to anyone she has worked with
   or helped, client or not. No sign in. Same form as the portal's
   Leave a review modal (portal/review-form.js), plus their name and
   business, since nobody is signed in to say who they are.
   ============================================================ */

const { FONT_LINK, TOKENS, BASE } = require('../portal/theme.js');
const { REVIEW_CSS, REVIEW_SCRIPT, reviewFormHtml } = require('../portal/review-form.js');

function renderReviewPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>Me&Co. &middot; Leave a review</title>
${FONT_LINK}
<style>
${TOKENS}
${BASE}
${REVIEW_CSS}
  body { min-height: 100vh; min-height: 100svh; display: flex; flex-direction: column; align-items: center; }
  main { flex: 1; width: 100%; max-width: 34rem; padding: clamp(28px, 8vw, 64px) 16px 40px; }
  .top { display: flex; justify-content: center; margin-bottom: clamp(18px, 5vw, 28px); }
  .panel {
    background: var(--white); border: var(--rule); border-radius: var(--radius); box-shadow: var(--shadow-hard);
    padding: clamp(1.3rem, 5vw, 1.9rem);
  }
  h1 { font-weight: 800; font-size: clamp(1.5rem, 6vw, 2rem); letter-spacing: -0.015em; margin: 0.3rem 0 0.3rem; }
  .sub { color: var(--ink-soft); font-size: 0.95rem; margin: 0 0 1.1rem; }
  .send {
    display: flex; width: 100%; align-items: center; justify-content: center; margin-top: 0.4rem;
    font-family: var(--display); font-weight: 700; font-size: 0.95rem; min-height: 48px; padding: 0.7rem 1.3rem;
    border-radius: var(--radius-btn); border: var(--rule-strong); background: var(--oxford); color: var(--white);
    box-shadow: var(--shadow-hard-sm); cursor: pointer;
  }
  .send:hover { background: #061529; }
  .send[disabled] { opacity: 0.6; pointer-events: none; }
  footer { padding: 22px 20px 34px; text-align: center; color: var(--ink-faint); font-size: 0.86rem; }
  footer a { color: var(--blue-ink); }
</style>
</head>
<body>
  <main>
    <div class="top"><div class="mark"><span class="dot"></span>Me&Co.</div></div>
    <div class="panel">
      <p class="microlabel">Me&Co.</p>
      <h1>Leave a review</h1>
      <p class="sub">A few sentences in your own words. Takes two minutes.</p>
      ${reviewFormHtml({
        source: 'shared link', askName: true, stepped: true, submitClass: 'send',
        thanksHtml: '<p>Thank you, this means a lot. We have your review.</p>',
      })}
    </div>
  </main>
  <footer>Questions? Email <a href="mailto:melody@weareme.co">melody@weareme.co</a>.</footer>
  <script>${REVIEW_SCRIPT}</script>
</body>
</html>`;
}

module.exports = { renderReviewPage };
