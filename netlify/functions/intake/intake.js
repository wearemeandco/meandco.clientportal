/* ============================================================
   Me&Co., the front door: /start
   ------------------------------------------------------------
   Melody's job is to get on the phone. This system's job is to
   ensure that happens. The brief strategy is logic based and split
   in two: an inquiry first, then a customized brief after the
   discovery call.

   So this file is stage 1 only, and stage 1 has exactly one job:
   get a stranger onto her calendar in under two minutes. It asks
   what is needed to qualify and quote, and nothing else. Mission,
   brand feelings, integrations, page lists, all of that is stage 2
   (brief-form.js), asked after the call and only the parts that
   turned out to matter. Asking a stranger for their mission
   statement before they have hired anyone is how a form gets
   abandoned.

   Two routes, deliberately two pages rather than one branching
   mega page, so each one has a progress meter that tells the truth:

     /start          entry point. New here, or already a client.
                     Existing clients sign in with email and password
                     (Netlify Identity), with the passcode kept as a
                     working fallback.
     /start/inquiry  the stage 1 inquiry: name, a checklist of what
                     they need, email. Three questions. The booking
                     link is not in the page; it arrives in the
                     response to a submission that passed the gate.

   The confirmation screen shows the booking link as a button only
   when qualifyInquiry below passed the submission. Anything it does
   not pass sees a screen that says a link is coming and waits for a
   human. The gate is deterministic code, never a judgment call, so a
   bot and a real nonprofit director do not both walk away with a
   genuine slot on her calendar. Noah, the qualifying agent, does not exist yet, and this
   build deliberately does not pretend he does.

   A stage 1 inquiry sends one real internal email, Everly's own
   inbox cc Melody, so it reaches her hourly mail-triage the same
   way a client reply does. That happens for every submission,
   qualified or not. A qualified one also gets the branded "We got your
   request" confirmation from inquiry-mail.js. Sign in emails (invite, confirm, password reset) are
   sent by Netlify Identity itself, not from this code.
   ============================================================ */

const { FONT_LINK, TOKENS, BASE } = require('../portal/theme.js');
const { STEP_STYLE, STEP_SCRIPT } = require('../portal/step-shell.js');
const { getAllClients } = require('../portal/clients.js');
const { saveIntakeRecord } = require('../portal/intake-store.js');
const { renderEntryPage } = require('./entry-page.js');
const inquiryMail = require('./inquiry-mail.js');
const { composeRequestEmail } = require('./request-email.js');
const { renderLoginPage } = require('./login-page.js');
const resetPages = require('./reset-pages.js');
const { handleForgot } = require('../portal/forgot.js');
const { renderReviewPage } = require('./review-page.js');
const { stage } = require('./staging.js');
const session = require('../portal/session.js');
const passcodes = require('../portal/passcodes.js');
const adminAuth = require('../lib/admin-auth.js');

// A submission has to actually reach Everly. Not through Netlify Forms,
// see intake-store.js's own reasoning for why that is the wrong tool
// here (a dynamic multi-step form loses fields to Netlify's static
// build-time scanner). The notification is a real email through the
// Resend HTTP API, so a new inquiry reaches Everly's inbox the way a
// client reply does. It is internal (Everly's own inbox, cc Melody),
// never a client-facing send, so it does not touch the A5 approval path.
// The confirmation to the stranger is built in request-email.js and sent
// by inquiry-mail.js.
const DEFAULT_OLIVIA_FROM = 'Everly <everly@admin.weareme.co>';

async function notifyEverlyOfInquiry(record, delivery) {
  const key = process.env.RESEND_API_KEY || process.env.RESEND_KEY;
  if (!key) {
    console.error('[intake] Neither RESEND_API_KEY nor RESEND_KEY is set in this site\'s environment, inquiry ' + record.id + ' was saved but not emailed.');
    return;
  }
  const lines = [
    'New stage 1 inquiry, ' + record.id + '.',
    '',
    'Name: ' + record.name,
    'Email: ' + record.email,
    'What they need:',
  ]
    .concat((record.needs || []).map((n) => '- ' + n))
    .concat([
      '',
      // Said as it actually happened, never as it was meant to happen.
      // The send is attempted before this notification is composed, so
      // this line reports a result rather than an intention.
      !record.qualified
        ? 'NOT qualified on the deterministic check, so no booking link went out. Reasons: ' +
          (record.qualificationReasons || []).join('; ') +
          '. This one waits for a human review before anything is sent.'
        : delivery && delivery.sent
          ? 'Qualified on the deterministic check, and the booking link has been emailed to them.'
          : 'Qualified on the deterministic check, but the send was refused, so no booking link has been emailed to them. They were shown the link on the thank-you screen, and it may still need to go out by hand. Reason: ' +
            ((delivery && delivery.reason) || 'unknown'),
      '',
      'Full record at /admin/inquiries.',
    ])
    .filter(Boolean);
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'inquiry/' + record.id + '/olivia-notice',
      },
      body: JSON.stringify({
        from: process.env.PORTAL_MAIL_FROM || DEFAULT_OLIVIA_FROM,
        to: ['everly@admin.weareme.co'],
        cc: ['melody@weareme.co'],
        subject: 'New inquiry: ' + record.name,
        text: lines.join('\n'),
      }),
    });
    if (!res.ok) {
      let reason = '';
      try { reason = String((await res.json()).message || '').slice(0, 200); } catch (e) { reason = 'unreadable reply'; }
      console.error('[intake] Inquiry ' + record.id + ' was saved but Resend refused the notification, status ' + res.status + ': ' + reason);
    }
  } catch (err) {
    console.error('[intake] Inquiry ' + record.id + ' was saved but the notification email failed: ' + err.message);
  }
}

