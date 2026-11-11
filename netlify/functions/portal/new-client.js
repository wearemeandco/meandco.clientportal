/* ============================================================
   Me&Co. : adding a business
   ------------------------------------------------------------
   One way to add a business, used by Melody's "Add a business" form in
   the admin and by Everly through the agent door, so a business added
   either way has the same record and the same portal.

   It writes the business into the client index (name, email addresses,
   locked or not) and, when asked, creates their portal with the seven
   stage cards. It sends nothing: the invite, the brief and the booking
   email are separate steps the caller chooses.
   ============================================================ */

const { getAllClients, addClientToIndex, normalizeEmails } = require('./clients');
const { saveClientState } = require('./blobs');

/* Every new portal starts here: Discovery open, each later stage locked
   until the one before it clears. Onboarding's id ends in
   "-onboarding-questions" so it never matches an "Onboarding Docs" card. */
const DEFAULT_CARDS = [
  { id: 'project1-discovery', project: 'Project 1', label: 'Discovery', status: 'not_started', locked: false },
  { id: 'project1-proposal', project: 'Project 1', label: 'Proposal', status: 'not_started', locked: true },
  { id: 'project1-contract', project: 'Project 1', label: 'Contract', status: 'not_started', locked: true },
  { id: 'project1-onboarding-questions', project: 'Project 1', label: 'Onboarding', status: 'not_started', locked: true, items: [] },
  { id: 'project1-invoice', project: 'Project 1', label: 'Invoice', status: 'not_started', locked: true },
  { id: 'project1-deliverables', project: 'Project 1', label: 'Deliverables', status: 'not_started', locked: true, items: [] },
  { id: 'project1-offboarding', project: 'Project 1', label: 'Offboarding', status: 'not_started', locked: true, lockRule: 'invoice', items: [] },
];

class NewClientError extends Error {}

function slugFor(name) {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/* Adds the business. opts: { name, slug?, emails?, locked?, createPortal?, cards? }.
   Returns { slug, entry }. Throws NewClientError with a sentence a person can act on. */
async function createClient(opts) {
  const name = String((opts && opts.name) || '').trim();
  const slug = slugFor(opts.slug || name);
  if (!slug) throw new NewClientError('Give the business a name.');
  const existing = await getAllClients();
  if (existing[slug]) throw new NewClientError('A business with that name is already in your portal.');
  const addresses = normalizeEmails([].concat(opts.emails || []));
  if (addresses.error) throw new NewClientError(addresses.error);
  const indexExtra = {};
  if (addresses.list.length) { indexExtra.email = addresses.list[0]; indexExtra.emails = addresses.list; }
  if (opts.locked === true) indexExtra.locked = true;
  const entry = await addClientToIndex(slug, name || slug, indexExtra);
  if (opts.createPortal !== false) {
    const cards = Array.isArray(opts.cards) && opts.cards.length ? opts.cards : DEFAULT_CARDS.map((c) => Object.assign({}, c));
    await saveClientState(slug, { slug, name: name || slug, repeatClient: false, paidUpfrontProjects: [], cards, activity: [] });
  }
  return { slug, entry };
}

module.exports = { createClient, slugFor, DEFAULT_CARDS, NewClientError };
