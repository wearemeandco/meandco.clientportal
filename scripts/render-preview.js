/* Throwaway local render harness. Renders the real portal functions
   against the real client JSON so the output can be opened in a browser
   without netlify dev, a deploy, or a passcode. Writes to .preview/. */

process.env.MORA_PORTAL_LOCAL_DATA = '1';

const fs = require('fs');
const path = require('path');

const { getClient } = require('../netlify/functions/portal/clients.js');
const { getClientState } = require('../netlify/functions/portal/blobs.js');
const { renderDashboard } = require('../netlify/functions/portal/dashboard.js');
const { renderCardDetail } = require('../netlify/functions/portal/card-detail.js');
const { renderLockScreen } = require('../netlify/functions/portal/lock-screen.js');
const { getRequests } = require('../netlify/functions/portal/requests-store.js');
const { renderRequestsPage, renderReviewPage } = require('../netlify/functions/portal/requests-board.js');

const OUT = path.join(__dirname, '..', '.preview');

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const slugs = ['sample'];
  for (const slug of slugs) {
    const client = await getClient(slug);
    const state = await getClientState(slug);
    if (!client || !state) throw new Error('missing client or state for ' + slug);

    // The board renders even when a client's board is hidden, so it can be
    // reviewed here before it is switched on.
    const requests = await getRequests(slug);
    const dash = renderDashboard(client, state, requests);
    fs.writeFileSync(path.join(OUT, slug + '-requests.html'), renderRequestsPage(client, requests));
    fs.writeFileSync(path.join(OUT, slug + '-review.html'), renderReviewPage(client, requests));
    fs.writeFileSync(path.join(OUT, slug + '.html'), dash);

    const lock = renderLockScreen(client);
    fs.writeFileSync(path.join(OUT, slug + '-lock.html'), lock);

    // A card with a checklist, and the offboarding instructions mode.
    const withChecklist = (state.cards || []).find((c) =>
      (c.items || []).some((i) => (i.checklist || []).length)
    );
    if (withChecklist) {
      fs.writeFileSync(
        path.join(OUT, slug + '-card-' + withChecklist.id + '.html'),
        renderCardDetail(client, withChecklist)
      );
    }

    const lockedCards = (state.cards || []).filter((c) => c.locked);
    console.log(
      slug,
      '| cards:', (state.cards || []).length,
      '| locked:', lockedCards.length, '(' + lockedCards.map((c) => c.id).join(', ') + ')',
      '| activity:', (state.activity || []).length,
      '| checklist card:', withChecklist ? withChecklist.id : 'none',
      '| dashboard bytes:', dash.length
    );
  }
  console.log('\nwrote to', OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
