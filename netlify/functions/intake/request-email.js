/* "We got your request": the one email every qualified inquiry gets, within
   a minute, sent by code. Me&Co. cream and navy with a night mode, a short
   journey trail, the summary of what they sent, and one booking button when
   Melody has a booking link set. Every word is fixed; only their own name
   and answers are read back to them. */

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* Brand palette (CLAUDE.md). Nothing else appears in a message. */
const C = { navy: '#22315E', blue: '#2A4FBF', cream: '#FFFCF5', sand: '#EFE8DC', teal: '#6FAFA0', orange: '#E4572E', rose: '#D9A5A0' };

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

function trailHtml(at) {
  const steps = ['Request sent', 'Talk with Melody', 'Your plan'];
  const base = `width:30px;height:30px;line-height:30px;border-radius:50%;${DISPLAY}font-weight:700;font-size:14px;text-align:center;`;
  const cell = (t, i) => {
    const dot = i < at
      ? `<div class="m-done" style="${base}background:${C.teal};color:${C.navy};border:1.5px solid ${C.navy};">&#10003;</div>`
      : i === at
        ? `<div class="m-num" style="${base}background:${C.navy};color:${C.cream};border:1.5px solid ${C.navy};">${i + 1}</div>`
        : `<div class="m-off" style="${base}background:${C.cream};color:${C.navy};border:1.5px dashed ${C.navy};">${i + 1}</div>`;
    const here = i === at ? `<br><span class="m-here" style="color:${C.blue};font-weight:700;">you are here</span>` : '';
    return `<td align="center" valign="top" width="24%" style="width:24%;">${dot}<div class="m-trail-t" style="margin-top:6px;${FONT}font-weight:500;font-size:12px;color:${C.navy};">${t}${here}</div></td>`;
  };
  const line = `<td valign="top" width="14%" style="width:14%;padding-top:15px;"><div class="m-line" style="height:2px;background:${C.navy};font-size:0;line-height:0;">&nbsp;</div></td>`;
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 4px;"><tr>' + steps.map(cell).join(line) + '</tr></table>';
}

const P = (inner) => `<p class="m-p" style="margin:0 0 16px;color:${C.navy};font-size:16px;line-height:1.65;">${inner}</p>`;

/* A link as a button: blue with cream text, cream with navy text at night. */
const button = (label, url) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;"><tr><td class="m-btn" style="background:${C.blue};border:1.5px solid ${C.navy};border-radius:12px;"><a class="m-btn-a" href="${esc(url)}" style="display:inline-block;padding:12px 24px;color:${C.cream};${DISPLAY}font-size:15px;font-weight:700;text-decoration:none;">${esc(label)} &rarr;</a></td></tr></table>`;

/* A summary box: sand background and a hairline border on all four sides. */
const card = (inner) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 18px;"><tr><td class="m-call" style="background:${C.sand};border:1px solid ${C.navy};border-radius:14px;padding:18px 20px;color:${C.navy};font-size:15.5px;line-height:1.7;${FONT}">${inner}</td></tr></table>`;

function shell({ eyebrow, headline, preheader, body, trailAt }) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
<style>
:root{color-scheme:light dark;supported-color-schemes:light dark}
@media (prefers-color-scheme: dark){
  .m-bg{background:${C.navy} !important}
  .m-card{background:${C.navy} !important;border-color:${C.cream} !important}
  .m-head{background:${C.blue} !important}
  .m-hd,.m-wm{color:${C.cream} !important}
  .m-chip{background:${C.sand} !important;color:${C.navy} !important}
  .m-tx,.m-p,.m-p strong{color:${C.sand} !important}
  .m-call,.m-call strong,.m-call span{background:${C.blue} !important;color:${C.cream} !important;border-color:${C.cream} !important}
  .m-btn{background:${C.cream} !important;border-color:${C.cream} !important}
  .m-btn-a{color:${C.navy} !important}
  .m-trail-t{color:${C.sand} !important}
  .m-done{background:${C.teal} !important;color:${C.navy} !important;border-color:${C.cream} !important}
  .m-num{background:${C.cream} !important;color:${C.navy} !important;border-color:${C.cream} !important}
  .m-off{background:${C.navy} !important;color:${C.cream} !important;border-color:${C.cream} !important}
  .m-line{background:${C.cream} !important}
  .m-here{color:${C.teal} !important}
  .m-a{color:${C.teal} !important}
  .m-rule{border-color:${C.cream} !important}
  .m-foot{color:${C.sand} !important}
}
[data-ogsc] .m-bg{background:${C.navy} !important}[data-ogsc] .m-card{background:${C.navy} !important}[data-ogsc] .m-hd{color:${C.cream} !important}[data-ogsc] .m-p{color:${C.sand} !important}[data-ogsc] .m-call{background:${C.blue} !important;color:${C.cream} !important}
</style></head>
<body class="m-bg" style="margin:0;padding:0;background:${C.cream};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="m-bg" style="background:${C.cream};padding:0;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" class="m-card" style="max-width:640px;width:100%;background:${C.cream};border:1px solid ${C.navy};border-radius:16px;">
  <tr><td class="m-head" style="background:${C.navy};padding:22px 34px;border-radius:15px 15px 0 0;">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:10px;"><div style="width:12px;height:12px;background:${C.orange};border-radius:50%;font-size:0;line-height:0;">&nbsp;</div></td>
      <td class="m-wm" style="${DISPLAY}font-size:20px;font-weight:700;color:${C.cream};letter-spacing:-0.2px;">Me&amp;Co.</td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:34px 34px 6px;">
    <span class="m-chip" style="display:inline-block;${FONT}font-size:11.5px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:${C.navy};background:${C.sand};border:1px solid ${C.navy};padding:5px 11px;border-radius:6px;">${esc(eyebrow)}</span>
    <h1 class="m-hd" style="margin:16px 0 0;${DISPLAY}font-size:32px;line-height:1.1;color:${C.navy};font-weight:700;letter-spacing:-0.4px;">${esc(headline)}</h1>
    ${trailAt == null ? '' : trailHtml(trailAt)}
  </td></tr>
  <tr><td class="m-tx" style="padding:20px 34px 0;${FONT}">
