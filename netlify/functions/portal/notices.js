/* The two calm pages a client sees instead of their portal: the portal is
   closed (the client is archived) or still being set up (the portal is
   locked). Neither shows any client data. */

const OWNER_EMAIL = 'melody@weareme.co';
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function page(title, body) {
  return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>' + esc(title) + '</title></head>' +
    '<body style="margin:0"><div style="font-family:sans-serif;padding:60px 16px;text-align:center;line-height:1.5"><h1>' + esc(title) + '</h1>' + body + '</div></body></html>';
}

function closedPage() {
  return page('This portal is closed', '<p>Contact <a href="mailto:' + OWNER_EMAIL + '">' + OWNER_EMAIL + '</a> if you need anything.</p>');
}

function settingUpPage() {
  return page('Your portal is being set up', '<p>Check back shortly, or contact <a href="mailto:' + OWNER_EMAIL + '">' + OWNER_EMAIL + '</a>.</p>');
}

module.exports = { closedPage, settingUpPage, OWNER_EMAIL };
