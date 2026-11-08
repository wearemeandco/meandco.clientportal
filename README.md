# Me&Co. client portal

Melody's client portal: each client signs in with a passcode and sees their project, what is waiting on them, their request board, proposals and onboarding. It also wakes Everly the moment mail reaches her inbox.

## Netlify settings

Import this repository into Netlify (production branch `main`, deploy previews on for pull requests), then add these under Project configuration, Environment variables. Mark the secret ones "Contains secret values".

| Name | What it is |
| --- | --- |
| `ADMIN_PORTAL_PASSWORD` | Melody's admin passcode |
| `PORTAL_PUBLIC_ORIGIN` | the portal's address, like `https://portal.weareme.co` |
| `RESEND_API_KEY` | sends portal email from Melody's Resend account |
| `PORTAL_MAIL_FROM` | the sender, like `Me&Co. <hello@weareme.co>` |
| `PORTAL_PASSWORD_<SLUG>` | one per client, their passcode |
| `RESEND_WEBHOOK_SECRET` | the signing secret of the Resend webhook below |
| `EVERLY_FIRE_ID` | Everly's routine id (`trig_...`), or its full API trigger URL |
| `EVERLY_TOKEN` | the token for that trigger |

## Waking Everly

In Melody's Resend account: Webhooks, Add webhook, URL `https://<portal address>/hooks/resend`, event `email.received`. Copy its signing secret into `RESEND_WEBHOOK_SECRET`. Use one webhook for this, so Everly wakes once per email.

## Checks

`npm run check` renders every page, runs the brand guard and tests Everly's wake. The same checks run on every pull request.