/* Melody's booking link comes from the BOOKING_URL environment variable,
   read when needed. Unset, no link is shown or emailed and the confirmation
   says Melody will reach out to set a time. */
const bookingUrl = inquiryMail.bookingUrl;
// The humans are gated. Every public-facing
// fallback contact on the intake side routes through Everly, not
// Melody directly, same principle as everywhere else in this system,
// a stranger's first touch is always an agent. The internal new-inquiry
// notification above still cc's Melody on purpose, that is her staying
// looped on real leads internally, not a public contact point.
const CONTACT_EMAIL = 'everly@admin.weareme.co';

/* The checklist, in Melody's own words. These strings are
   the spec, not a paraphrase of it. "I started something and can't finish
   it" stays first person and stays human on purpose: it is the category
   people actually arrive in, and nobody has ever typed "project
   completion assistance" into a form about their own half built website.

   Consultation and Branding are two separate items, never one design
   and beauty item: Consultation is anchored to workflows
   and operations, for someone who does not yet know what they need and
   wants it explained, and Branding stands on its own rather than being
   folded into a website line.

   The last one is the escape hatch she asked for by name: a prospect who
   fits none of the six says so in their own words instead of picking the
   closest wrong box. A real, non-empty answer there counts as a selection
   everywhere a fixed category does, in the gate, in Everly's notification,
   and reflected back in the confirmation. */
const NEEDS = [
  { id: 'business', label: 'Business or website help (new site, redesign, refresh)' },
  { id: 'automation', label: 'Automation (systems that save time)' },
  { id: 'systems', label: 'Systems (the backend or ops needs cleaning up)' },
  { id: 'unfinished', label: "I started something and can't finish it" },
  { id: 'consultation', label: "Consultation (workflows, operations, not sure where to start? we'll explain how we can help)" },
  { id: 'branding', label: 'Branding (I need a brand, not just a website)' },
  { id: 'other', label: 'Something else? Tell us', other: true },
];

const NEED_IDS = NEEDS.map((n) => n.id);
const NEED_OTHER_MAX = 160;

/* One line, length capped, control characters gone. This string is written
   by a stranger and then read back inside two real emails, so it gets
   flattened before it goes anywhere near a message body. */
function cleanOneLine(value, max) {
  const raw = String(value == null ? '' : value);
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i);
    out += code < 32 || code === 127 ? ' ' : raw[i];
  }
  return out.replace(/\s+/g, ' ').trim().slice(0, max);
}

/* ------------------------------------------------------------
   The qualification gate
   ------------------------------------------------------------
   Showing the booking link on screen to every
   submission would make qualification meaningless, because a bot and
   a real nonprofit director would both walk out with a real slot on
   her calendar. So the confirmation screen shows the link only when
   this function passed the submission, and the same result decides
   whether the link is emailed. It is deterministic on purpose, per CLAUDE.md:
   a prompt is not a security boundary, and there is no agent here
   to judge anything yet anyway. Noah, the qualifying agent, is not
   built. Until he is, anything this gate does not pass simply waits
   for a human, and Everly is notified of every submission either
   way, so nothing is lost by waiting.

   Cased scripts and uncased ones both count as letters, so a name
   in Greek, Korean, or Japanese is a real name here. The vowel rule
   below only ever looks at an ASCII latin run, so it cannot fire on
   a script it does not understand. */
function hasRealLetters(value) {
  const s = String(value == null ? '' : value);
  let count = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c.toLowerCase() !== c.toUpperCase()) count += 1;
    else if (s.charCodeAt(i) > 0x2fff) count += 1;
  }
  return count >= 2;
}

function looksLikeGibberish(value) {
  const s = String(value == null ? '' : value).toLowerCase().trim();
  if (!s) return true;
  if (/(.)\1{3,}/.test(s)) return true;
  if (/(asdf|sdfg|qwer|wert|zxcv|hjkl|qazwsx|1234)/.test(s)) return true;
  const words = s.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const letters = words[i].replace(/[^a-z]/g, '');
    if (letters.length >= 8 && !/[aeiouy]/.test(letters)) return true;
  }
  return false;
}

