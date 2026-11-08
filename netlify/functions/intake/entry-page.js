/* ============================================================
   Me&Co.: portal front door
   ------------------------------------------------------------
   Everything client-facing this studio has built so far assumes you
   already know your own private URL. public/index.html literally
   says "your portal lives at a private link sent directly to you",
   which is fine for Melody and Antonio and useless for anyone new.

   This is the branch: new here, or already a client. Two doors, one
   decision, nothing else on the page. Built on theme.js so it is the
   same paper, the same Syne over Prompt, the same lime dot as the
   invoices and the proposal. No new colours, the palette is fixed.

   The entrance animation is lifted from the real proposal
   (public/proposals/melody-project2.html): nsRise, a 28px lift with
   opacity, staggered down the page, cubic-bezier(0.22,0.75,0.25,1),
   and switched off entirely under prefers-reduced-motion.
   ============================================================ */

const { FONT_LINK, TOKENS, BASE } = require('../portal/theme.js');

const RISE = `
  @keyframes nsRise { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: translateY(0); } }
  .rise { animation: nsRise 0.7s cubic-bezier(0.22,0.75,0.25,1) both; }
  .rise.d2 { animation-delay: 0.10s; }
  .rise.d3 { animation-delay: 0.20s; }
  .rise.d4 { animation-delay: 0.32s; }
  .rise.d5 { animation-delay: 0.44s; }
  @media (prefers-reduced-motion: reduce) { .rise { animation: none; } }`;

function renderEntryPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>Me&Co. &middot; Start here</title>
${FONT_LINK}
<style>
${TOKENS}
${BASE}
${RISE}
  body { min-height: 100vh; min-height: 100svh; display: flex; flex-direction: column; align-items: center; }
  main { flex: 1; width: 100%; max-width: 46rem; padding: clamp(28px, 8vw, 72px) 20px 40px; }
  .top { display: flex; align-items: center; justify-content: center; text-align: center; gap: 12px; margin-bottom: clamp(18px, 5vw, 30px); }
  .lede { text-align: center; color: var(--ink-soft); font-size: clamp(0.98rem, 3.4vw, 1.08rem); max-width: 40ch; margin: 0 auto clamp(24px, 6vw, 40px); }
  h1 { font-weight: 800; font-size: clamp(1.75rem, 7vw, 2.7rem); letter-spacing: -0.02em; margin: 0.5rem 0 0; text-wrap: balance; max-width: 18ch; }
  .sub { color: var(--ink-soft); font-size: clamp(0.98rem, 3.4vw, 1.08rem); margin: 0.9rem 0 0; max-width: 44ch; }

  .doors { display: grid; gap: 16px; margin-top: clamp(28px, 7vw, 44px); }
  @media (min-width: 720px) { .doors { grid-template-columns: 1fr 1fr; gap: 20px; } }

  .door {
    display: block; text-decoration: none; color: inherit;
    background: var(--white); border: 1px solid var(--panel-2); border-radius: var(--radius);
    box-shadow: var(--shadow-sm); padding: clamp(22px, 5.5vw, 30px);
    transition: transform 0.25s cubic-bezier(0.22,0.75,0.25,1), box-shadow 0.25s ease, border-color 0.25s ease;
  }
  .door:hover, .door:focus-visible { transform: translateY(-4px); box-shadow: var(--shadow); border-color: var(--oxford); }
  @media (prefers-reduced-motion: reduce) { .door { transition: none; } .door:hover { transform: none; } }
  .door h2 { font-size: clamp(1.15rem, 4.6vw, 1.35rem); margin: 0.55rem 0 0; letter-spacing: -0.01em; }
  .door p { color: var(--ink-soft); font-size: 0.94rem; margin: 0.55rem 0 0; }
  .door .go { display: inline-flex; align-items: center; gap: 8px; margin-top: 1.1rem; font-family: var(--display); font-weight: 700; font-size: 0.95rem; color: var(--oxford); }
  .door .go .arrow { transition: transform 0.25s ease; }
  .door:hover .go .arrow { transform: translateX(5px); }
  .door.primary { background: var(--oxford); border-color: var(--oxford); }
  .door.primary h2, .door.primary .go { color: var(--white); }
  .door.primary p { color: rgba(250, 248, 242, 0.82); }
  .door.primary .microlabel { color: var(--lime); }
  .door.primary:hover { border-color: var(--lime); }

  .badge { display: inline-flex; align-items: center; gap: 7px; font-family: var(--mono); font-size: 0.64rem; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: var(--ink-faint); border: 1px solid var(--panel-2); border-radius: 999px; padding: 6px 12px; background: var(--white); }
  .badge .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--lime); }

  .review-door { display: flex; justify-content: center; margin-top: clamp(22px, 6vw, 32px); }
  .review-door a {
    display: inline-flex; align-items: center; gap: 8px; min-height: 48px; padding: 0.7rem 1.4rem;
    border-radius: 999px; border: 1px solid var(--panel-2); background: var(--white); color: var(--oxford);
    font-family: var(--display); font-weight: 700; font-size: 0.95rem; text-decoration: none;
    transition: border-color 0.25s ease, transform 0.25s ease;
  }
  .review-door a:hover, .review-door a:focus-visible { border-color: var(--oxford); transform: translateY(-2px); }
  .review-door .arrow { transition: transform 0.25s ease; }
  .review-door a:hover .arrow { transform: translateX(4px); }
  @media (prefers-reduced-motion: reduce) { .review-door a, .review-door .arrow { transition: none; } }

  footer { border-top: 1px solid var(--panel-2); padding: 22px 20px 34px; text-align: center; color: var(--ink-faint); font-size: 0.86rem; }
  footer a { color: var(--blue-ink); }
</style>
</head>
<body>
  <main>
    <div class="top rise">
      <div class="mark"><span class="dot"></span>Me&Co.</div>
    </div>

    <p class="lede rise d2">Wherever you're starting, we'll meet you there.</p>

    <div class="doors">
      <a class="door primary rise d4" href="/start/inquiry">
        <p class="microlabel">New here</p>
        <h2>Let's get started</h2>
        <p>Three quick questions, then a link to pick a time.</p>
        <span class="go">Start the inquiry <span class="arrow">&rarr;</span></span>
      </a>

      <a class="door rise d5" href="/login">
        <p class="microlabel">Already a client</p>
        <h2>Open my portal</h2>
        <p>Sign in with your email, or your passcode.</p>
        <span class="go">Go to sign in <span class="arrow">&rarr;</span></span>
      </a>
    </div>

    <div class="review-door rise d5">
      <a href="/review" data-action="leave-review">Worked with us? Leave a review <span class="arrow">&rarr;</span></a>
    </div>
  </main>
  <footer>
    Not sure which one you are? Email <a href="mailto:everly@admin.weareme.co">everly@admin.weareme.co</a> and we will point you at the right door.
  </footer>
  <script>
    // Emails from Netlify Identity (invite, confirm, reset) land on the site root with a token after the #. Pass it to the sign in page.
    if (/(invite|recovery|confirmation)_token=/.test(window.location.hash)) { window.location.replace('/login' + window.location.hash); }
  </script>
</body>
</html>`;
}

module.exports = { renderEntryPage };
