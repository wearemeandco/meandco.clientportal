/* ============================================================
   Me&Co. — one shared theme for every client-facing page
   ------------------------------------------------------------
   The portal used to define its own :root block and its own
   Google Fonts URL in four separate files (dashboard, card-detail,
   lock-screen, onboarding-form), and they had already drifted: the
   portal drifts onto its own typeface while the studio's own invoices
   and receipts (public/invoices/, public/receipts/) run on Prompt.
   Same studio, two typefaces, and the client sees both.

   So the tokens below are lifted directly off
   public/invoices/melody-project2.html and
   public/receipts/melody-project2-receipt-1.html, the best-looking
   artifacts this studio produces, and every client-facing page now
   requires them from here instead of restating them. Same reasoning
   that produced item-styles.js: one source, changed in one place.

   Colour roles, decided rather than inherited:
   - lime is the loudest colour in the palette, so it marks the loud
     thing, the one or two cards actually waiting on the client. It
     is not spent on "done".
   - done is the receipt's own paid-green (--green on --green-bg),
     quiet and restful on purpose.
   - electric blue is a link and focus colour only. It used to fill
     every chevron, kicker, button and border on the page, which is
     what made four accent colours fight for attention at once.
   - lavender is retired from the client-facing pages entirely.
   ============================================================ */

const FONT_LINK = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700;9..144,800&family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">`;

const TOKENS = `
  :root {
    --oxford: #22315E;
    --blue: #2A4FBF; --blue-ink: #1E3A94;
    --lime: #F3C7B8;
    /* #6f8a05 is a real token on weareme.co and the live stylesheet
       uses it exactly zero times, so the portal must not put it on
       microlabels, kickers, need-where lines, notes headers or passcode
       labels. It resolves to the brand navy, so all of those labels go
       navy at once. The token name stays so no rule breaks. */
    --lime-ink: #22315E;
    /* Lavender is the fourth studio colour and it is real: the live
       weareme.co stylesheet declares #DEB1FB and references it 8
       times. The portal runs all four, because it is supposed to match
       the website.

       The studio palette is exactly four colours: oxford, lime, blue,
       lavender. Coral (#FF9472) and sky (#9ED8FF) are not among them.
       Neither token name nor either hex value appears anywhere in
       weareme.co. Do not reintroduce them as decoration, and check
       any new colour against the live stylesheet before adding it. */
    --lavender: #6FAFA0;
    /* The studio's signature is a hard offset shadow, not a blur. Live
       site: .sticker:active carries "0 2px 0 0 var(--oxford)". That plus
       the 1.5px oxford outline is what makes a Mora element look stuck on
       the page rather than floated above it. */
    --shadow-hard: 0 3px 0 0 var(--oxford);
    /* The deeper press-off-the-page variant. Live site, .pkg-card and
       the primary button: "0 6px 0 0 var(--oxford), 0 12px 30px
       rgba(10,35,66,0.18)" at rest, collapsing toward the 2px version
       when pressed. That collapse is the whole interaction. */
    --shadow-hard-lg: 0 6px 0 0 var(--oxford), 0 12px 30px rgba(34, 49, 94, 0.18);
    --shadow-hard-sm: 0 2px 0 0 var(--oxford), 0 4px 12px rgba(34, 49, 94, 0.2);

    /* The two easing curves the live site is built on, and the reason
       its motion reads as Mora rather than as generic CSS. --ease-spring
       overshoots (1.56) which is what makes a card land with a small
       bounce instead of gliding to a stop. Every transition in the portal
       runs on one of these two. cubic-bezier(0.16, 1, 0.3, 1) is a curve
       the website uses nowhere, so it does not belong here. */
    --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
    --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
    --paper: #FFFCF5; --white: #FFFFFF;
    --panel: #F3ECDF; --panel-2: #EFE8DC;
    /* Body text is the brand navy, not near-black. The live site sets
       "body { color: var(--oxford) }" and declares #1a1a1a as
       --paper-ink without ever referencing it, so --paper-ink is not the
       body colour here either. It is the quietest mismatch to make and
       the one that touches every line of text on the page.
       --ink-soft and --ink-faint stay
       warm grey: the portal carries secondary and metadata text the
       marketing site simply doesn't have. */
    --ink: #22315E; --ink-soft: #3A3630; --ink-faint: #7B6F62;
    --green: #4a7a1e; --green-bg: #EAF6E1;
    /* The lines are the brand. weareme.co is built on hard oxford
       rules, 1.5px on panels and 2px on a header edge, and the portal
       matches it. Soft shadows in place of those rules are what makes
       the portal stop reading as the same studio as the website. The
       shadow tokens stay defined so nothing that references them breaks,
       but they are a whisper under the line, never the thing holding the
       shape. */
    --rule: 1.5px solid var(--oxford);
    --rule-strong: 2px solid var(--oxford);
    --rule-soft: 1.5px solid rgba(34, 49, 94, 0.14);
    --shadow: 0 8px 30px -22px rgba(34, 49, 94, 0.25);
    --shadow-sm: 0 4px 14px -12px rgba(34, 49, 94, 0.3);
    /* Live site: --radius-card 22px, --radius-lg 32px. Anything tighter
       (16px, say) reads noticeably more corporate than the website
       beside it. */
    --radius: 22px; --radius-sm: 14px;
    /* Buttons are rounded rectangles, not lozenges: less round, more
       square, still round enough. 999px fully rounds the ends at any
       height and is wrong here. The corner is about a fifth of the
       button's height, so on a 48px control that is roughly 12px.
       One token, because the moment this is a literal it drifts per
       file. */
    --radius-btn: 12px;
    /* Status pills are slightly rounded rectangles, not lozenges, same
       shape rule as the buttons: a bit square, a bit round.
       Deliberately not applied to .pill-external, which on the
       live portal genuinely is a full-round dark chip. */
    --radius-pill: 6px;
    --sans: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --display: 'Fraunces', Georgia, serif;
    --mono: 'JetBrains Mono', ui-monospace, monospace;
    /* Legacy aliases, so any rule still written against the old names
       keeps rendering instead of falling back to an unset variable. */
    --paper-ink: var(--ink);
  }`;