/* Deliberately stricter than the handler's own "must contain an @".
   That check is the hard refusal, this one is the qualification
   question, and "@nowhere" clears the first and fails the second. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@.]+\.[^\s@]+$/;

function qualifyInquiry(input) {
  const name = String(input.name || '').trim();
  const email = String(input.email || '').trim();
  const selections = input.selections || [];
  const reasons = [];

  if (!name) reasons.push('no name was given');
  else if (!hasRealLetters(name) || looksLikeGibberish(name)) reasons.push('the name does not read as a real name');
  if (!EMAIL_SHAPE.test(email)) reasons.push('the email address is malformed');
  if (!selections.length) reasons.push('nothing was selected on the checklist');
  if (input.other && looksLikeGibberish(input.other)) reasons.push('the free text answer reads as gibberish');

  return { passed: reasons.length === 0, reasons };
}

const sendBookingLink = inquiryMail.sendBookingLink;

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const NO_STORE = {
  'Cache-Control': 'no-store, private, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

function html(statusCode, body) {
  return { statusCode, headers: Object.assign({ 'Content-Type': 'text/html; charset=utf-8' }, NO_STORE), body };
}
function json(statusCode, obj, extraHeaders) {
  return {
    statusCode,
    headers: Object.assign({ 'Content-Type': 'application/json' }, NO_STORE, extraHeaders || {}),
    body: JSON.stringify(obj),
  };
}

function parseBody(event) {
  let raw = event.body || '';
  if (event.isBase64Encoded) raw = Buffer.from(raw, 'base64').toString('utf8');
  try {
    return JSON.parse(raw || '{}');
  } catch (err) {
    return {};
  }
}

function originOf(event) {
  const headers = event.headers || {};
  const host = headers.host || headers.Host || 'localhost:8787';
  const proto = /^localhost|^127\.0\.0\.1/.test(host) ? 'http' : 'https';
  return proto + '://' + host;
}

function page(title, bodyHtml, extraStyle, extraScript) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>${escapeHtml(title)}</title>
${FONT_LINK}
<style>
${TOKENS}
${BASE}
${STEP_STYLE}
${extraStyle || ''}
</style>
</head>
<body>
${bodyHtml}
<script>
${STEP_SCRIPT}
${extraScript || ''}
</script>
</body>
</html>`;
}


/* ------------------------------------------------------------
   /start/inquiry, stage 1
   ------------------------------------------------------------ */
