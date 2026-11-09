# Me&Co. client workflow

Every step a Me&Co. client goes through, who does it, what tool it runs on, and what starts it. Then every open question, and the instruction for the Claude session that takes this over.

**Who does it**

| Tag | Means |
| --- | --- |
| 🙋 **Melody** | Only Melody can do it: a call, a signature, a yes. |
| 🤖 **Everly (AI)** | Everly, Melody's operations agent. Reads, drafts, sends what Melody has approved, hands builds to Ida. |
| 🛠 **Ida (AI)** | Ida, the coding agent. Builds changes as a pull request with a preview. Never sends email. |
| ⚙️ **System** | Code that runs on its own, the same way every time. No AI. |
| 👤 **Client** | The client does it. |
| ➕ **Other** | Another person or tool (an assistant, a contractor, Canva, a VA). |

## The steps

| # | Step | Who | Tool | What starts it | What happens | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | They fill in the interest form | 👤 Client | Portal form (`/start/inquiry`) | They open the form | Name, email, what they need. The portal checks it is a real person. | ✅ Works |
| 2 | "Got it. ¡Gracias!" email | ⚙️ System | Resend | Step 1, a qualified form | Goes within a minute in Me&Co. colors, lists what they told you, cc Melody. | 🟡 In PR #3 |
| 3 | They book a time | 👤 Client | Booking link (`BOOKING_URL`) | The button in step 2 | Books a call on Melody's calendar. | ❓ Q1 |
| 4 | Nudge if no booking in 2 days | ⚙️ System | Resend (held 48 hours) | Step 2 schedules it | One warm note. Booking cancels it. | ⏸ Off until Q4 |
| 5 | Everly sees the new inquiry | 🤖 Everly | Portal door, `node tools/portal.mjs read inquiries` | Every morning run | Logs it, marks its stage. | 🟡 Needs setup S3 to S5 |
| 6 | The call | 🙋 Melody | Phone or video | The booking | Melody talks, then tells Everly what she heard (email to everly@admin.weareme.co). | ✅ |
| 7 | Follow up after the call | 🤖 Everly | Resend | Melody's notes email | Everly drafts the follow-up. Melody approves it before it goes. | ✅ |
| 8 | Proposal built for them | 🤖 Everly, then 🙋 Melody | Portal proposal page | Melody's go after the call | Exact scope and exact pricing. Melody approves before the client sees it. | ✅ |
| 9 | Agreement | 🙋 Melody, 👤 Client | Signing tool | Proposal accepted | Both sign. | ❓ Q8 |
| 10 | Payment | 👤 Client, ⚙️ System | Stripe | Agreement signed | Checkout, or Melody tells Everly it came another way. | ❓ Q9 |
| 11 | Onboarding in their portal | 👤 Client, ⚙️ System | Portal | Payment landed | Their questions, files and folders, saved as they go. | ✅ |
| 12 | The work | 🤖 Everly, 🛠 Ida, 🙋 Melody | Everly, Ida, GitHub, Netlify | Onboarding done | Everly runs the system. Ida builds what needs code. Melody approves each preview. | ✅ |
| 13 | Wrap and review | 🤖 Everly | Resend, portal | Work delivered | Everything handed over, a thank you, one review ask. | ❓ Q10 |
| W | A change to this workflow | 🙋 Melody, then 🤖 Everly, then 🛠 Ida | Admin, Settings | Melody taps Request a change, or Add a feature on a business | Everly wakes, hands it to Ida, Melody approves the preview, it goes live. | 🟡 In PR #3 |

## Add a step

In the portal admin, open **Settings**, then **＋ Request a change** (or, on one business, **Ask**, then **✨ Add a feature**). It asks one thing at a time:

1. **What should happen?** In your own words. ("My client needs a way to add images to their folders.")
2. **Who does this step?** Me, Everly (AI), Ida (AI), System, The client, or Someone else.
3. **Which tool?** Optional. (Canva, Stripe, Google Drive, the portal.)
4. **Who is it for?** Every client, or one.
5. **How will you know it works?** Optional, one line.

Send to Everly wakes her. She hands it to Ida, and the preview comes back to you. Your approve is the merge.

The same, written here instead, works too. Copy this into an email to everly@admin.weareme.co:

```
New step
What should happen:
Who does it: Me / Everly / Ida / System / Client / Other
Tool:
For: every client / <client name>
How I'll know it works:
```

## Open questions

### For Melody to decide

