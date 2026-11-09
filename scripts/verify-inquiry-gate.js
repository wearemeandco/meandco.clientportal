/* ============================================================
   Me&Co.: stage 1 inquiry regression harness
   ------------------------------------------------------------
   The inquiry is the first thing a stranger ever sends this
   studio, and the one decision in it that matters is whether a
   real Cal.com link goes out. So both halves of that decision get
   a test that runs the REAL handler, the REAL qualification gate,
   and the REAL send guards in AI Lab's lib/resend.js.

   Nothing is sent. fetch is replaced in this process, so every call
   the code makes to Resend is captured and answered with a fake id.

   Run:  node scripts/verify-inquiry-gate.js
   Exit: 0 if every check passes, 1 otherwise, loudly.
   ============================================================ */

process.env.MORA_PORTAL_LOCAL_DATA = '1';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
process.env.BOOKING_URL = 'https://cal.example.com/melody/intro';
process.env.RESEND_API_KEY = 'verify-not-a-real-key';
process.env.CALLS_CLIENT_EMAILS = 'on';

const sends = [];
global.fetch = async (url, init) => {
  const body = init && init.body ? JSON.parse(init.body) : {};
  sends.push({ url: String(url), headers: init.headers, body });
  return { ok: true, status: 200, json: async () => ({ id: 'fake_' + sends.length }) };
};

const intake = require('../netlify/functions/intake/intake.js');
const { NEEDS, qualifyInquiry, composeRequestEmail, bookingUrl } = intake;

let passed = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) {
    passed += 1;
    console.log('  PASS  ' + name);
  } else {
    failures.push(name + (detail ? ' :: ' + detail : ''));
    console.log('  FAIL  ' + name + (detail ? ' :: ' + detail : ''));
  }
}

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function ev(over) {
  return Object.assign({ httpMethod: 'GET', path: '/start', queryStringParameters: {}, headers: {}, body: '' }, over || {});
}

async function post(body) {
  const res = await intake.handler(ev({ httpMethod: 'POST', path: '/start/inquiry', body: JSON.stringify(body) }));
  return { status: res.statusCode, data: JSON.parse(res.body) };
}

const created = [];