/* Shared page furniture: the document reset, the wordmark with the lime
   dot that the invoices and receipts open with, and the focus ring.
   Everything here is used by more than one page. */
const BASE = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: var(--paper); color: var(--ink);
    font-family: var(--sans); font-size: 16px; line-height: 1.65;
    -webkit-text-size-adjust: 100%;
  }
  h1, h2, h3, h4 { font-family: var(--display); color: var(--oxford); }
  a { color: var(--blue-ink); }
  :focus-visible { outline: 3px solid var(--blue); outline-offset: 2px; border-radius: 4px; }

  /* The studio signature, identical to the invoice and receipt letterhead. */
  .mark {
    font-family: var(--display); font-weight: 800; font-size: 1.05rem; color: var(--oxford);
    display: flex; align-items: center; gap: 9px; letter-spacing: -0.01em;
  }
  .mark .dot { width: 11px; height: 11px; border-radius: 50%; background: var(--lime); flex: none; }

  .microlabel {
    font-family: var(--mono); font-size: 0.66rem; font-weight: 700;
    letter-spacing: 0.09em; text-transform: uppercase; color: var(--lime-ink);
  }

  /* Long unbroken strings are real in this data: Melody's checklist
     carries a full claude.ai artifact URL as plain text. Without this it
     forces the whole page to scroll sideways on a phone, which is the
     one thing that must never happen here. */
  p, li, td, h1, h2, h3, h4, .wrap-any { overflow-wrap: anywhere; }

  /* ============================================================
     Motion, copied off the live site rather than reinvented
     ------------------------------------------------------------
     The colours, the lines and the animations are all part of the
     portal doing its job. A portal with almost no motion, running on a
     curve weareme.co uses nowhere, reads as a different product.

     The keyframe bodies below are byte-for-byte what the live
     stylesheet declares, so the portal bounces on the same curve the
     website does instead of merely bouncing.
     ============================================================ */
  @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }
  @keyframes pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(205, 242, 43, 0.7); } 50% { box-shadow: 0 0 0 8px rgba(205, 242, 43, 0); } }
  @keyframes pulse-soft { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
  @keyframes drawLine { to { transform: scaleX(1); } }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* The site opens every section on a staggered fadeUp: 0.05s, 0.2s,
     0.4s, 0.55s on the hero's four elements. Same idea here, applied to
     whatever a page marks as its top-level sequence, so the dashboard
     assembles itself instead of appearing all at once. */
  .rise { animation: fadeUp 0.7s var(--ease-out) backwards; }
  .stagger > * { animation: fadeUp 0.6s var(--ease-out) backwards; }
  .stagger > *:nth-child(1) { animation-delay: 0.05s; }
  .stagger > *:nth-child(2) { animation-delay: 0.12s; }
  .stagger > *:nth-child(3) { animation-delay: 0.19s; }
  .stagger > *:nth-child(4) { animation-delay: 0.26s; }
  .stagger > *:nth-child(5) { animation-delay: 0.33s; }
  .stagger > *:nth-child(6) { animation-delay: 0.40s; }
  .stagger > *:nth-child(7) { animation-delay: 0.47s; }
  .stagger > *:nth-child(8) { animation-delay: 0.54s; }
  .stagger > *:nth-child(n + 9) { animation-delay: 0.6s; }

  /* The site's card hover, exactly: a spring lift with a half-degree
     tilt, and the hard oxford shadow deepening underneath it. This is
     the single most recognisable Mora interaction and the portal had
     no version of it. */
  .lift { transition: transform 0.35s var(--ease-spring), box-shadow 0.25s var(--ease-out); }
  .lift:hover { transform: translateY(-6px) rotate(-0.5deg); box-shadow: var(--shadow-hard-lg); }

  /* The lime dot in the wordmark is the studio's "we're live" signal on
     the website. Same pulse here. */
  .mark .dot { animation: pulse 2s ease-in-out infinite; }

  /* Reduced motion is not optional on a page clients have to read to
     get their work done. Everything above degrades to nothing. */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.001ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.001ms !important;
      scroll-behavior: auto !important;
    }
    .lift:hover { transform: none; }
  }`;

module.exports = { FONT_LINK, TOKENS, BASE };
