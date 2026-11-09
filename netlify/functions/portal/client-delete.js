/* ============================================================
   Deleting a client for good
   ------------------------------------------------------------
   Removes every record a client has in every store that holds one:
   portal state, request board, files-and-links record, uploaded files,
   saved answers, stored secrets, passcode records, and the client's index
   entry. It never touches intake or inquiry records, which are the
   studio's own, and never anything belonging to another client.

   The counts are taken first and written as one log line (slug and
   counts only, no client content), then the records are removed and the
   index entry goes last, so a failure part way leaves the client listed
   and the delete can be run again.
   ============================================================ */

const blobs = require('./blobs');
const requestsStore = require('./requests-store');
const filesStore = require('./files-store');
const answersStore = require('./answers-store');
const clientSecrets = require('./client-secrets');
const passcodes = require('./passcodes');
const clients = require('./clients');

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

async function pass(slug, dryRun) {
  const state = await blobs.deleteClientState(slug, dryRun);
  const req = await requestsStore.deleteClientRequests(slug, dryRun);
  const files = await filesStore.deleteClientFiles(slug, dryRun);
  const answers = await answersStore.deleteClientAnswers(slug, dryRun);
  const secrets = await clientSecrets.deleteClientSecrets(slug, dryRun);
  const passcodeRecords = await passcodes.deleteClientPasscodes(slug, dryRun);
  return { state, requests: req.requests, files, uploads: req.uploads, answers, secrets, passcodes: passcodeRecords, index: 1 };
}

/* Deletes every record for the slug. Returns the counts removed. */
async function deleteClientData(slug) {
  if (!SLUG_RE.test(String(slug || ''))) throw new Error('Not a client slug.');
  const counts = await pass(slug, true);
  console.log('[delete-client] slug=' + slug + ' removing ' + Object.keys(counts).map((k) => k + '=' + counts[k]).join(' '));
  await pass(slug, false);
  await clients.removeClientFromIndex(slug);
  return counts;
}

module.exports = { deleteClientData, SLUG_RE };