function recordFor(id) {
  const file = path.join(ROOT, 'data', 'intake', id + '.json');
  created.push(file);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

async function main() {
  console.log('\n[1] The page itself');

  const page = await intake.handler(ev({ path: '/start/inquiry' }));
  const html = page.body;
  const preview = path.join(ROOT, 'data', 'staging', 'inquiry-preview.html');
  fs.mkdirSync(path.dirname(preview), { recursive: true });
  fs.writeFileSync(preview, html);
  console.log('  rendered to ' + preview);

  NEEDS.forEach((n) => {
    check('the checklist carries Melody\'s exact wording: "' + n.label + '"', html.indexOf(escapeHtml(n.label)) !== -1);
  });
  const boxes = (html.match(/type="checkbox" name="needs"/g) || []).length;
  check('every option is a real multi-select checkbox', boxes === NEEDS.length, boxes + ' of ' + NEEDS.length);
  check('the checklist animates in on the step-shell riseIn keyframe', /\.need \{[^}]*animation: riseIn/.test(html));
  check('each option is staggered, not one block', /\.need:nth-child\(1\) \{ animation-delay: 0\.26s; \}/.test(html) &&
    /\.need:nth-child\(6\) \{ animation-delay: 0\.56s; \}/.test(html));
  check('the stagger is switched off under prefers-reduced-motion',
    /prefers-reduced-motion: reduce\) \{ \.need, \.need-other\.show \{ animation: none; \} \}/.test(html));
  check('the free text answer is hidden until "Something else" is picked',
    /\.need-other \{ display: none;/.test(html) && html.indexOf('id="need-other"') !== -1);
  check('the reveal uses the same riseIn entrance as the options', /\.need-other\.show \{ display: block; animation: riseIn/.test(html));
  check('the confirmation says a link is coming', html.indexOf("We'll be in touch soon with your calendar link!") !== -1);
  check('the booking link is NOWHERE on the page', html.indexOf(bookingUrl()) === -1);
  check('the fields are in the settled order: name, checklist, email',
    html.indexOf('name="name"') < html.indexOf('name="needs"') &&
      html.indexOf('name="needs"') < html.indexOf('name="email"'));

  console.log('\n[2] The deterministic gate, in isolation');

  const good = qualifyInquiry({ name: 'Sam Whitfield', email: 'sam@example.org', selections: ['Branding (I need a brand, not just a website)'] });
  check('a real name, a real email and one pick passes', good.passed === true, good.reasons.join('; '));

  const cases = [
    ['no name', { name: '', email: 'sam@example.org', selections: ['x'] }],
    ['a gibberish name', { name: 'asdfgh jkl', email: 'sam@example.org', selections: ['x'] }],
    ['a repeated-character name', { name: 'zzzzz', email: 'sam@example.org', selections: ['x'] }],
    ['a malformed email that still has an @', { name: 'Sam Whitfield', email: '@nowhere', selections: ['x'] }],
    ['nothing selected', { name: 'Sam Whitfield', email: 'sam@example.org', selections: [] }],
    ['a gibberish free text answer', { name: 'Sam Whitfield', email: 'sam@example.org', selections: ['Something else: asdfasdf'], other: 'asdfasdf' }],
  ];
  cases.forEach((c) => {
    const out = qualifyInquiry(c[1]);
    check(c[0] + ' is refused', out.passed === false, JSON.stringify(out));
  });

  const named = qualifyInquiry({ name: '\u30ab\u30ec\u30f3', email: 'karen@example.jp', selections: ['x'] });
  check('a name in a non-latin script is still a real name', named.passed === true, named.reasons.join('; '));

  console.log('\n[3] The real POST, the passing path');

  const passBody = {
    name: 'Sam Whitfield',
    email: 'sam@example.org',
    needs: ['business', 'unfinished', 'other'],
    needsOther: 'Our booking system and our site disagree about opening hours',
  };
  const passRes = await post(passBody);
  check('a good submission is accepted', passRes.status === 200 && passRes.data.ok === true, JSON.stringify(passRes));
  check('the response carries the booking link for a passing submission', passRes.data.bookingUrl === bookingUrl(), JSON.stringify(passRes.data));

  const passRecord = recordFor(passRes.data.id);
  check('the record is marked qualified', passRecord.qualified === true, JSON.stringify(passRecord.qualificationReasons));
  check('the fixed picks are stored as their real labels',
    passRecord.needs.indexOf(NEEDS[0].label) !== -1 && passRecord.needs.indexOf(NEEDS[3].label) !== -1,
    JSON.stringify(passRecord.needs));
  check('the free text answer is stored alongside them',
    passRecord.needs.some((n) => n.indexOf('Something else: Our booking system') === 0), JSON.stringify(passRecord.needs));

  check('the record says whether the link actually reached them',
    typeof passRecord.bookingLinkSent === 'boolean', JSON.stringify(passRecord.bookingLinkSent));
  check('the stage matches what really happened',
    passRecord.stage === (passRecord.bookingLinkSent ? 'booking_link_sent' : 'booking_link_blocked'), passRecord.stage);
  check('a blocked send says why, on the record itself',
    passRecord.bookingLinkSent === true || !!passRecord.bookingLinkNote, JSON.stringify(passRecord.bookingLinkNote));

  const message = composeRequestEmail(passRecord, bookingUrl());
  console.log('\n  ---- the confirmation that would go to a qualified prospect ----');
  console.log('  Subject: ' + message.subject);
  console.log(message.text.split('\n').map((l) => '  | ' + l).join('\n'));
  console.log('  ----------------------------------------------------------------\n');

  check('the confirmation carries the real booking link', message.text.indexOf(bookingUrl()) !== -1);
  check('the confirmation reads their fixed picks back to them',
    message.text.indexOf('A website for your business') !== -1 && message.text.indexOf('Finishing a project already started') !== -1);
  check('the confirmation reads their free text answer back too',
    message.text.indexOf('Our booking system and our site disagree about opening hours') !== -1);
  check('the confirmation claims no spoken conversation',
    !/(great|good|nice)\s+(talking|speaking|chatting)|\b(our|the)\s+(call|chat|conversation|meeting)\b|\bwe\s+(spoke|talked|met)\b/i.test(message.text),
    message.text);
  check('the confirmation states no dollar figure', !/\$\s?\d/.test(message.text));
  check('the confirmation leaks no raw internal id',
    !/\b(decision|need|queue|job|task)s?\s+id\s*[:#]?\s*\d+/i.test(message.text));

  console.log('\n[4] The real POST, the failing paths');

  const noName = await post({ name: '', email: 'sam@example.org', needs: ['branding'] });
  check('a missing name is refused outright, nothing stored', noName.status === 400, JSON.stringify(noName));

  const noPick = await post({ name: 'Sam Whitfield', email: 'sam@example.org', needs: [] });
  check('an empty checklist is refused outright', noPick.status === 400, JSON.stringify(noPick));

  const emptyOther = await post({ name: 'Sam Whitfield', email: 'sam@example.org', needs: ['other'], needsOther: '   ' });
  check('"Something else" ticked with nothing written is refused outright', emptyOther.status === 400, JSON.stringify(emptyOther));

  const badEmail = await post({ name: 'Sam Whitfield', email: 'nope', needs: ['branding'] });
  check('an email with no @ is refused outright', badEmail.status === 400, JSON.stringify(badEmail));

  const heldBody = { name: 'zzzzz', email: '@nowhere', needs: ['branding'] };
  const held = await post(heldBody);
  check('a spam-shaped submission still returns the same confirmation', held.status === 200 && held.data.ok === true, JSON.stringify(held));
  const heldRecord = recordFor(held.data.id);
  check('the held response does NOT carry the booking link', JSON.stringify(held.data).indexOf('cal.com') === -1, JSON.stringify(held.data));
  check('the spam-shaped record is flagged, not qualified', heldRecord.qualified === false);
  check('the record says why it was held', heldRecord.qualificationReasons.length >= 2, JSON.stringify(heldRecord.qualificationReasons));
  check('the record is staged for review', heldRecord.stage === 'needs_review', heldRecord.stage);

  console.log('\n[5] What actually reached the send path');

  const mails = sends.filter((x) => /\/emails$/.test(x.url));
  const notices = mails.filter((x) => x.body.to.indexOf('everly@admin.weareme.co') !== -1);
  const confirmations = mails.filter((x) => x.body.to.indexOf('sam@example.org') !== -1 && !x.body.scheduled_at);
  const nudges = mails.filter((x) => x.body.scheduled_at);

  check('Everly is notified of the qualified submission', notices.some((s) => /Sam Whitfield/.test(s.body.subject)));
  check('Everly is notified of the held submission too', notices.length === 2, notices.length + ' notifications');
  check('exactly one confirmation went out, for the qualified one only', confirmations.length === 1, JSON.stringify(confirmations.map((c) => c.body.to)));
  const conf = confirmations[0];
  check('the confirmation carries both bodies and the booking button', !!conf.body.html && !!conf.body.text && conf.body.html.indexOf('href="' + bookingUrl() + '"') !== -1);
  check('the confirmation is copied to Melody', conf.body.cc.indexOf('melody@weareme.co') !== -1);
  check('the confirmation has an idempotency key built from the inquiry', /^inquiry-received\/[0-9a-f]{32}$/.test(conf.headers['Idempotency-Key']), conf.headers['Idempotency-Key']);
  check('the confirmation lists the free-text need in their words', conf.body.html.indexOf('Our booking system and our site disagree about opening hours') !== -1);
  check('the confirmation has a dark mode block', /prefers-color-scheme: dark/.test(conf.body.html));
  check('exactly one nudge is held in Resend', nudges.length === 1 && nudges[0].body.to.indexOf('sam@example.org') !== -1);
  const hoursOut = (Date.parse(nudges[0].body.scheduled_at) - Date.now()) / 3600000;
  check('the nudge is held about 48 hours', hoursOut > 47.9 && hoursOut < 48.1, String(hoursOut));
  check('the record keeps the nudge id', passRecord.nudgeId === 'fake_' + (sends.indexOf(nudges[0]) + 1), String(passRecord.nudgeId));
  check('what Everly is told matches what actually happened',
    passRecord.bookingLinkSent
      ? /has been emailed to them/.test(notices.find((s) => /Sam Whitfield/.test(s.body.subject)).body.text)
      : true);

  console.log('\n[6] No booking link set, client emails off');
  delete process.env.BOOKING_URL;
  process.env.CALLS_CLIENT_EMAILS = 'off';
  const before = sends.length;
  const noLink = await post({ name: 'Ada Lovelace', email: 'ada@example.org', needs: ['branding'] });
  check('the submission is accepted', noLink.status === 200 && noLink.data.ok === true);
  check('no booking link is returned', noLink.data.bookingUrl === undefined, JSON.stringify(noLink.data));
  recordFor(noLink.data.id);
  const adaMail = sends.slice(before).find((x) => x.body.to.indexOf('ada@example.org') !== -1);
  check('the confirmation says Melody will reach out', /reach out to set a time/.test(adaMail.body.text));
  check('the confirmation has no button and no calendar link', adaMail.body.html.indexOf('Book a time') === -1 && !/https?:\/\/(?!fonts\.googleapis\.com)/.test(adaMail.body.html));
  check('no nudge is scheduled', sends.slice(before).every((x) => !x.body.scheduled_at));
  const bad = composeRequestEmail({ name: 'Sam', email: 'sam@example.org', needs: [] }, '');
  check('the send check passes the real email', require('../netlify/functions/intake/request-email.js').checkEmail(bad).length === 0);

  created.forEach((f) => {
    try {
      fs.unlinkSync(f);
    } catch (err) {
      /* already gone */
    }
  });
  console.log('\n  cleaned up ' + created.length + ' test records from data/intake');

  console.log('\n' + passed + ' passed, ' + failures.length + ' failed');
  if (failures.length) {
    failures.forEach((f) => console.log('  ! ' + f));
    process.exit(1);
  }
  console.log('The stage 1 inquiry gate is intact.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
