#!/usr/bin/env node
/* Admin only. Reads a client secret from the private 'client-secrets' store.
   Usage:  NETLIFY_AUTH_TOKEN=... node scripts/read-client-secret.js culturalharvest airtable
           add --delete to remove it (used to clean up tests).
   NETLIFY_SITE_ID defaults to the portal site. Prints the stored JSON. */
const { getStore } = require('@netlify/blobs');
const [slug, name, flag] = process.argv.slice(2);
const token = process.env.NETLIFY_AUTH_TOKEN;
const siteID = process.env.NETLIFY_SITE_ID || '7733b95c-3481-4416-89fd-a169d3301faf';
if (!slug || !name || !token) { console.error('Usage: NETLIFY_AUTH_TOKEN=... node scripts/read-client-secret.js <slug> <name> [--delete]'); process.exit(1); }
(async () => {
  const store = getStore({ name: 'client-secrets', siteID, token });
  if (flag === '--delete') {
    await store.delete(slug + '/' + name); await store.delete(slug + '/' + name + '.meta');
    console.log('Deleted ' + slug + '/' + name); return;
  }
  const rec = await store.get(slug + '/' + name, { type: 'json' });
  if (!rec) { console.error('Nothing stored.'); process.exit(2); }
  console.log(JSON.stringify(rec, null, 2));
})().catch((e) => { console.error(e.message); process.exit(1); });
