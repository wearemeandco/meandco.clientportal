#!/usr/bin/env node
/* ============================================================
   Me&Co. — brand guard
   ------------------------------------------------------------
   Run before any deploy:  node scripts/verify-brand.js

   Why this exists. The portal's branding drifted twice in four days
   (the 08-10 pass and the 08-13 pass), and each time it drifted
   *silently*: the pages still rendered, the tests still passed, nothing
   errored, and the only way anyone noticed was Melody looking at her
   phone. Worse, theme.js carried two comments asserting values as
   "the real hex values off the live site" that were never on the live
   site at all. A comment cannot fail. This file can.

   Every assertion below encodes a decision that was made deliberately
   and has already been undone at least once by accident. If one of
   these fires, the fix is almost never to edit this file: it is that
   something changed the client-facing brand without meaning to.

   Deliberately NOT checked: anything about layout, spacing, copy, or
   card content. Those are supposed to change per client. Only the
   brand invariants live here.
   ============================================================ */

const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2] || path.join(__dirname, '..');
const PORTAL = path.join(ROOT, 'netlify', 'functions', 'portal');

const failures = [];
const passes = [];
function check(label, ok, detail) {
  (ok ? passes : failures).push(label + (ok || !detail ? '' : '  -> ' + detail));
}

/* Comments are stripped everywhere before matching. This matters: this
   file's own rules, and theme.js's explanatory comments, both mention
   the very strings being banned. Matching raw text would make the guard
   fail on its own documentation. */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const files = fs.readdirSync(PORTAL).filter((f) => f.endsWith('.js'));
const sources = {};
for (const f of files) sources[f] = stripComments(fs.readFileSync(path.join(PORTAL, f), 'utf8'));
const allCss = Object.values(sources).join('\n');

const theme = sources['theme.js'] || '';
const tokenOf = (name) => {
  const m = theme.match(new RegExp('--' + name + ':\\s*([^;]+)'));
  return m ? m[1].trim() : null;
};

/* ---- 1. The palette ------------------------------------------------
   Checked against the live weareme.co stylesheet.
   These four are the studio palette; nothing else is. */
const PALETTE = {
  oxford: '#22315E',
  blue: '#2A4FBF',
  lime: '#F3C7B8',
  lavender: '#6FAFA0',
  paper: '#FFFCF5',
  white: '#FFFFFF',
};
for (const [name, hex] of Object.entries(PALETTE)) {
  const got = tokenOf(name);
  check(`token --${name} is ${hex}`, got === hex, `found ${got}`);
}

/* --coral and --sky were documented in theme.js as lifted off the live
   site. They appear nowhere on weareme.co and nothing ever
   referenced them. If they come back, someone re-invented them. */
check('no --coral / --sky tokens', !/--(coral|sky)\s*:/.test(theme));

/* Body text is the brand navy. The live site sets body to var(--oxford)
   and declares #1a1a1a as --paper-ink without ever using it; the portal
   had that unused value as its actual text colour. */
check('--ink is the brand navy, not #1a1a1a', tokenOf('ink') === '#22315E', `found ${tokenOf('ink')}`);

/* ---- 2. Motion -----------------------------------------------------
   The site's two curves, exactly. --ease-spring overshoots at 1.56;
   that overshoot is the reason Mora motion reads as Mora. */
check('--ease-out is the site curve', tokenOf('ease-out') === 'cubic-bezier(0.22, 1, 0.36, 1)', `found ${tokenOf('ease-out')}`);
check('--ease-spring is the site curve', tokenOf('ease-spring') === 'cubic-bezier(0.34, 1.56, 0.64, 1)', `found ${tokenOf('ease-spring')}`);

/* step-shell.js once declared its own .stagger on cubic-bezier(0.16, 1,
   0.3, 1) after BASE, so it silently won and the onboarding flow ran a
   curve the website uses nowhere. Any reappearance is that same bug. */