function renderInquiry() {
  /* The checklist cards. Built on .tier from step-shell.js on purpose,
     so the hover lift, the selected state, and the syncChoices class
     mirroring are the same mechanics the rest of the system already
     uses, rather than a second, worse version of them living here. The
     only thing added below is the entrance: the same riseIn keyframe
     and the same 0.06s stagger rhythm the panel's own children get,
     continuing from where the panel's stagger leaves off, so the list
     arrives a line at a time instead of as a block of boxes. */
  const needCards = NEEDS.map(
    (n) => `
        <label class="tier need">
          <input type="checkbox" name="needs" value="${escapeHtml(n.id)}">
          <span class="need-box">&#10003;</span>
          <span class="need-label">${escapeHtml(n.label)}</span>
        </label>`
  ).join('');

  const style = `
  .need-grid { display: grid; gap: 10px; margin-top: 0.5rem; }
  .need { display: flex; align-items: flex-start; gap: 13px; padding: 15px 17px; animation: riseIn 0.55s cubic-bezier(0.16, 1, 0.3, 1) backwards; }
  .need:nth-child(1) { animation-delay: 0.26s; }
  .need:nth-child(2) { animation-delay: 0.32s; }
  .need:nth-child(3) { animation-delay: 0.38s; }
  .need:nth-child(4) { animation-delay: 0.44s; }
  .need:nth-child(5) { animation-delay: 0.50s; }
  .need:nth-child(6) { animation-delay: 0.56s; }
  .need:nth-child(n+7) { animation-delay: 0.62s; }
  .need-box {
    flex: none; width: 22px; height: 22px; margin-top: 1px; border-radius: 7px;
    border: 1.5px solid var(--panel-2); background: var(--white); color: transparent;
    font-size: 0.78rem; font-weight: 700; display: flex; align-items: center; justify-content: center;
    transition: background 0.16s ease, border-color 0.16s ease, color 0.16s ease;
  }
  .need.on .need-box { background: var(--blue); border-color: var(--blue); color: var(--white); }
  .need-label { font-family: var(--display); font-weight: 700; font-size: 0.97rem; line-height: 1.35; color: var(--oxford); }
  .need-other { display: none; margin-top: 12px; }
  .need-other.show { display: block; animation: riseIn 0.45s cubic-bezier(0.16, 1, 0.3, 1) backwards; }
  .need-other .field { margin-top: 0; }
  @media (prefers-reduced-motion: reduce) { .need, .need-other.show { animation: none; } }
  .done-shell { text-align: center; }
  .done-mark {
    width: 62px; height: 62px; border-radius: 50%; background: var(--green-bg); color: var(--green);
    display: flex; align-items: center; justify-content: center; font-size: 1.7rem; margin: 0 auto 1.1rem;
    animation: popIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  @keyframes popIn { from { opacity: 0; transform: scale(0.7); } to { opacity: 1; transform: none; } }
  @media (prefers-reduced-motion: reduce) { .done-mark { animation: none; } }
  .btn-row { display: flex; gap: 10px; flex-wrap: wrap; }`;

  const body = `
<div class="progress-rail"><div class="progress-fill" id="progressFill"></div></div>
<div class="step-count" id="stepCount"></div>

<div class="step-panel" data-step-panel="you">
  <div class="wrap panel-shell">
    <div class="sheet stagger">
      <p class="eyebrow">Inquiry &middot; 1 of 3</p>
      <h2 class="step-h2">First, who am I talking to?</h2>
      <p class="step-blurb">Three questions, under a minute. The real conversation happens live, once we have a time booked.</p>
      <label class="field" id="f-name">
        <span class="field-title">Your name</span>
        <input type="text" name="name" autocomplete="name">
      </label>
      <div class="error-box" id="err-you"></div>
    </div>
  </div>
</div>

<div class="step-panel" data-step-panel="need">
  <div class="wrap panel-shell">
    <div class="sheet stagger">
      <p class="eyebrow">Inquiry &middot; 2 of 3</p>
      <h2 class="step-h2">What do you need help with?</h2>
      <p class="step-blurb">Pick everything that fits. More than one is normal, most projects are a mix.</p>
      <div class="field">
        <div class="need-grid">${needCards}</div>
        <div class="need-other" id="need-other">
          <label class="field">
            <span class="field-title">Tell us what it is</span>
            <input type="text" name="needsOther" id="needs-other-input" maxlength="${NEED_OTHER_MAX}" placeholder="In your own words">
          </label>
        </div>
      </div>
      <div class="error-box" id="err-need"></div>
    </div>
  </div>
</div>

<div class="step-panel" data-step-panel="email" data-hide-next>
  <div class="wrap panel-shell">
    <div class="sheet stagger">
      <p class="eyebrow">Inquiry &middot; 3 of 3</p>
      <h2 class="step-h2">Where do we reach you?</h2>
      <p class="step-blurb">One address, and that is the whole form.</p>
      <label class="field" id="f-email">
        <span class="field-title">Email</span>
        <input type="email" name="email" autocomplete="email">
      </label>
      <div class="error-box" id="err-send"></div>
      <div class="btn-row" style="margin-top:1.6rem">
        <button class="btn solid" type="button" id="send-btn">Send my inquiry</button>
      </div>
    </div>
  </div>
</div>

<div class="step-panel" data-step-panel="done" data-hide-next>
  <div class="wrap panel-shell">
    <div class="sheet stagger done-shell">
      <div class="done-mark">&#10003;</div>
      <p class="eyebrow">Got it</p>
      <h2 class="step-h2">Thank you, that is everything we needed.</h2>
      <p class="step-blurb" style="margin-left:auto;margin-right:auto">We'll be in touch soon with your calendar link!</p>
      <div class="btn-row" id="booking-slot" style="display:none;justify-content:center;margin:1.2rem 0">
        <a class="btn solid" id="booking-link" href="#" rel="noopener" target="_blank" style="display:inline-flex;align-items:center;text-decoration:none">Pick a time for your discovery call</a>
      </div>
      <p class="step-blurb" style="margin-left:auto;margin-right:auto;font-size:0.88rem">Anything urgent in the meantime, write to <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>
    </div>
  </div>
</div>

<div class="step-footer">
  <div class="step-footer-inner">
    <button class="btn ghost" type="button" id="stepBack" data-step-prev>&larr; Back</button>
    <div class="step-dots" id="stepDots"></div>
    <button class="btn solid" type="button" id="stepNext" data-step-next>Continue</button>
  </div>
</div>`;

  const script = `
(function () {
  function val(name) {
    var el = document.querySelector('[name="' + name + '"]');
    return el ? el.value.trim() : '';
  }

  function pickedIds() {
    return [].slice.call(document.querySelectorAll('input[name="needs"]:checked')).map(function (el) {
      return el.value;
    });
  }

  function otherText() {
    var el = document.getElementById('needs-other-input');
    return el ? el.value.trim() : '';
  }

  /* "Something else" only counts once it actually says something.
     Ticking the box and leaving the line empty is not an answer, and
     the server applies the identical rule, since a browser-side check
     is a courtesy and never a rule. */
  function selectionCount() {
    var ids = pickedIds();
    var n = ids.filter(function (id) { return id !== 'other'; }).length;
    if (ids.indexOf('other') !== -1 && otherText()) n += 1;
    return n;
  }

  var otherPanel = document.getElementById('need-other');
  var otherBox = document.querySelector('input[name="needs"][value="other"]');
  document.addEventListener('change', function (e) {
    if (!e.target || e.target.name !== 'needs') return;
    var on = !!(otherBox && otherBox.checked);
    otherPanel.classList.toggle('show', on);
    if (on) {
      var input = document.getElementById('needs-other-input');
      if (input) input.focus();
    }
  });

  window.MORA_STEP_GUARD = function (stepId) {
    if (stepId === 'you') {
      var box = document.getElementById('err-you');
      var field = document.getElementById('f-name');
      var ok = !!val('name');
      if (field) field.classList.toggle('invalid', !ok);
      if (!ok) {
        box.textContent = 'Still needed: your name.';
        box.classList.add('show');
        return false;
      }
      box.classList.remove('show');
      return true;
    }
    if (stepId === 'need') {
      var needBox = document.getElementById('err-need');
      if (selectionCount() === 0) {
        needBox.textContent = otherBox && otherBox.checked
          ? 'Tell us what the something else is, then we can keep going.'
          : 'Pick at least one thing you need help with.';
        needBox.classList.add('show');
        return false;
      }
      needBox.classList.remove('show');
      return true;
    }
    return true;
  };

  // The same answers go to the intake function, which runs the qualification
  // gate, notifies Everly and returns the booking link only for a submission
  // that passed. The Netlify Forms copy above is already stored, so a failure
  // here is logged and the thank-you screen shows without the button.
  function submitToIntake() {
    return fetch('/start/inquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: val('name'),
        email: val('email'),
        needs: pickedIds(),
        needsOther: otherText()
      })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.ok && typeof data.bookingUrl === 'string' && data.bookingUrl.indexOf('https://') === 0) {
          document.getElementById('booking-link').setAttribute('href', data.bookingUrl);
          document.getElementById('booking-slot').style.display = 'flex';
        }
      })
      .catch(function (e) {
        console.error('[inquiry] The intake function did not answer: ' + e.message);
      });
  }

  var sendBtn = document.getElementById('send-btn');
  sendBtn.addEventListener('click', function () {
    var err = document.getElementById('err-send');
    var emailField = document.getElementById('f-email');
    err.classList.remove('show');

    var email = val('email');
    if (!email || email.indexOf('@') === -1) {
      emailField.classList.add('invalid');
      err.textContent = 'That email address does not look right.';
      err.classList.add('show');
      return;
    }
    emailField.classList.remove('invalid');

    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending...';

    // Real Netlify Forms submission: this form is attached to Netlify
    // Forms. A plain URL-encoded POST with
    // form-name matching the shadow form in public/inquiry-shadow.html,
    // per Netlify's own documented pattern for a JavaScript-rendered
    // form (docs.netlify.com/manage/forms/setup, "Submit JavaScript
    // rendered forms with AJAX"). Netlify stores the submission and
    // emails everly@admin.weareme.co, everly@admin.weareme.co, and
    // melody@weareme.co on every one, through real notification
    // hooks on the site, nothing custom to keep working.
    var body = new URLSearchParams();
    body.set('form-name', 'inquiry');
    body.set('name', val('name'));
    body.set('email', email);
    pickedIds().forEach(function (id) { body.append('needs', id); });
    body.set('needsOther', otherText());

    // Posts to the shadow form's own real path, not "/". "/" carries a
    // forced redirect to this very function (netlify.toml), and that
    // redirect wins the race against Netlify's form interception, so a
    // POST to "/" never reaches Netlify Forms at all, confirmed live:
    // it returned this function's own JSON error instead of the real
    // Netlify "thank you" page. inquiry-shadow.html has no competing
    // redirect, so Netlify's own form handling gets the request intact.
    fetch('/inquiry-shadow.html', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    })
      .then(function (res) {
        if (!res.ok) throw new Error('non-200');
        return submitToIntake();
      })
      .then(function () { window.MORA_STEP.goTo('done'); })
      .catch(function () {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send my inquiry';
        err.textContent = 'That did not send. Try again, or email ' + '${CONTACT_EMAIL}' + '.';
        err.classList.add('show');
      });
  });
})();`;

  return page('Start a project with Me&Co.', body, style, script);
}

