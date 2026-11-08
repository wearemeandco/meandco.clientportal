/* Wakes Everly's routine with a one-line pointer to what just happened.
   The pointer names the client, the kind of change and its id, never the
   client's words: Everly reads the real record herself. It never throws, so
   a failed wake can never break the save that triggered it.

   Netlify environment variables (names only):
     EVERLY_FIRE_ID   the routine's trig_ id, or its full API trigger URL
     EVERLY_TOKEN     the token generated with that API trigger
     EVERLY_PORTAL_WAKES  "on" to wake her on portal changes as well as mail.
                      Turn it on once Everly can read the portal (her connector). */

const BETA = 'experimental-cc-routine-2026-04-01';
const FIRE_BASE = 'https://api.anthropic.com/v1/claude_code/routines/';
const TIMEOUT_MS = 4000;

function fireUrl(v) {
  const x = String(v || '').trim();
  if (!x) return '';
  if (/^https:\/\//.test(x)) return x;
  return FIRE_BASE + encodeURIComponent(x) + '/fire';
}

const clip = (s, n) => String(s == null ? '' : s).replace(/[\r\n]+/g, ' ').slice(0, n);

async function wakeEverly(text) {
  const url = fireUrl(process.env.EVERLY_FIRE_ID);
  const token = process.env.EVERLY_TOKEN;
  if (!url || !token) return { fired: false, why: 'EVERLY_FIRE_ID or EVERLY_TOKEN is not set' };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        Authorization: 'Bearer ' + token,
        'anthropic-beta': BETA,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: clip(text, 400) }),
    });
    if (!res.ok) {
      console.error('[everly] wake failed ' + res.status);
      return { fired: false, why: 'routine answered ' + res.status };
    }
    return { fired: true };
  } catch (err) {
    console.error('[everly] wake failed: ' + err.message);
    return { fired: false, why: err.name === 'AbortError' ? 'timed out' : 'network error' };
  } finally {
    clearTimeout(timer);
  }
}

/* A portal change wakes her only when EVERLY_PORTAL_WAKES is on. */
async function wakeForPortal(slug, action, id) {
  if (String(process.env.EVERLY_PORTAL_WAKES || '').toLowerCase() !== 'on') return { fired: false, why: 'portal wakes are off' };
  return wakeEverly(portalPointer(slug, action, id));
}

/* What woke her, in one line: "Portal: casaluz request-add r_123". */
function portalPointer(slug, action, id) {
  return 'Portal: ' + clip(slug, 60) + ' ' + clip(action, 40) + (id ? ' ' + clip(id, 80) : '');
}

module.exports = { wakeEverly, wakeForPortal, portalPointer, fireUrl };