${body}
  </td></tr>
  <tr><td style="padding:16px 34px 30px;">
    <div class="m-rule m-foot" style="border-top:1px solid ${C.navy};padding-top:16px;${FONT}font-size:11.5px;color:${C.navy};">
      Me&amp;Co. &middot; weareme.co
    </div>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

/* The confirmation. bookingUrl is Melody's own booking link, or empty when
   none is set; then the email says she will reach out and shows no button. */
function composeRequestEmail(record, bookingUrl) {
  const first = String(record.name || '').trim().split(/\s+/)[0] || '';
  const needs = needLines(record.needs);
  const summary = card(
    `<strong style="color:${C.navy};">You asked about</strong><br>`
    + needs.map((w) => `<span style="color:${C.navy};">&#10003;&nbsp; ${esc(w)}</span>`).join('<br>')
    + `<div style="margin-top:12px;font-size:14px;"><strong style="color:${C.navy};">We'll reach you at</strong> ${esc(record.email)}</div>`
  );
  const next = bookingUrl
    ? [
      P("Next is a short call with Melody, our founder. She'll hear where things are for you today and talk through what would help most."),
      P("Already picked a time? You're all set. Didn't get to it? Grab one here:"),
      button('Book a time with Melody', bookingUrl),
    ]
    : [
      P("Next is a short call with Melody, our founder. She'll reach out to set a time that works for you, and she'll hear where things are for you today and talk through what would help most."),
      P('Have times that do not work for you? Just reply to this email and tell us.'),
    ];
  const body = [
    P(`Hi ${esc(first || 'there')},`),
    P('Thank you so much for reaching out to Me&amp;Co. We got your request:'),
    summary,
    P("If there is anything you'd like to add, just reply to this email and we'll add it to your request."),
    `<p class="m-hd" style="margin:30px 0 10px;color:${C.navy};${DISPLAY}font-size:20px;font-weight:700;line-height:1.2;">What happens next</p>`,
  ].concat(next).concat([P('Me&amp;Co.')]).join('\n');
  const html = shell({ eyebrow: 'Request received', headline: 'We got your request', preheader: 'Here is what you sent us, and what happens next.', body, trailAt: 1 });
  const text = [
    `Hi ${first || 'there'},`, '',
    'Thank you so much for reaching out to Me&Co. We got your request:', '',
    'You asked about',
  ].concat(needs.map((w) => '- ' + w)).concat([
    '', "We'll reach you at " + record.email, '',
    "If there is anything you'd like to add, just reply to this email and we'll add it to your request.", '',
    'What happens next', '',
  ]).concat(bookingUrl
    ? [
      "Next is a short call with Melody, our founder. She'll hear where things are for you today and talk through what would help most.", '',
      "Already picked a time? You're all set. Didn't get to it? Book a time with Melody: " + bookingUrl, '',
    ]
    : [
      "Next is a short call with Melody, our founder. She'll reach out to set a time that works for you, and she'll hear where things are for you today and talk through what would help most.", '',
      'Have times that do not work for you? Just reply to this email and tell us.', '',
    ]).concat(['Me&Co.']).join('\n');
  return { subject: 'We got your request', html, text };
}

/* The one follow-up a qualified lead gets if they have not booked in two
   days. It exists only with a booking link to point at. */
function composeNudge(lead, bookingUrl) {
  const first = String(lead.name || '').trim().split(/\s+/)[0] || 'there';
  const body = [
    P(`Hi ${esc(first)},`),
    P("Just checking in. We'd still love to hear about what you're working on, and Melody has a few times open this week."),
    button('Book a time with Melody', bookingUrl),
    P("If now isn't the right time, no worries at all. Just reply and tell us, and we'll leave it here."),
    P('Me&amp;Co.'),
  ].join('\n');
  const html = shell({ eyebrow: 'Still here', headline: 'Whenever you are ready', preheader: 'Melody has a few times open this week.', body, trailAt: 1 });
  const text = [`Hi ${first},`, '', "Just checking in. We'd still love to hear about what you're working on, and Melody has a few times open this week.", '', 'Book a time with Melody: ' + bookingUrl, '', "If now isn't the right time, no worries at all. Just reply and tell us, and we'll leave it here.", '', 'Me&Co.'].join('\n');
  return { subject: 'Whenever you are ready', html, text };
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