const offBrand = files.filter((f) => /cubic-bezier\(0\.16/.test(sources[f]));
check('no off-brand easing curve anywhere', offBrand.length === 0, `in ${offBrand.join(', ')}`);

/* theme.js owns the .stagger entrance for every page. A page that
   redefines it wins by source order and drifts alone, which is exactly
   how step-shell.js ended up on its own curve.

   Only a redefinition counts. Pages are allowed, and expected, to
   neutralise the entrance inside their reduced-motion block
   ("animation: none", "animation-delay: 0s"); flagging those would make
   this check fire on correct code forever, which is how a guard gets
   switched off instead of fixed. So: fail only when a non-theme file
   sets .stagger's `animation` shorthand to an actual keyframe. */
const dupeStagger = files.filter((f) => {
  if (f === 'theme.js') return false;
  for (const m of sources[f].matchAll(/\.stagger\s*>\s*\*[^{}]*\{([^}]*)\}/g)) {
    const anim = m[1].match(/(?:^|;)\s*animation:\s*([A-Za-z][\w-]*)/);
    if (anim && anim[1] !== 'none') return true;
  }
  return false;
});
check('only theme.js defines the .stagger entrance', dupeStagger.length === 0, `redefined in ${dupeStagger.join(', ')}`);

check('reduced-motion guard present', /prefers-reduced-motion/.test(theme));

/* ---- 3. Status colour semantics ------------------------------------
   Lime = Complete, lavender = In progress, blue = Needs you.
   The hard rule: Complete and Needs-you must never be the same colour.
   A status colour cannot mean both "ignore this" and "act on this". */
const ruleBody = (css, sel) => {
  const i = css.indexOf(sel + ' {');
  if (i < 0) return null;
  return css.slice(i, css.indexOf('}', i) + 1);
};
const bgOf = (css, sel) => {
  const b = ruleBody(css, sel);
  if (!b) return null;
  const m = b.match(/background:\s*([^;]+)/);
  return m ? m[1].trim() : null;
};

const dash = sources['dashboard.js'] || '';
const items = sources['item-styles.js'] || '';

check('.pill-complete is lime', bgOf(dash, '.pill-complete') === 'var(--lime)', `found ${bgOf(dash, '.pill-complete')}`);
check('.pill-in_progress is lavender', bgOf(dash, '.pill-in_progress') === 'var(--lavender)', `found ${bgOf(dash, '.pill-in_progress')}`);
check('.pill-needs is blue', bgOf(dash, '.pill-needs') === 'var(--blue)', `found ${bgOf(dash, '.pill-needs')}`);
check(
  'Complete and Needs-you are different colours',
  bgOf(dash, '.pill-complete') !== bgOf(dash, '.pill-needs')
);

/* The in-card chips were left on the old green/grey for a full cycle
   while the dashboard moved to lime/lavender, so one card showed two
   visual languages for the same word. */
check('.item-status-complete matches the dashboard', bgOf(items, '.item-status-complete') === 'var(--lime)', `found ${bgOf(items, '.item-status-complete')}`);
check('.item-status-in_progress matches the dashboard', bgOf(items, '.item-status-in_progress') === 'var(--lavender)', `found ${bgOf(items, '.item-status-in_progress')}`);

/* The retired palette. If a client-facing page starts painting status
   with the muted green again, the studio colours are being replaced by
   defaults a second time. */
