/* The mail around an inquiry, sent straight to the Resend API by code.
   Resend holds a scheduled message until its send time and takes it back
   when asked, so nothing polls. */
const crypto = require('crypto');
const { composeRequestEmail, composeNudge, checkEmail } = require('./request-email.js');

const DEFAULT_FROM = 'Me&Co. <everly@admin.weareme.co>';
const MELODY = 'melody@weareme.co';
const H = 3600 * 1000;

const resendKey = () => process.env.RESEND_API_KEY || process.env.RESEND_KEY;
const fromAddress = () => process.env.PORTAL_MAIL_FROM || DEFAULT_FROM;

/* Melody's booking link, from BOOKING_URL. Empty when unset or not https. */
function bookingUrl() {
  const v = String(process.env.BOOKING_URL || '').trim();
  return /^https:\/\/[^\s]+$/.test(v) ? v : '';
}

/* The nudge and any other message after the first stays off until
   CALLS_CLIENT_EMAILS is "on". */
function clientEmailsOn() {
  return String(process.env.CALLS_CLIENT_EMAILS || '').toLowerCase() === 'on';
}

/* One message to Resend. `at` holds it for that time. The idempotency key
   makes a repeat of the same fact a no-op on Resend's side. */
async function sendEmail({ to, cc, subject, html, text, idem, at }) {
  const key = resendKey();
  if (!key) return { sent: false, why: 'no Resend key' };
  if (html) {
    const bad = checkEmail({ subject, html, text });
    if (bad.length) return { sent: false, why: 'send check: ' + bad.join(', ') };
  }
  const body = Object.assign(
    { from: fromAddress(), to: [].concat(to), subject, text },
    html ? { html } : {},
    cc ? { cc: [].concat(cc) } : {},
    at ? { scheduled_at: new Date(at).toISOString() } : {}
  );
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', 'Idempotency-Key': idem },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let why = 'Resend ' + res.status;
    try { why += ': ' + String((await res.json()).message || '').slice(0, 200); } catch (e) { /* unreadable reply */ }
    return { sent: false, why };
  }
  const j = await res.json().catch(() => ({}));
  return { sent: true, id: j.id || null };
}

/* Takes back an email Resend is still holding for later. */
async function cancelEmail(id) {
  const key = resendKey();
  if (!key || !id) return false;
  const res = await fetch('https://api.resend.com/emails/' + encodeURIComponent(id) + '/cancel', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key },
  }).catch(() => null);
  return !!(res && res.ok);
}

const hash = (parts) => crypto.createHash('sha256').update(parts.join('#')).digest('hex').slice(0, 32);
const minuteOf = (ms) => new Date(ms).toISOString().slice(0, 16);

/* The "We got your request" email. The idempotency key is built from the
   email, the needs and the minute, so a double submit or a retry cannot
   send twice. */
async function sendBookingLink(record, options) {
  const opts = options || {};
  const message = composeRequestEmail(record, bookingUrl());
  const problems = checkEmail(message);
  if (problems.length) return { sent: false, reason: 'send check: ' + problems.join(', '), message };
  if (opts.dryRun) return { sent: false, dryRun: true, message };
  if (!resendKey()) {
    console.error('[intake] Neither RESEND_API_KEY nor RESEND_KEY is set, so no confirmation went to ' + record.email + '.');
    return { sent: false, reason: 'no Resend key on this site', message };
  }
  const idem = 'inquiry-received/' + hash([record.email, (record.needs || []).join('|'), minuteOf(Date.now())]);
  try {
    const r = await sendEmail({ to: record.email, cc: MELODY, subject: message.subject, html: message.html, text: message.text, idem });
    if (!r.sent) {
      console.error('[intake] ' + record.email + ' passed the gate but the confirmation was not sent: ' + r.why);
      return { sent: false, reason: r.why, message };
    }
    return { sent: true, resendId: r.id, message };
  } catch (e) {
    console.error('[intake] ' + record.email + ' passed the gate but the email failed: ' + e.message);
    return { sent: false, reason: e.message, message };
  }
}

/* The one nudge a qualified lead gets if they have not booked in two days,
   held in Resend. Returns the Resend id so it can be cancelled, or null
   when client emails are off or no booking link is set. */
async function scheduleNudge(lead, now) {
  const url = bookingUrl();
  if (!clientEmailsOn() || !url) return null;
  const m = composeNudge(lead, url);
  const r = await sendEmail({
    to: lead.email, cc: MELODY, subject: m.subject, html: m.html, text: m.text,
    idem: 'lead-nudge/' + hash([String(lead.email).toLowerCase(), minuteOf(now)]), at: now + 48 * H,
  });
  return r.sent ? r.id : null;
}

module.exports = { bookingUrl, clientEmailsOn, sendEmail, cancelEmail, sendBookingLink, scheduleNudge };