/* ------------------------------------------------------------
   Lookups and POST actions
   ------------------------------------------------------------ */

/* A client may write from more than one address, which is why clients.js
   carries both `email` and an `emails` array. Any lookup by email has to
   check every address on the record, or a whole new project request from
   a client's second address sits unread. */
/* Reads the slug out of a magic token's payload without verifying it.
   Deliberately not a security check: the payload is base64, anyone can
   read it. It only decides which client's secret the portal should try
   the signature against, and the portal rejects anything that does not
   verify. */
function slugFromToken(token) {
  try {
    const payload = String(token).split('.')[0];
    const data = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    return data && typeof data.s === 'string' ? data.s : '';
  } catch (err) {
    return '';
  }
}

async function findClientByEmail(email) {
  const needle = String(email || '').trim().toLowerCase();
  if (!needle) return null;
  const all = await getAllClients();
  const slugs = Object.keys(all);
  for (let i = 0; i < slugs.length; i++) {
    const c = all[slugs[i]];
    const addresses = [].concat(c.emails || [], c.email ? [c.email] : []).map((e) => String(e).toLowerCase());
    if (addresses.indexOf(needle) !== -1) return Object.assign({ slug: slugs[i] }, c);
  }
  return null;
}

/* Identity sign in. The browser trades an email and password for an Identity
   access token directly with Netlify Identity, then hands that token here.
   Nothing the browser says is trusted: the token is sent back to Netlify
   Identity's own /user endpoint, which verifies the signature and expiry
   and returns the account. Only that verified email is matched to a client.
   The resulting session is the same signed cookie the passcode sign in
   already sets, so the portal itself is untouched.

   The Identity URL comes from the Netlify runtime (clientContext), or, when
   absent, from an allowlist of this site's own hosts. It is never taken
   from the request body. */
