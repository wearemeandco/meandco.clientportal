/* ============================================================
   Me&Co.: one way to open a Netlify Blobs store
   ------------------------------------------------------------
   Every store opener used to try the saved site token
   (NETLIFY_SITE_ID + NETLIFY_AUTH_TOKEN) first. When that token is
   refused, every write through it fails, and the client sees "That did
   not save". That is how Melody's first decision tap on 2026-11-06
   returned a 500 while her onboarding answers, which already used the
   function's own access (answers-store.js), kept saving.

   So, the same order answers-store.js and passcodes.js settled on:
   Netlify's own function access first, the saved token only as a
   fallback, and a failure on one falls through to the other on every
   single call, read or write.

   The function's own access needs the invocation's Blobs context, which
   portal.js, admin.js and intake.js hand over with connectBlobs(event)
   at the top of each handler.
   ============================================================ */

function makers(name) {
  const { getStore } = require('@netlify/blobs');
  const list = [() => getStore(name)];
  const siteID = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_AUTH_TOKEN;
  if (siteID && token) list.push(() => getStore({ name, siteID, token }));
  return list;
}

function openStore(name) {
  const call = (method) => async (...args) => {
    let lastErr;
    for (const make of makers(name)) {
      let store;
      try {
        store = make();
      } catch (err) {
        lastErr = err;
        continue;
      }
      try {
        return await store[method](...args);
      } catch (err) {
        lastErr = err;
        console.error('[store] ' + name + '.' + method + ' failed on one access path: ' + err.message);
      }
    }
    throw lastErr;
  };
  return {
    get: call('get'),
    getWithMetadata: call('getWithMetadata'),
    getMetadata: call('getMetadata'),
    set: call('set'),
    setJSON: call('setJSON'),
    delete: call('delete'),
    list: call('list'),
  };
}

function connectBlobs(event) {
  try {
    const blobs = require('@netlify/blobs');
    if (event && event.blobs && typeof blobs.connectLambda === 'function') blobs.connectLambda(event);
  } catch (err) {
    console.error('[store] connectLambda: ' + err.message);
  }
}

module.exports = { openStore, connectBlobs };
