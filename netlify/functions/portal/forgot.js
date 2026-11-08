/* ============================================================
   Me&Co. : "Forgot passcode?" sign in link
   ------------------------------------------------------------
   The client types their email on the lock screen. If it is on file
   for that client, a one hour sign in link is emailed. The reply is
   the same neutral sentence whether or not the email matched, and at
   most 3 requests per client per hour are honored.
   ============================================================ */

const { makeResetToken } = require('./session');
const passcodes = require('./passcodes');

const NEUTRAL_REPLY = 'If that email is on file, a link to set a new passcode is on its way.';
const DEFAULT_FROM = 'Me&Co. <everly@admin.weareme.co>';
const DEFAULT_ORIGIN = 'https://portal.weareme.co';

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function addressesOnFile(client) {
  return [].concat(client.emails || [], client.email ? [client.email] : [])
    .map((e) => String(e).trim().toLowerCase())
    .filter(Boolean);
}

/* ---- Email (Me&Co. shell: navy masthead, cream ground, rounded cards) ---- */

const FONT = "font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";

function buildEmail(client, link) {
  const name = esc(client.name || 'your portal');
  const body =
    '<p style="margin:0 0 18px;' + FONT + 'font-size:15px;line-height:1.6;color:#1a1a1a;">Tap the button to choose a new passcode for your Me&Co. portal for ' + name + '.</p>' +
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 18px;"><tr><td style="background:#FAF8F2;border:1px solid #E4E0D0;border-radius:12px;padding:14px 18px;' + FONT + 'color:#22315E;font-size:15px;line-height:1.6;">The link works once, for one hour. After that, use Forgot passcode on the sign-in page to ask for a new one.</td></tr></table>' +
    '<p style="margin:0 0 18px;' + FONT + 'font-size:15px;line-height:1.6;color:#1a1a1a;">If you did not ask for this, you can ignore this email. Your passcode stays the same until you choose a new one.</p>';
  const url = esc(link);
  const html =
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
    '<body style="margin:0;padding:0;background:#FAF8F2;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF8F2;padding:28px 12px;"><tr><td align="center">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:14px;overflow:hidden;">' +
    '<tr><td style="background:#22315E;padding:24px 34px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr>' +
    '<td style="padding-right:9px;"><div style="width:11px;height:11px;background:#F3C7B8;border-radius:50%;font-size:0;line-height:0;">&nbsp;</div></td>' +
    '<td style="' + FONT + 'font-size:17px;font-weight:700;color:#FAF8F2;letter-spacing:-0.2px;">Me&Co.</td></tr></table></td></tr>' +
    '<tr><td style="padding:32px 34px 4px;"><div style="' + FONT + 'font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#22315E;">Your portal</div>' +
    '<h1 style="margin:12px 0 0;' + FONT + 'font-size:24px;line-height:1.28;color:#22315E;font-weight:700;">Set a new passcode</h1></td></tr>' +
    '<tr><td style="padding:18px 34px 0;' + FONT + '">' + body + '</td></tr>' +
    '<tr><td align="center" style="padding:12px 34px 4px;"><a href="' + url + '" style="display:inline-block;background:#2A4FBF;color:#FFFFFF;' + FONT + 'font-size:14px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;text-decoration:none;padding:15px 38px;border-radius:12px;">Set a new passcode</a></td></tr>' +
    '<tr><td align="center" style="padding:0 34px 8px;' + FONT + 'font-size:12px;color:#8a8578;">or paste this in: <a href="' + url + '" style="color:#22315E;word-break:break-all;">' + url + '</a></td></tr>' +
    '<tr><td style="padding:16px 34px 30px;"><div style="border-top:1px solid #E4E0D0;padding-top:16px;' + FONT + 'font-size:11.5px;color:#8a8578;">Me&Co. &middot; hello@weareme.co</div></td></tr>' +
    '</table></td></tr></table></body></html>';
  const text =
    'Choose a new passcode for your Me&Co. portal for ' + (client.name || 'your portal') + ' here:\n\n' +
    link + '\n\n' +
    'The link works once, for one hour. After that, use Forgot passcode on the sign-in page to ask for a new one.\n\n' +
    'If you did not ask for this, you can ignore this email. Your passcode stays the same until you choose a new one.\n\n' +
    'Me&Co.\nhello@weareme.co\n';
  return { subject: 'Set a new passcode for your Me&Co. portal', html, text };
}

/* Sends through the Resend HTTP API. Never logs the key, the link or the address. */
async function sendViaResend(to, mail) {
  const key = process.env.RESEND_API_KEY || process.env.RESEND_KEY;
  if (!key) {
    console.error('[forgot] Neither RESEND_API_KEY nor RESEND_KEY is set in this site\'s environment, so no sign-in link was sent.');
    return { ok: false, status: 'no-key' };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.PORTAL_MAIL_FROM || DEFAULT_FROM,
        to: [to],
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      }),
    });
    if (!res.ok) {
      let reason = '';
      try { reason = String((await res.json()).message || '').slice(0, 200); } catch (e) { reason = 'unreadable reply'; }
      console.error('[forgot] Resend refused the send, status ' + res.status + ': ' + reason);
      return { ok: false, status: res.status, reason };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    console.error('[forgot] Resend request failed: ' + err.message);
    return { ok: false, status: 'network', reason: err.message };
  }
}

/* The whole flow. Always resolves to the neutral reply. */
async function handleForgot(client, typedEmail) {
  try {
    const needle = String(typedEmail || '').trim().toLowerCase();
    const allowed = await passcodes.takeForgotSlot(client.slug);
    if (!allowed || !needle || needle.length > 254) return NEUTRAL_REPLY;
    if (addressesOnFile(client).indexOf(needle) === -1) return NEUTRAL_REPLY;

    const auth = await passcodes.resolveAuth(client);
    if (!auth) {
      console.error('[forgot] No passcode is set for slug "' + client.slug + '", so no sign-in link was sent.');
      return NEUTRAL_REPLY;
    }
    const origin = process.env.PORTAL_PUBLIC_ORIGIN || DEFAULT_ORIGIN;
    const link = origin + '/reset/' + encodeURIComponent(makeResetToken(client.slug, auth.secret));
    const result = await sendViaResend(needle, buildEmail(client, link));
    // Kept with the rate limit record so a failed send can be diagnosed. No address or link is stored.
    await passcodes.noteForgotResult(client.slug, result);
  } catch (err) {
    console.error('[forgot] ' + err.message);
  }
  return NEUTRAL_REPLY;
}

module.exports = { handleForgot, buildEmail, addressesOnFile, NEUTRAL_REPLY };
