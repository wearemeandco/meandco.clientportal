// Writes every data/clients/*.json into the Netlify Blobs store 'clients',
// one key per slug, replacing whatever the store holds for that slug.
// Production reads Blobs, and the store already holds a record for every
// current client, so a run against main overwrites live client records with
// the repo copy. Run it only for a slug known to have no Blobs record, or on
// Melody's instruction. The bundled JSON is read where
// MORA_PORTAL_LOCAL_DATA is set (dev, branch and preview contexts) and as the
// fallback for a slug with no record.
const fs = require('fs');
const path = require('path');
const { getStore } = require('@netlify/blobs');

const SITE_ID = process.env.NETLIFY_SITE_ID;
if (!SITE_ID) throw new Error('Set NETLIFY_SITE_ID in the environment before running this.');
const TOKEN = process.env.NETLIFY_AUTH_TOKEN;
if (!TOKEN) throw new Error('Set NETLIFY_AUTH_TOKEN in the environment before running this.');

const DATA_DIR = path.join(__dirname, '..', 'data', 'clients');

async function main() {
  const store = getStore({ name: 'clients', siteID: SITE_ID, token: TOKEN });
  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    const slug = file.replace(/\.json$/, '');
    const state = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
    await store.setJSON(slug, state);
    console.log('seeded:', slug);
  }
  console.log('done,', files.length, 'client(s) seeded');
}

main().catch((e) => {
  console.error('SEED FAILED:', e.message);
  process.exit(1);
});