check('no muted green on status chips', !/(pill|item-status)-complete\s*\{[^}]*var\(--green/.test(allCss));

/* The same status must use the same word everywhere. The dashboard said
   COMPLETE while the pill inside that very card said DONE, which is the
   quietest kind of drift: both look fine alone and only disagree when a
   client opens a card. */
const labelMap = (src, name) => {
  const m = src.match(new RegExp(name + '\\s*=\\s*\\{([\\s\\S]*?)\\}'));
  if (!m) return null;
  const out = {};
  for (const kv of m[1].matchAll(/(\w+)\s*:\s*'([^']*)'/g)) out[kv[1]] = kv[2];
  return out;
};
const dashLabels = labelMap(dash, 'STATUS_LABEL');
const itemLabels = labelMap(sources['card-detail.js'] || '', 'ITEM_STATUS_LABEL');
const labelMismatch = (dashLabels && itemLabels)
  ? Object.keys(itemLabels).filter((k) => dashLabels[k] !== itemLabels[k])
  : ['could not parse label maps'];
check(
  'card and dashboard use the same status words',
  labelMismatch.length === 0,
  labelMismatch.map((k) => `${k}: "${dashLabels && dashLabels[k]}" vs "${itemLabels && itemLabels[k]}"`).join('; ')
);

/* ---- 4. Action colour ----------------------------------------------
   View / Open are blue. They were lime, which put a lime action button
   directly under a lime COMPLETE pill meaning the opposite thing. */
check('.embed-open-btn is blue, not lime', bgOf(items, '.embed-open-btn') === 'var(--blue)', `found ${bgOf(items, '.embed-open-btn')}`);
check('.tag (LINK/NOTE badge) is lavender', bgOf(items, '.tag') === 'var(--lavender)', `found ${bgOf(items, '.tag')}`);
check('.pill-external is the dark chip', bgOf(items, '.pill-external') === 'var(--oxford)', `found ${bgOf(items, '.pill-external')}`);

/* ---- 5. Lines and shape --------------------------------------------
   The lines are the brand. The 08-10 pass replaced hard oxford rules
   with soft shadows and that alone stopped the portal reading as the
   same studio as the website. */
check('--rule is a hard 1.5px oxford line', tokenOf('rule') === '1.5px solid var(--oxford)', `found ${tokenOf('rule')}`);
check('--rule-strong is a hard 2px oxford line', tokenOf('rule-strong') === '2px solid var(--oxford)', `found ${tokenOf('rule-strong')}`);
check('--shadow-hard is an offset, not a blur', /0 3px 0 0/.test(tokenOf('shadow-hard') || ''), `found ${tokenOf('shadow-hard')}`);
check('--radius-btn is 12px', tokenOf('radius-btn') === '12px', `found ${tokenOf('radius-btn')}`);
check('--radius-pill is 6px', tokenOf('radius-pill') === '6px', `found ${tokenOf('radius-pill')}`);

/* 999px fully rounds any element to a lozenge. Only two things on the
   client-facing pages are supposed to be fully round: the EXTERNAL
   chip and the progress meter rail. Everything else uses a token. */
const lozenges = [];
for (const f of files) {
  const lines = sources[f].split('\n');
  lines.forEach((line, i) => {
    if (!/border-radius:\s*999px/.test(line)) return;
    if (/meter|pill-external|cover-wordmark/.test(line)) return;
    // the selector may be on an earlier line; look back a little
    const ctx = lines.slice(Math.max(0, i - 4), i + 1).join(' ');
    if (/meter|pill-external|cover-wordmark/.test(ctx)) return;
    lozenges.push(`${f}:${i + 1}`);
  });
}
check('no stray 999px lozenges', lozenges.length === 0, lozenges.join(', '));

/* ---- 6. Surface stack ----------------------------------------------
   White panel, beige rows. This was inverted, which made every row
   lighter than the surface behind it and flattened the list. */
check('.project-body is white', bgOf(dash, '.project-body') === 'var(--white)', `found ${bgOf(dash, '.project-body')}`);
check('.card-acc rows are beige', bgOf(dash, '.card-acc') === 'var(--panel)', `found ${bgOf(dash, '.card-acc')}`);

/* ---- 7. Structural integrity ---------------------------------------
   Every var() must resolve and every animation must have keyframes.
   An undefined var silently falls back to nothing, which is how a
   colour disappears without any error. */
const declared = new Set([...theme.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
const used = new Set([...allCss.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]));
const undef = [...used].filter((v) => !declared.has(v));
check('every var() is defined in theme.js', undef.length === 0, undef.join(', '));

const keyframes = new Set([...allCss.matchAll(/@keyframes\s+([A-Za-z0-9_-]+)/g)].map((m) => m[1]));
const animated = [...new Set([...allCss.matchAll(/animation:\s*([A-Za-z][\w-]*)/g)].map((m) => m[1]))].filter((a) => a !== 'none');
const orphans = animated.filter((a) => !keyframes.has(a));
check('every animation has @keyframes', orphans.length === 0, orphans.join(', '));

/* ---- report -------------------------------------------------------- */
console.log(`\nMora brand guard  (${passes.length + failures.length} checks)\n`);
if (!failures.length) {
  console.log(`  all ${passes.length} passed. Brand is intact.\n`);
  process.exit(0);
}
passes.forEach((p) => console.log('  ok    ' + p));
console.log('');
failures.forEach((f) => console.log('  FAIL  ' + f));
console.log(`\n${failures.length} of ${passes.length + failures.length} checks failed.`);
console.log('The brand drifted. Fix the code, not this file, unless the');
console.log('decision itself genuinely changed.\n');
process.exit(1);
