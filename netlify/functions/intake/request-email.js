/* "We got your request": the one email every qualified inquiry gets, within
   a minute, sent by code. Me&Co. cream and navy with a night mode, a short
   journey trail, the summary of what they sent, and one booking button when
   Melody has a booking link set. Every word is fixed; only their own name
   and answers are read back to them. */

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* Brand palette (CLAUDE.md), plus the two text colors weareme.co itself
   uses: ink for body copy and mist for small text on navy. Nothing else
   appears in a message. */
const C = { navy: '#22315E', blue: '#2A4FBF', cream: '#FFFCF5', sand: '#EFE8DC', teal: '#6FAFA0', orange: '#E4572E', rose: '#D9A5A0', ink: '#3A3630', mist: '#C9D6F2' };

/* Each form choice in plain words. Keyed by the exact label on the form. */
const PLAIN = {
  'Business or website help (new site, redesign, refresh)': 'a website for your business',
  'Automation (systems that save time)': 'automating work you do by hand',
  'Systems (the backend or ops needs cleaning up)': 'setting up your systems',
  "I started something and can't finish it": 'finishing a project already started',
  "Consultation (workflows, operations, not sure where to start? we'll explain how we can help)": 'talking it through with us',
  'Branding (I need a brand, not just a website)': 'your branding',
};

/* The "something else" answer in the person's own words, flattened to one
   line. A link or an address in it is dropped so the message never carries
   one a stranger typed. */