const IDENTITY_HOSTS = /^(clients\.morastudios\.co|mora-studios-portal\.netlify\.app|[a-z0-9-]+--mora-studios-portal\.netlify\.app|localhost(:\d+)?)$/i;

function identityBaseFor(event, context) {
  const ci = context && context.clientContext && context.clientContext.identity;
  if (ci && ci.url) return String(ci.url).replace(/\/+$/, '');
  const host = String((event.headers && (event.headers.host || event.headers.Host)) || '');
  if (!IDENTITY_HOSTS.test(host)) return null;
  const proto = /^localhost/i.test(host) ? 'http' : 'https';
  return proto + '://' + host + '/.netlify/identity';
}

function sameOrigin(event) {
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
  const host = (event.headers && (event.headers.host || event.headers.Host)) || '';
  if (!origin) return false;
  try { return new URL(origin).host === host; } catch (err) { return false; }
}

async function handleIdentitySession(event, context, body) {
  const fail = json(401, { ok: false, error: 'We could not open a portal for that account. Check your email and password, or email ' + CONTACT_EMAIL + '.' });
  if (!sameOrigin(event)) return json(403, { ok: false, error: 'Request not allowed.' });
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!token || token.length > 4096) return fail;
  const base = identityBaseFor(event, context);
  if (!base) return fail;

  let user = null;
  try {
    const res = await fetch(base + '/user', { headers: { Authorization: 'Bearer ' + token } });
    if (!res.ok) return fail;
    user = await res.json();
  } catch (err) {
    console.error('[intake] Identity verify failed: ' + err.message);
    return fail;
  }
  const email = user && typeof user.email === 'string' ? user.email.trim() : '';
  if (!email || !user.confirmed_at) return fail;

  const client = await findClientByEmail(email);
  if (!client) return fail;
  const auth = await passcodes.resolveAuth(client);
  const secret = auth ? auth.secret : '';
  if (!secret) {
    console.error('[intake] Missing ' + client.envKey + ' for slug "' + client.slug + '".');
    return fail;
  }
  const secure = session.isSecureRequest(event);
  const cookie = session.buildCookie(session.cookieName(client.slug), session.makeSessionToken(client.slug, secret), secure);
  return json(200, { ok: true, redirect: '/portal/' + encodeURIComponent(client.slug) }, { 'Set-Cookie': cookie });
}

/* Forgot passcode: the same neutral reply whether or not the email is on
   file, padded so the response time does not hint either way. */
async function handleForgotRequest(body) {
  const email = String(body.email || '').trim();
  const work = (async () => {
    const client = await findClientByEmail(email);
    if (client) await handleForgot(client, email);
  })();
  await Promise.all([work, new Promise((r) => setTimeout(r, 1500))]);
  return json(200, { ok: true });
}

/* The client a reset link belongs to, with its current passcode secret,
   or null when the link is unreadable, expired, or already used. */
async function resolveResetLink(token) {
  const slug = slugFromToken(token);
  if (!slug) return null;
  const all = await getAllClients();
  if (!all[slug]) return null;
  const client = Object.assign({ slug }, all[slug]);
  const auth = await passcodes.resolveAuth(client);
  if (!auth || !session.verifyResetToken(token, slug, auth.secret)) return null;
  return client;
}

/* Set a new passcode: saves it hashed, which also ends the reset link and
   every older session, then signs this device in with the new one. */
async function handleResetPasscode(event, body) {
  const token = String(body.token || '');
  const passcode = typeof body.passcode === 'string' ? body.passcode : '';
  const client = await resolveResetLink(token);
  if (!client) return json(400, { ok: false, error: 'This link has expired or was already used. Go to Forgot passcode for a new one.' });
  if (passcode.length < resetPages.MIN_LENGTH) return json(400, { ok: false, error: 'Your new passcode needs at least ' + resetPages.MIN_LENGTH + ' characters.' });
  if (passcode.length > 200) return json(400, { ok: false, error: 'That passcode is too long. Keep it under 200 characters.' });
  const record = await passcodes.setPasscode(client.slug, passcode);
  const secret = passcodes.secretFromRecord(record);
  const secure = session.isSecureRequest(event);
  const cookie = session.buildCookie(session.cookieName(client.slug), session.makeSessionToken(client.slug, secret), secure);
  return json(200, { ok: true, redirect: '/portal/' + encodeURIComponent(client.slug) }, { 'Set-Cookie': cookie });
}

