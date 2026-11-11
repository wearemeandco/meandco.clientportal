/* ============================================================
   Me&Co. : the brief and calendar emails
   ------------------------------------------------------------
   Two more emails a client can be sent when their portal is created,
   in the same branded shell and through the same send path as the portal
   invite: the link to their onboarding brief, and the booking link for a
   discovery call.

   One email per address on file, each with a Resend idempotency key built
   from the client slug, the kind and the address, so a double click sends
   once. Results are counts only.
   ============================================================ */

const invite = require('./invite');
const forgot = require('./forgot');

const KINDS = ['brief', 'calendar'];

/* The booking link, or null when BOOKING_URL is not set. */
function bookingUrl() {
  const url = String(process.env.BOOKING_URL || '').trim();
  return /^https:\/\//.test(url) ? url : null;
}

function paragraph(text) {
  return '<p style="margin:0 0 18px;' + invite.FONT + 'font-size:15px;line-height:1.6;color:#1a1a1a;">' + invite.esc(text) + '</p>';
}

function buildMail(client, kind) {
  const origin = process.env.PORTAL_PUBLIC_ORIGIN || invite.DEFAULT_ORIGIN;
  if (kind === 'brief') {
    const link = origin + '/portal/' + encodeURIComponent(client.slug) + '/brief';
    const lead = 'Your onboarding brief is ready. It is a short set of questions, one at a time, and you can stop and come back whenever you like.';
    const help = 'You will sign in with your passcode first. If you have not chosen one yet, use Forgot passcode on the sign-in page at clients.weareme.co.';
    return invite.buildLinkEmail({
      eyebrow: 'Your brief',
      headline: 'Your onboarding brief',
      body: paragraph(lead) + paragraph(help),
      button: 'Open your brief',
      link,
      subject: 'Your Me&Co. onboarding brief',
      text: lead + '\n\n' + link + '\n\n' + help,
    });
  }
  const link = bookingUrl();
  const lead = 'Pick a time for your call with Melody. It takes a minute, and you can move it later from the confirmation email.';
  return invite.buildLinkEmail({
    eyebrow: 'Your call',
    headline: 'Book your call',
    body: paragraph(lead),
    button: 'Choose a time',
    link,
    subject: 'Book your call with Me&Co.',
    text: lead + '\n\n' + link,
  });
}

/* Sends one kind of email to every address on file. Returns counts only. */
async function sendClientMail(client, kind) {
  if (KINDS.indexOf(kind) === -1) throw new Error('Unknown email kind.');
  const addresses = forgot.addressesOnFile(client).filter((a, i, all) => all.indexOf(a) === i);
  const counts = { sent: 0, alreadySent: 0, failed: 0, total: addresses.length };
  if (!addresses.length) return counts;
  if (kind === 'calendar' && !bookingUrl()) {
    counts.failed = addresses.length;
    return counts;
  }
  const mail = buildMail(client, kind);
  for (const address of addresses) {
    const result = await invite.sendOne(address, mail, 'client-mail/' + client.slug + '/' + kind + '/' + address);
    if (result.ok) counts.sent++;
    else if (result.status === 409) counts.alreadySent++;
    else counts.failed++;
  }
  return counts;
}

module.exports = { sendClientMail, bookingUrl, KINDS };
