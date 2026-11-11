/* ============================================================
   Me&Co. : portal invite email
   ------------------------------------------------------------
   Emails a client a link to choose their own passcode and sign in.
   The link is a reset token that lasts 72 hours, so the existing
   Set a new passcode page accepts it, and saving a passcode ends it.
   If the client has no passcode record yet, a throwaway one is created
   so the link has a secret to be signed with; its value is never
   returned or logged.

   One email per address on file, each with a Resend idempotency key
   built from the client and the address, so a repeat inside 24 hours
   is dropped by Resend itself. Results are counts only: no link and no
   address ever leaves this module.
   ============================================================ */

const { makeInviteToken } = require('./session');
const passcodes = require('./passcodes');
const forgot = require('./forgot');

const DEFAULT_FROM = 'Me&Co. <everly@admin.weareme.co>';
const DEFAULT_ORIGIN = 'https://clients.weareme.co';
const FONT = "font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";

let fetchImpl = (...a) => fetch(...a);
function _setFetch(fn) { fetchImpl = fn; }

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* The branded email shell every portal email wears: header band, eyebrow,
   headline, a body, one button, and the footer. */
function buildLinkEmail(opts) {
  const url = esc(opts.link);
  const html =
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
    '<body style="margin:0;padding:0;background:#FFFCF5;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFCF5;padding:28px 12px;"><tr><td align="center">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:14px;overflow:hidden;">' +
    '<tr><td style="background:#22315E;padding:24px 34px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr>' +
    '<td style="padding-right:9px;"><div style="width:11px;height:11px;background:#D9A5A0;border-radius:50%;font-size:0;line-height:0;">&nbsp;</div></td>' +
    '<td style="' + FONT + 'font-size:17px;font-weight:700;color:#FFFCF5;letter-spacing:-0.2px;">Me&Co.</td></tr></table></td></tr>' +
    '<tr><td style="padding:32px 34px 4px;"><div style="' + FONT + 'font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#22315E;">' + esc(opts.eyebrow) + '</div>' +
    '<h1 style="margin:12px 0 0;' + FONT + 'font-size:24px;line-height:1.28;color:#22315E;font-weight:700;">' + esc(opts.headline) + '</h1></td></tr>' +
    '<tr><td style="padding:18px 34px 0;' + FONT + '">' + opts.body + '</td></tr>' +
    '<tr><td align="center" style="padding:12px 34px 4px;"><a href="' + url + '" style="display:inline-block;background:#2A4FBF;color:#FFFFFF;' + FONT + 'font-size:14px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;text-decoration:none;padding:15px 38px;border-radius:12px;">' + esc(opts.button) + '</a></td></tr>' +
    '<tr><td align="center" style="padding:0 34px 8px;' + FONT + 'font-size:12px;color:#8a8578;">or paste this in: <a href="' + url + '" style="color:#22315E;word-break:break-all;">' + url + '</a></td></tr>' +
    '<tr><td style="padding:16px 34px 30px;"><div style="border-top:1px solid #EFE8DC;padding-top:16px;' + FONT + 'font-size:11.5px;color:#8a8578;">Me&Co. &middot; hello@weareme.co</div></td></tr>' +
    '</table></td></tr></table></body></html>';
  const text = opts.text + '\n\nMe&Co.\nhello@weareme.co\n';
  return { subject: opts.subject, html, text };
}

function buildInviteEmail(client, link) {
  const name = esc(client.name || 'your portal');
  const body =
    '<p style="margin:0 0 18px;' + FONT + 'font-size:15px;line-height:1.6;color:#1a1a1a;">Your Me&Co. portal for ' + name + ' is ready. Tap the button to choose your own passcode and sign in.</p>' +
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 18px;"><tr><td style="background:#FFFCF5;border:1px solid #EFE8DC;border-radius:12px;padding:14px 18px;' + FONT + 'color:#22315E;font-size:15px;line-height:1.6;">The link works once and lasts 72 hours. If it runs out, use Forgot passcode on the sign-in page at clients.weareme.co.</td></tr></table>';
  return buildLinkEmail({
    eyebrow: 'Your portal',
    headline: 'Your portal is ready',
    body,
    button: 'Choose your passcode',
    link,
    subject: 'Your Me&Co. portal is ready',
    text:
      'Your Me&Co. portal for ' + (client.name || 'your portal') + ' is ready. Choose your own passcode and sign in here:\n\n' +
      link + '\n\n' +
      'The link works once and lasts 72 hours. If it runs out, use Forgot passcode on the sign-in page at clients.weareme.co.',
  });
}

/* One Resend send. Never logs the key, the link or the address. */
async function sendOne(to, mail, idempotencyKey) {
  const key = process.env.RESEND_API_KEY || process.env.RESEND_KEY;
  if (!key) {
    console.error('[invite] Neither RESEND_API_KEY nor RESEND_KEY is set, so no invite was sent.');
    return { ok: false, status: 'no-key' };
  }
  try {
    const res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
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
      if (res.status !== 409) console.error('[invite] Resend refused the send, status ' + res.status + ': ' + reason);
      return { ok: false, status: res.status };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    console.error('[invite] Resend request failed: ' + err.message);
    return { ok: false, status: 'network' };
  }
}

/* Sends the invite to every address on file. Returns counts only. */
async function sendInvite(client) {
  const addresses = forgot.addressesOnFile(client).filter((a, i, all) => all.indexOf(a) === i);
  const counts = { sent: 0, alreadySent: 0, failed: 0, total: addresses.length };
  if (!addresses.length) return counts;

  let auth = await passcodes.resolveAuth(client);
  if (!auth) {
    const rec = await passcodes.setPasscode(client.slug, passcodes.generatePasscode());
    auth = { secret: passcodes.secretFromRecord(rec) };
  }
  const origin = process.env.PORTAL_PUBLIC_ORIGIN || DEFAULT_ORIGIN;
  const link = origin + '/reset/' + encodeURIComponent(makeInviteToken(client.slug, auth.secret));
  const mail = buildInviteEmail(client, link);

  for (const address of addresses) {
    const result = await sendOne(address, mail, 'portal-invite/' + client.slug + '/' + address);
    if (result.ok) counts.sent++;
    else if (result.status === 409) counts.alreadySent++;
    else counts.failed++;
  }
  return counts;
}

module.exports = { sendInvite, buildInviteEmail, buildLinkEmail, sendOne, esc, FONT, DEFAULT_ORIGIN, _setFetch };