| # | Question | Why it matters | Recommendation |
| --- | --- | --- | --- |
| Q1 | Where do people book a call with you? (Calendly, Google, Cal.com, nothing yet) | Step 3 and the nudge need a booking link. Without one, the email says you will reply with a time. | A free Cal.com account. It reuses what is already built. |
| Q2 | Is the portal's form your front door, or is weareme.co/interest? | The "Got it" email fires from the portal's form. Your real interest form lives on weareme.co and does not reach the portal. | Point weareme.co/interest at the portal, so every inquiry gets the email and reaches Everly. |
| Q3 | Should the portal form list your services? (Founder Authority Systems, Strategic Content Engine, AI Enabled Marketing Workflows, Partnership + Program Marketing, Marketing Systems Intensive, Program Workshop Booking, 1:1 Strategy Call, Create a special package, Not sure yet) | It lists Mora Studios' options today, and the "What you told us" box repeats them. | Yes, your interest form's list, word for word. |
| Q4 | Is the "Got it. ¡Gracias!" and the nudge wording right? | They go to every new inquiry. | Read both in PR #3 and say yes or what to change. Then `CALLS_CLIENT_EMAILS = on`. |
| Q5 | Which address do client emails come from? | `PORTAL_MAIL_FROM` | `Melody at Me&Co. <hello@weareme.co>` once that address can send in Resend. |
| Q6 | Credits: add, upgrade, or wait for the reset? | Nothing publishes until Netlify has build credits. | Add enough for one deploy. Everything waits in one pull request. |
| Q7 | Move the portal to clients.weareme.co now or later? | Links in emails use the portal address. | Later, after PR #3 is live. |
| Q8 | Which tool do you sign agreements with? | Step 9. | Tell Everly the tool, and she follows it. |
| Q9 | Stripe checkout links for each service, or one invoice per client? | Step 10. | One invoice per client, from the proposal. |
| Q10 | Where should a happy client leave a review? (Google, LinkedIn, the site) | Step 13 sends one review ask. | Google. |
| Q11 | Approve PR #3? | Your approve is the merge. It publishes the emails, Everly's door and the Workflow tab. | Approve once Q6 is done and the preview is green. |

### Setup (Melody's clicks, the Claude session walks her through each)

