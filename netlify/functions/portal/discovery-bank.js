/* ============================================================
   Me&Co. — the discovery question bank, and the selection
   that turns it into one client's brief
   ------------------------------------------------------------
   brief-schema.js is the bank: the real thirteen section creative
   brief, written once, with nonprofit and business vocabulary
   variants. It is a plain data structure, so adding, rewording or
   removing a question there is a content edit, not a build.

   The brief strategy is logic based, and the brief a client gets
   carries only relevant questions. So the bank is
   never sent whole. After the real discovery call she opens
   /admin/<slug>/brief, ticks what actually came up, and that
   selection is stored on the client record:

     state.brief = {
       variant:  "nonprofit" | "business",
       sections: ["org", "goals", ...],   // ordered, chosen
       excluded: ["org.funding", ...],    // single fields dropped
       note:     "a line in her own voice, shown at the top",
       updated:  "<ISO 8601 timestamp>"
     }

   Excluded field ids are namespaced "<sectionId>.<fieldId>" because
   field ids are only unique inside their section.

   With nothing selected yet, defaultSections() returns every section
   in the variant, which is the old behaviour: a brief is never empty,
   it just is not customised until she customises it. resolve() says
   which of the two it is, so the admin page can tell her plainly.
   ============================================================ */

const { buildBrief, VARIANTS, resolveVariant } = require('./brief-schema.js');

function defaultSections(variant) {
  return buildBrief(resolveVariant(variant)).sections.map((s) => s.id);
}

function allSections(variant) {
  return buildBrief(resolveVariant(variant)).sections;
}

function fieldKey(sectionId, fieldId) {
  return sectionId + '.' + fieldId;
}

/* The single resolution point. Everything that renders or counts a
   client's stage 2 goes through here, so the admin picker and the form
   the client opens can never disagree about what is in it. */
function resolveBrief(state) {
  const brief = (state && state.brief) || {};
  const variant = resolveVariant(brief.variant);
  const full = buildBrief(variant);
  const excluded = brief.excluded || [];
  const chosenIds = Array.isArray(brief.sections) && brief.sections.length ? brief.sections : null;

  const byId = {};
  full.sections.forEach((s) => {
    byId[s.id] = s;
  });

  const order = chosenIds || full.sections.map((s) => s.id);
  const sections = order
    .map((id) => byId[id])
    .filter(Boolean)
    .map((s) => Object.assign({}, s, { fields: s.fields.filter((f) => excluded.indexOf(fieldKey(s.id, f.id)) === -1) }))
    .filter((s) => s.fields.length);

  return {
    variant,
    meta: full.meta,
    sections,
    note: brief.note || '',
    customised: !!chosenIds,
    fieldCount: sections.reduce((n, s) => n + s.fields.length, 0),
    totalFieldCount: full.sections.reduce((n, s) => n + s.fields.length, 0),
  };
}

module.exports = { resolveBrief, defaultSections, allSections, fieldKey, VARIANTS, resolveVariant };