function safeOther(needs) {
  const o = (needs || []).find((n) => /^Something else: /.test(n));
  if (!o) return '';
  const t = o.replace(/^Something else: /, '');
  if (/https?:|www\.|[\w.+-]+@[\w-]+\.\w/.test(t)) return '';
  return t.replace(/[*\[\]`]/g, '').replace(/\u2014/g, ',').trim();
}

/* Every need they picked, as display lines: the fixed picks in plain words,
   then the "something else" answer as written. */
function needLines(needs) {
  const lines = (needs || []).map((n) => PLAIN[n]).filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  const other = safeOther(needs);
  if (other) lines.push(other.charAt(0).toUpperCase() + other.slice(1));
  return lines;
}

const DISPLAY = "font-family:Fraunces,Georgia,'Times New Roman',serif;";
const FONT = "font-family:'DM Sans','Segoe UI',Roboto,Helvetica,Arial,sans-serif;";

const P = (inner) => `<p class="m-p" style="margin:0 0 16px;color:${C.ink};font-size:17px;line-height:1.7;">${inner}</p>`;

/* A link as a button, as weareme.co draws it: a blue pill with cream
   capitals. At night it turns cream with navy text. */
const button = (label, url) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 26px;"><tr><td class="m-btn" style="background:${C.blue};border-radius:999px;"><a class="m-btn-a" href="${esc(url)}" style="display:inline-block;padding:15px 30px;color:${C.cream};${FONT}font-size:13px;font-weight:700;letter-spacing:1.04px;text-transform:uppercase;text-decoration:none;">${esc(label)}</a></td></tr></table>`;

/* A summary box: sand background and a hairline border on all four sides. */
const card = (inner) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 22px;"><tr><td class="m-call" style="background:${C.sand};border:1px solid ${C.sand};border-radius:20px;padding:22px 24px;color:${C.ink};font-size:16px;line-height:1.75;${FONT}">${inner}</td></tr></table>`;

/* The small capitals label the site puts above every heading. */
const eyebrowHtml = (t) => `<div class="m-eye" style="${FONT}font-size:12px;font-weight:700;letter-spacing:3.12px;text-transform:uppercase;color:${C.blue};">${esc(t)}</div>`;

/* The two promises from the top of the interest form, numbered as the site numbers them. */
function promisesHtml(bookingUrl) {
  const row = (n, title, line) => `<tr><td valign="top" width="44" style="width:44px;padding:0 0 18px;"><div class="m-num" style="width:32px;height:32px;line-height:32px;border-radius:50%;background:${C.navy};color:${C.cream};text-align:center;${DISPLAY}font-size:15px;font-weight:600;">${n}</div></td><td valign="top" style="padding:3px 0 18px;${FONT}"><div class="m-hd" style="${DISPLAY}font-size:18px;font-weight:600;color:${C.navy};line-height:1.3;">${title}</div><div class="m-p" style="font-size:15px;color:${C.ink};line-height:1.6;margin-top:2px;">${line}</div></td></tr>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:4px 0 8px;">${
    row(1, 'A reply within 2 business days', bookingUrl ? 'Either a time to talk, or a straight answer that we&rsquo;re not the fit. Already picked a time? You&rsquo;re all set.' : 'Either a time to talk, or a straight answer that we&rsquo;re not the fit.')
  }${row(2, 'A proposal built for you', 'If it&rsquo;s a fit, you get a private proposal with exact scope and exact pricing.')}</table>`;
}

const LOGO = 'https://weareme.co/assets/logo-blue.png';
const LOGO_CREAM = 'https://weareme.co/assets/logo-cream-primary.png';
const PHOTO = 'https://weareme.co/assets/photo-couch-blue-web.jpg';

/* Melody's sign off, with her photo, the way "Meet Melody" sits on the site. */
const signoff = () => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 6px;"><tr>
  <td valign="middle" style="padding-right:14px;"><img src="${PHOTO}" width="56" height="56" alt="Melody Estrada" style="display:block;width:56px;height:56px;border-radius:50%;object-fit:cover;border:0;"></td>
  <td valign="middle" style="${FONT}"><div class="m-hd" style="${DISPLAY}font-size:19px;font-weight:600;color:${C.navy};">Melody</div><div class="m-p" style="font-size:13.5px;color:${C.ink};">Founder, Me&amp;Co.</div></td>
</tr></table>`;

function shell({ eyebrow, headline, preheader, body }) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
<style>
:root{color-scheme:light dark;supported-color-schemes:light dark}
.m-night{display:none}
@media (prefers-color-scheme: dark){
  .m-bg,.m-card,.m-top{background:${C.navy} !important}
  .m-day{display:none !important}
  .m-night{display:block !important}
  .m-hd{color:${C.cream} !important}
  .m-eye{color:${C.mist} !important}
  .m-tx,.m-p,.m-p strong{color:${C.mist} !important}
  .m-call,.m-call strong,.m-call span{background:${C.blue} !important;border-color:${C.blue} !important;color:${C.cream} !important}
  .m-btn{background:${C.cream} !important}
  .m-btn-a{color:${C.navy} !important}
  .m-num{background:${C.cream} !important;color:${C.navy} !important}
  .m-a{color:${C.mist} !important}
}
[data-ogsc] .m-bg,[data-ogsc] .m-card,[data-ogsc] .m-top{background:${C.navy} !important}[data-ogsc] .m-hd{color:${C.cream} !important}[data-ogsc] .m-p{color:${C.mist} !important}[data-ogsc] .m-call{background:${C.blue} !important;color:${C.cream} !important}
</style></head>
<body class="m-bg" style="margin:0;padding:0;background:${C.cream};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="m-bg" style="background:${C.cream};">
<tr><td align="center" style="padding:0;">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" class="m-card" style="max-width:640px;width:100%;background:${C.cream};">
  <tr><td class="m-top" style="padding:30px 36px 26px;background:${C.cream};">
    <a href="https://weareme.co" style="text-decoration:none;"><img class="m-day" src="${LOGO}" width="104" alt="Me&amp;Co." style="display:block;width:104px;border:0;"><img class="m-night" src="${LOGO_CREAM}" width="104" alt="Me&amp;Co." style="width:104px;border:0;"></a>
  </td></tr>
  <tr><td style="padding:22px 36px 4px;">
    ${eyebrowHtml(eyebrow)}
    <h1 class="m-hd" style="margin:12px 0 0;${DISPLAY}font-size:40px;line-height:1.08;color:${C.navy};font-weight:600;">${headline}</h1>
  </td></tr>
  <tr><td class="m-tx" style="padding:22px 36px 30px;${FONT}">
${body}
  </td></tr>
  <tr><td style="background:${C.navy};padding:34px 36px 30px;">
    <img src="${LOGO_CREAM}" width="96" alt="Me&amp;Co." style="display:block;width:96px;border:0;">
    <div style="margin-top:12px;${FONT}font-size:11px;letter-spacing:2.6px;text-transform:uppercase;color:${C.mist};">Systems, not just services.</div>
    <div style="margin-top:20px;${FONT}font-size:14px;line-height:2;">
      <a href="https://weareme.co/services" style="color:${C.cream};text-decoration:none;">Services</a>&nbsp;&nbsp;&middot;&nbsp;&nbsp;<a href="https://weareme.co/work" style="color:${C.cream};text-decoration:none;">Our Work</a>&nbsp;&nbsp;&middot;&nbsp;&nbsp;<a href="https://weareme.co/newsletter" style="color:${C.cream};text-decoration:none;">Newsletter</a>&nbsp;&nbsp;&middot;&nbsp;&nbsp;<a href="https://www.instagram.com/weareme.co/" style="color:${C.cream};text-decoration:none;">Instagram</a>
    </div>
    <div style="margin-top:14px;padding-top:14px;border-top:1px solid ${C.blue};${FONT}font-size:12px;color:${C.mist};">Me&amp;Co. &middot; weareme.co &middot; <a href="mailto:melody@weareme.co" style="color:${C.mist};text-decoration:none;">melody@weareme.co</a><br>Community over competition, always.</div>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

/* The confirmation, in the words of the interest form's own thank you.
   bookingUrl is Melody's booking link, or empty; with none set there is no
   button and she replies with a time herself. */
function composeRequestEmail(record, bookingUrl) {
  const first = String(record.name || '').trim().split(/\s+/)[0] || '';
  const needs = needLines(record.needs);
  const summary = card(
    `<div class="m-eye" style="${FONT}font-size:11px;font-weight:700;letter-spacing:2.6px;text-transform:uppercase;color:${C.blue};margin-bottom:8px;">What you told us</div>`
    + needs.map((w) => `<span style="color:${C.ink};">&#10003;&nbsp; ${esc(w)}</span>`).join('<br>')
    + `<div style="margin-top:12px;font-size:14px;"><strong style="color:${C.navy};">We&rsquo;ll reply to</strong> ${esc(record.email)}</div>`
  );
  const body = [
    P(`Hi ${esc(first || 'there')},`),
    P('Melody reads every one of these herself. You&rsquo;ll hear back within two business days, usually sooner.'),
    summary,
    `<p class="m-hd" style="margin:26px 0 14px;color:${C.navy};${DISPLAY}font-size:22px;font-weight:600;line-height:1.2;">What happens next</p>`,
    promisesHtml(bookingUrl),
  ].concat(bookingUrl ? [P('Want to grab a time now?'), button('Book a time with Melody', bookingUrl)] : [])
    .concat([P('Anything to add? Just reply to this email. Come as you are, spreadsheets optional.'), signoff()]).join('\n');
  const html = shell({ eyebrow: 'Received', headline: 'Got it. &iexcl;Gracias!', preheader: 'Melody reads every one of these herself. You will hear back within two business days.', body });
  const text = [
    `Hi ${first || 'there'},`, '',
    'Got it. ¡Gracias! Melody reads every one of these herself. You\'ll hear back within two business days, usually sooner.', '',
    'What you told us:',
  ].concat(needs.map((w) => '- ' + w)).concat([
    '', "We'll reply to " + record.email, '',
    'What happens next', '',
    '1. A reply within 2 business days. Either a time to talk, or a straight answer that we\'re not the fit.',
    '2. A proposal built for you. If it\'s a fit, you get a private proposal with exact scope and exact pricing.', '',
  ]).concat(bookingUrl ? ['Want to grab a time now? Book a time with Melody: ' + bookingUrl, ''] : [])
    .concat(['Anything to add? Just reply to this email. Come as you are, spreadsheets optional.', '', 'Melody', 'Founder, Me&Co.', 'weareme.co']).join('\n');
  return { subject: 'Got it. ¡Gracias!', html, text };
}

/* The one follow-up a qualified lead gets if they have not booked in two
   days. It exists only with a booking link to point at. */
function composeNudge(lead, bookingUrl) {
  const first = String(lead.name || '').trim().split(/\s+/)[0] || 'there';
  const body = [
    P(`Hi ${esc(first)},`),
    P('Just checking in. I&rsquo;d still love to hear what you&rsquo;re building, and I have a few times open this week.'),
    button('Book a time with Melody', bookingUrl),
    P('If now isn&rsquo;t the right time, no worries at all. Just reply and tell me, and we&rsquo;ll leave it here.'),
    signoff(),
  ].join('\n');
  const html = shell({ eyebrow: 'Still here', headline: 'Whenever you&rsquo;re ready.', preheader: 'Melody has a few times open this week.', body });
  const text = [`Hi ${first},`, '', "Just checking in. I'd still love to hear what you're building, and I have a few times open this week.", '', 'Book a time with Melody: ' + bookingUrl, '', "If now isn't the right time, no worries at all. Just reply and tell me, and we'll leave it here.", '', 'Melody', 'Founder, Me&Co.'].join('\n');
  return { subject: "Whenever you're ready", html, text };
}

/* The checks every send runs: both bodies, the footer, no em dash, no
   unfilled placeholder, only brand colors, no one-sided colored border.
   Returns the problems; an empty list means send. */
function checkEmail(msg) {
  const problems = [];
  if (!msg.html || !msg.text) problems.push('missing a body');
  if (!/Me&amp;Co\. &middot; weareme\.co/.test(msg.html || '')) problems.push('footer missing');
  const allowed = Object.values(C).map((h) => h.toLowerCase());
  for (const part of [msg.subject, msg.text, msg.html]) {
    if (/\u2014/.test(part || '')) problems.push('an em dash');
    if (/\{\{|\bTODO\b|PLACEHOLDER/.test(part || '')) problems.push('an unfilled placeholder');
  }
  const off = ((msg.html || '').match(/#[0-9A-Fa-f]{6}\b/g) || []).filter((h) => allowed.indexOf(h.toLowerCase()) === -1);
  if (off.length) problems.push('off-brand color ' + off[0]);
  if (/border-(left|right):[^;"]*#/i.test(msg.html || '')) problems.push('a one-sided colored border');
  return problems;
}

module.exports = { composeRequestEmail, composeNudge, checkEmail, needLines, shell, P, esc, C, DISPLAY, FONT };