| # | Setup | Where |
| --- | --- | --- |
| S1 | One Resend webhook: `https://meandco-portal.netlify.app/hooks/resend`, event `email.received`, its secret saved as `RESEND_WEBHOOK` | Melody's Resend, Webhooks |
| S2 | `ADMIN_PORTAL_PASSWORD`, `RESEND_API_KEY`, `PORTAL_MAIL_FROM`, `PORTAL_PUBLIC_ORIGIN`, `BOOKING_URL` | Netlify, meandco-portal, Environment variables |
| S3 | `EVERLY_AGENT_TOKEN`: one long random key | Netlify, same place, Contains secret values |
| S4 | The same key as a network secret: host `meandco-portal.netlify.app`, header `Authorization`, value `Bearer <key>` | Everly's routine, environment settings, Network secrets |
| S5 | Allowed domain `meandco-portal.netlify.app` | Everly's routine, environment, Network access, Custom |
| S6 | `EVERLY_PORTAL_WAKES = on` | Netlify, Environment variables |
| S7 | Everly's connectors: Resend, Gmail, Kit, Airtable, Cloudinary, Google Drive, Google Calendar, Netlify, Inkbox | Everly's routine, Connectors |
| S8 | Texting: an Inkbox identity for Everly with iMessage turned on (inkbox.ai, Identities, New) | Melody's Inkbox account |
| S9 | Texting: `INKBOX_API_KEY`, `EVERLY_INKBOX_IDENTITY_ID` (the identity's id), `MELODY_PHONE` (like +15125550123) | Netlify, meandco-portal, Environment variables |
| S10 | Texting: press **Connect texting**, then text Everly "hi" from Melody's phone | Portal admin, Settings |

## The pieces, explained

Three kinds of things make this run. Each one lives in a different place, and each is set up once.

**Connectors (MCP).** A connector lets Everly use one of Melody's accounts, signed in as Melody, without ever holding a password. "MCP" is just the name of the plug they use. They are added in Claude: claude.ai, Settings, Connectors, then switched on for Everly's routine (claude.ai/code/routines, Everly, Connectors).

| Connector | What Everly does with it |
| --- | --- |
| Resend | Reads mail that reaches everly@admin.weareme.co, sends replies and client emails, checks each send landed |
| Gmail | Reads Melody's inbox for newsletter links and intake |
| Kit | Builds the newsletter draft (never sends or schedules it) |
| Airtable | Logs links, grants and Melody's Notes & Rules |
| Cloudinary | Images for the site and the newsletter |
| Google Drive, Google Calendar | Files, and what is on Melody's week |
| Netlify | Reads what is deployed and whether a preview is ready |
| Inkbox | Everly's own iMessage line: reads Melody's texts and texts her back |

**Netlify settings (environment variables).** Settings the portal reads when it runs. Names only here, never values. They live in Netlify, project meandco-portal, Project configuration, Environment variables. Mark every key or password "Contains secret values".

| Setting | What it does | Secret? |
| --- | --- | --- |
| `ADMIN_PORTAL_PASSWORD` | Melody's admin passcode | Yes |
| `RESEND_API_KEY` | Lets the portal send email | Yes |
| `PORTAL_MAIL_FROM` | Who client email comes from | No |
| `PORTAL_PUBLIC_ORIGIN` | The portal's address, used in email links | No |
| `BOOKING_URL` | Melody's booking link (Q1) | No |
| `CALLS_CLIENT_EMAILS` | `on` turns on the 2 day nudge (Q4) | No |
| `RESEND_WEBHOOK` | Proves a "mail arrived" message really came from Resend | Yes |
| `EVERLY_FIRE_ID`, `EVERLY_TOKEN` | Let the portal wake Everly's routine | Yes |
| `EVERLY_AGENT_TOKEN` | The key Everly uses to read and update the portal | Yes |
| `EVERLY_PORTAL_WAKES` | `on` wakes Everly on portal changes too | No |
| `IDA_FIRE_ID`, `IDA_TOKEN` | Let Everly wake Ida's routine with a build | Yes |
| `PORTAL_PASSWORD_<BUSINESS>` | One passcode per business | Yes |

**Everly's environment (in Claude).** Where her routine runs: claude.ai/code/routines, Everly, the environment under the Instructions box. Two things live there: the web addresses she may open (Network access, Custom: weareme.co, weareme.netlify.app, res.cloudinary.com, meandco-portal.netlify.app), and the portal key as a network secret (S4), which Claude adds to her calls so she never holds it.

**How a wake happens, start to finish.** Mail reaches everly@admin.weareme.co. Resend tells the portal (`/hooks/resend`). The portal checks it really came from Resend (`RESEND_WEBHOOK`), then fires Everly's routine (`EVERLY_FIRE_ID`, `EVERLY_TOKEN`). Everly starts, reads the email through the Resend connector, and replies in the same run. A Settings request or an Ask tile follows the same path from the portal, with no email in between. A text works the same way: Melody texts Everly's iMessage line, Inkbox tells the portal (`/hooks/inkbox`), the portal checks the delivery and that it came from `MELODY_PHONE`, then wakes Everly, who reads it and texts back through her Inkbox connector.

## Take over: instruction for the Claude session

Paste everything below the line into a new session at claude.ai/code, signed in to the Claude account that owns Everly's routine, with `wearemeandco/everlyagent` and `wearemeandco/meandco.clientportal` attached.

---

You are taking over Me&Co.'s client workflow and bringing Everly, Melody's operations agent, fully to life: she wakes when mail reaches everly@admin.weareme.co, when Melody asks for something in her portal, and every morning, and she acts on it the same day.

Read first, in this order: `meandco.clientportal/docs/MELODY_WORKFLOW.md` (this file), `meandco.clientportal/CLAUDE.md`, `everlyagent/CLAUDE.md`, `everlyagent/.claude/skills/portal/SKILL.md`, `everlyagent/routine/SETUP.md`, `everlyagent/routine/HEALTH_CHECK.md`.

Then:

1. **Ask Melody the open questions**, Q1 to Q11, one at a time, each with its recommendation, in plain words. Write each answer into this file's Open questions table (answered, with her words) in the same pull request, and carry it out.
2. **Walk her through setup**, S1 to S7, one click at a time: the exact page, the exact field, what to type. Never ask her to paste a key into chat. After each, check it worked (a name exists in Netlify, a webhook exists in Resend, `node tools/portal.mjs read workflow` answers).
3. **Publish.** When Q6 is done and PR #3's checks and preview are green, send Melody the preview link with one sentence on what changed and this line in bold: **Once you approve this, that update goes live. Nothing else moves.** Her approve is the merge. Merge it, let Netlify publish, and open the live page.
4. **Prove it**, with evidence for each:
   - Melody emails everly@admin.weareme.co. A run starts within a minute and she gets a reply in that run (Resend shows it delivered).
   - Melody adds a step in the Workflow tab, choosing who does it and the tool. Everly wakes, reads it with `node tools/portal.mjs read workflow`, hands it to Ida, and the step shows "Ida is building".
   - A test inquiry on the portal form gets the "Got it. ¡Gracias!" email, and Everly sees it the next morning.
5. **Keep this file true.** Every step that changes, every new step Melody adds, and every answered question updates the tables above, in the same pull request as the change.
6. **Report** with one table: each step and each question, done or waiting, and for waiting, the one thing Melody needs to do and where.

Rules that hold the whole time: Melody's yes is the only yes for anything a client reads, any money, any signature, any merge. Keys live only where Melody types them. No em dashes. Never delete a client's records. Every push to `main` spends her Netlify credits, so batch changes into one merge.
