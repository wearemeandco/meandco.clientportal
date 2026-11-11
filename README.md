# Me&Co. client portal

Melody's client portal: each client signs in with a passcode and sees their project, what is waiting on them, their request board, proposals and onboarding. It also wakes Everly the moment mail reaches her inbox.

## Netlify settings

Import this repository into Netlify (production branch `main`, deploy previews on for pull requests), then add these under Project configuration, Environment variables. Mark the secret ones "Contains secret values".

| Name | What it is |
| --- | --- |
| `ADMIN_PORTAL_PASSWORD` | Melody's admin passcode (`MELODY_ADMIN` also works). She signs in at `/login` as melody@weareme.co with it, or at `/admin` |
| `PORTAL_PUBLIC_ORIGIN` | the portal's address, like `https://clients.weareme.co` |
| `RESEND_API_KEY` | sends portal email from Melody's Resend account |
| `PORTAL_MAIL_FROM` | the sender, like `Me&Co. <hello@weareme.co>` |
| `BOOKING_URL` | Melody's booking link (https), shown on the thank-you screen and in the confirmation email. Leave it unset and the email says Melody will reach out to set a time, with no button |
| `CALLS_CLIENT_EMAILS` | `on` to hold one follow-up nudge in Resend for two days after a qualified inquiry (needs `BOOKING_URL`). Off by default |
| `PORTAL_PASSWORD_<SLUG>` | one per client, their passcode |
| `RESEND_WEBHOOK` | the signing secret of the Resend webhook below (whsec_...) |
| `EVERLY_FIRE_ID` | Everly's routine id (`trig_...`), or its full API trigger URL |
| `EVERLY_TOKEN` | the token for that trigger |
| `EVERLY_PORTAL_WAKES` | `on` to also wake Everly when a client acts in the portal (once Everly can read the portal) |

## Waking Everly

In Melody's Resend account: Webhooks, Add webhook, URL `https://<portal address>/hooks/resend`, event `email.received`. Copy its signing secret into `RESEND_WEBHOOK`. Use one webhook for this, so Everly wakes once per email. Melody can also wake her by hand: Admin, Wake Everly.

## Checks

`npm run check` renders every page, runs the brand guard and tests Everly's wake. The same checks run on every pull request.