/* Sign out: clears every portal session cookie this browser holds, then
   shows the signed out page. */
function handleSignOut(event) {
  const raw = (event.headers && (event.headers.cookie || event.headers.Cookie)) || '';
  const secure = session.isSecureRequest(event);
  const cookies = raw.split(';').map((p) => p.split('=')[0].trim()).filter((n) => n.indexOf(session.COOKIE_PREFIX) === 0);
  // A page rather than a 302: the platform appends the request's query to a
  // relative Location, which would carry view=signout onto /login.
  return {
    statusCode: 200,
    headers: Object.assign({ 'Content-Type': 'text/html; charset=utf-8' }, NO_STORE),
    multiValueHeaders: { 'Set-Cookie': cookies.map((n) => session.clearCookie(n, secure)) },
    body: resetPages.renderSignedOutPage(),
  };
}

async function handlePasscodeLogin(event, body) {
  const email = String(body.email || '').trim();
  const attempt = typeof body.passcode === 'string' ? body.passcode : '';
  await new Promise((r) => setTimeout(r, 350));

  const fail = json(401, { ok: false, error: 'That email and passcode did not match. Check both, or email ' + CONTACT_EMAIL + '.' });

  // Melody signs in here too, with her admin passcode, and lands in admin.
  if (adminAuth.isAdminEmail(email)) {
    const adminSecret = adminAuth.signingSecret();
    if (!adminSecret || !adminAuth.checkPassword(attempt)) return fail;
    const adminCookie = adminAuth.buildCookie(adminAuth.makeToken(adminSecret), session.isSecureRequest(event));
    return json(200, { ok: true, redirect: '/admin' }, { 'Set-Cookie': adminCookie });
  }

  const client = await findClientByEmail(email);
  if (!client) return fail;

  const auth = await passcodes.resolveAuth(client);
  const secret = auth ? auth.secret : '';
  if (!secret) {
    console.error('[intake] Missing ' + client.envKey + ' for slug "' + client.slug + '".');
    return fail;
  }
  if (!passcodes.checkPasscode(auth, attempt, session.safeEqual)) return fail;

  const secure = session.isSecureRequest(event);
  const cookie = session.buildCookie(session.cookieName(client.slug), session.makeSessionToken(client.slug, secret), secure);
  return json(200, { ok: true, redirect: '/portal/' + encodeURIComponent(client.slug) }, { 'Set-Cookie': cookie });
}

async function handleInquiry(body) {
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim();

  /* Ids come back from the browser, labels are resolved here, so the only
     strings that ever reach a stored record or an email body are the ones
     written in NEEDS above. A stranger cannot post their own label text. */
  const posted = Array.isArray(body.needs) ? body.needs.map((v) => String(v)) : [];
  const wantsOther = posted.indexOf('other') !== -1;
  const other = wantsOther ? cleanOneLine(body.needsOther, NEED_OTHER_MAX) : '';
  const selections = NEEDS.filter((n) => !n.other && posted.indexOf(n.id) !== -1).map((n) => n.label);
  if (other) selections.push('Something else: ' + other);

  // The same three the browser enforces, checked again here, because a
  // client-side guard is a courtesy and never a rule.
  if (!name || !email) {
    return json(400, { ok: false, error: 'Your name and email are both required.' });
  }
  if (email.indexOf('@') === -1) {
    return json(400, { ok: false, error: 'That email address does not look right.' });
  }
  if (!selections.length) {
    return json(400, {
      ok: false,
      error: wantsOther
        ? 'Tell us what the something else is, then we can keep going.'
        : 'Pick at least one thing you need help with.',
    });
  }

  const gate = qualifyInquiry({ name, email, selections, other });
  const draft = {
    name,
    email,
    needs: selections,
    needsOther: other,
    qualified: gate.passed,
    qualificationReasons: gate.reasons,
  };

  /* The send is attempted before the record is written and before Everly
     is notified, so both of them state what actually happened rather than
     what was supposed to happen. A refused send is a normal outcome here,
     not an exception: it lands in the same place a failed gate does. */
  const delivery = gate.passed
    ? await sendBookingLink(draft)
    : { sent: false, reason: 'held for review: ' + gate.reasons.join('; ') };

  const record = await saveIntakeRecord(
    Object.assign({ type: 'inquiry', org: '' }, draft, {
      // The joined version, so /admin/inquiries and anything else already
      // reading `need` keeps reading a sentence rather than an array.
      need: selections.join('; '),
      bookingLinkSent: !!delivery.sent,
      bookingLinkNote: delivery.sent ? '' : String(delivery.reason || ''),
      // One nudge, held in Resend for two days, when client emails are on.
      nudgeId: delivery.sent ? await inquiryMail.scheduleNudge(draft, Date.now()).catch(() => null) : null,
      stage: !gate.passed ? 'needs_review' : delivery.sent ? 'booking_link_sent' : 'booking_link_blocked',
    })
  );

  console.log(
    '[intake] New inquiry ' + record.id + ' from ' + name + ' (' + email + '), ' +
      (gate.passed
        ? delivery.sent
          ? 'qualified, booking link sent.'
          : 'qualified, but the booking link was refused and has to go by hand.'
        : 'held for review: ' + gate.reasons.join('; '))
  );
  await notifyEverlyOfInquiry(record, delivery);

  /* The booking link is in this response only when the gate passed, and
     the confirmation screen shows its button only from this field. A
     submission the gate refused gets the same ok and id with no link, so
     a refused submission never receives a real calendar slot. */
  const reply = { ok: true, id: record.id };
  if (gate.passed && bookingUrl()) reply.bookingUrl = bookingUrl();
  return json(200, reply);
}

