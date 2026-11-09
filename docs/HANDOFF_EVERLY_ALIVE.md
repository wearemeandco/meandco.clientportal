# Bring Everly to life

Paste everything below the line into a new session at claude.ai/code, signed in to the Claude account that owns Everly's routine, with the repositories `wearemeandco/everlyagent` and `wearemeandco/meandco.clientportal` attached.

---

You are setting up Everly, Me&Co.'s operations agent, so she wakes and acts on her own: the moment mail reaches everly@admin.weareme.co, the moment Melody asks for something in her portal, and every morning. Work through the checklist below in order. Do every step you can do yourself. For each step only Melody can do (a click inside her Netlify, her Resend, or a routine's settings), give her the exact place and the exact steps, one at a time, then check it worked before moving on. Never print, paste or log a key. Keys are typed by Melody into the place that holds them.

Read first: `everlyagent/CLAUDE.md`, `everlyagent/routine/SETUP.md`, `everlyagent/routine/HEALTH_CHECK.md`, `everlyagent/.claude/skills/portal/SKILL.md`, and `meandco.clientportal/CLAUDE.md`.

1. **The routine.** Open claude.ai/code/routines and find Everly's routine. Confirm its Instructions box matches `everlyagent/routine/ROUTINE_PROMPT.md` (everything below its line), its repository is `wearemeandco/everlyagent` on branch `claude/festive-lovelace-fqrybs`, and these connectors are attached: Resend, Gmail, Kit, Airtable, Cloudinary, Google Drive, Google Calendar, Netlify. List what is missing.
2. **Her schedule.** The routine runs once each weekday morning (her newsletter and inbox sweep). Confirm the schedule exists.
3. **The API trigger.** The routine has an API trigger. Its fire id and token are already saved in Melody's Netlify (project meandco-portal) as `EVERLY_FIRE_ID` and `EVERLY_TOKEN`. Confirm both names exist there (names only).
4. **Mail wakes her.** In Melody's Resend, Webhooks: one webhook, URL `https://meandco-portal.netlify.app/hooks/resend`, event `email.received`. Its signing secret is saved in Netlify as `RESEND_WEBHOOK`. Exactly one webhook, so Everly wakes once per email.
5. **The network.** The routine's environment, Network access, Custom, includes `weareme.co`, `weareme.netlify.app`, `res.cloudinary.com` and `meandco-portal.netlify.app`.
6. **The portal key.** Follow `everlyagent/routine/SETUP.md` Step 3b: one long random key, saved as `EVERLY_AGENT_TOKEN` in Netlify (Contains secret values) and as a network secret on the routine's environment for host `meandco-portal.netlify.app`, header `Authorization`, value `Bearer ` and the key.
7. **Portal wakes.** In Netlify, add `EVERLY_PORTAL_WAKES` = `on`, so a portal change wakes her too.
8. **Publish the portal.** Pull request `wearemeandco/meandco.clientportal#3` carries the new emails, Everly's door (`/hooks/agent`) and the Workflow tab. Netlify must have build credits (Team settings, Billing). When its checks and preview are green, send Melody the preview with the line **Once you approve this, that update goes live. Nothing else moves.** Her approve is the merge: merge it, let Netlify publish, and confirm `https://meandco-portal.netlify.app/admin/workflow` asks for sign in and `/hooks/agent` answers 401 without the key.
9. **Prove she is alive.** Run these three and show what happened for each, with the evidence:
   - Melody emails everly@admin.weareme.co "Everly, what is on my plate this week?" A run starts within a minute (routine run history) and Melody gets a reply in that run (Resend shows it delivered).
   - Melody opens her admin, Workflow, Add a step or feature, "My client needs a way to add images to their folders", Send to Everly. A run starts, Everly reads it with `node tools/portal.mjs read workflow`, hands it to Ida, and the ask shows "Ida is building".
   - A test inquiry on the portal's form gets the "Got it. ¡Gracias!" email.
10. **Report.** One table: each step, done or waiting, and for waiting, the one thing Melody needs to do and where.