/* ------------------------------------------------------------ */

/* An anonymous stage 2 draft, kept because the brief form can still be
   rendered outside a portal for Melody's own review. Inside a portal
   the answers go to the client record instead, see brief-form.js. */
async function handleStagedBrief(body) {
  const record = await stage('discovery-briefs', body.slug || body.variant || 'anonymous', body);
  return json(200, { ok: true, staged: record && record.key ? record.key : true });
}

exports.handler = async function (event, context) {
  require('../portal/store').connectBlobs(event);
  // Netlify's own storage access for this request, used by passcodes and resets.
  require('../portal/requests-store').connectBlobs(event);
  const path = String(event.path || '/start').replace(/\/+$/, '') || '/start';
  const method = (event.httpMethod || 'GET').toUpperCase();
  const view = (event.queryStringParameters && event.queryStringParameters.view) || '';
  const isInquiry = /\/start\/inquiry$/.test(path) || !!(event.queryStringParameters && event.queryStringParameters.inquiry);
  const isLogin = /\/login$/.test(path) || view === 'login';

  if (method === 'POST') {
    const body = parseBody(event);
    try {
      if (isInquiry) return await handleInquiry(body);
      if (view === 'submit') return await handleStagedBrief(body);
      if (view === 'identity-session') return await handleIdentitySession(event, context, body);
      if (body.action === 'passcode-login') return await handlePasscodeLogin(event, body);
      if (body.action === 'forgot-request') return await handleForgotRequest(body);
      if (body.action === 'reset-passcode') return await handleResetPasscode(event, body);
      return json(400, { ok: false, error: 'Unknown action' });
    } catch (err) {
      console.error('[intake] ' + err.message);
      return json(500, { ok: false, error: 'Something went wrong on our side. Email ' + CONTACT_EMAIL + ' and it gets handled.' });
    }
  }

  if (method !== 'GET' && method !== 'HEAD') {
    return json(405, { ok: false, error: 'Method not allowed' });
  }

  /* /magic/<token>: the shape of the link Melody sends. The slug lives
     inside the signed payload, so the URL carries one opaque string
     rather than a guessable slug plus a token. It is handed straight to
     the portal, which is the only thing that verifies it. */
  const magicMatch = path.match(/^\/magic\/(.+)$/);
  const magicParam = view === 'magic' ? (event.queryStringParameters && event.queryStringParameters.t) || '' : '';
  if (magicMatch || magicParam) {
    const token = decodeURIComponent(magicMatch ? magicMatch[1] : magicParam);
    const slug = slugFromToken(token);
    if (!slug) return html(200, renderLoginPage({ notice: 'That sign in link is not readable. Ask Melody for a fresh one.' }));
    return {
      statusCode: 302,
      headers: Object.assign({ Location: '/portal/' + encodeURIComponent(slug) + '?k=' + encodeURIComponent(token) }, NO_STORE),
      body: '',
    };
  }

  if (view === 'signout' || /\/signout$/.test(path)) return handleSignOut(event);

  if (view === 'forgot' || /\/forgot$/.test(path)) return html(200, resetPages.renderForgotPage());
  // The link arrives as /reset/<token>; the address itself carries the token.
  const resetMatch = path.match(/^\/reset\/([^/]+)$/);
  if (view === 'reset' || resetMatch) {
    const token = resetMatch ? decodeURIComponent(resetMatch[1]) : (event.queryStringParameters && event.queryStringParameters.k) || '';
    const client = token ? await resolveResetLink(token) : null;
    return html(200, client ? resetPages.renderResetPage(token) : resetPages.renderExpiredPage());
  }

  if (view === 'review' || /\/review$/.test(path)) return html(200, renderReviewPage());
  if (isInquiry) return html(200, renderInquiry());
  if (isLogin) return html(200, renderLoginPage({ notice: '' }));
  return html(200, renderEntryPage());
};

module.exports.bookingUrl = bookingUrl;
module.exports.NEEDS = NEEDS;
module.exports.NEED_IDS = NEED_IDS;
/* Exported so the gate and the exact wording of the confirmation can be
   tested directly, with dry_run, without a browser and without sending
   anything. See scripts/verify-inquiry-gate.js. */
module.exports.qualifyInquiry = qualifyInquiry;
module.exports.composeRequestEmail = composeRequestEmail;
module.exports.sendBookingLink = sendBookingLink;
