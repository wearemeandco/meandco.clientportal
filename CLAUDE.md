# Me&Co. client portal

This is Melody Estrada's client portal for Me&Co. (weareme.co). Melody owns it. Everly, her operations agent, and Ida, her coding agent, work in it. Every session in this repository works for Melody.

## Melody's Approve is the merge

Every change goes on a `claude/` branch and opens a pull request. Netlify builds a preview of it and the Portal checks run. When both are green, send Melody the preview link with one sentence on what changed and this line, bolded: **Once you approve this, that update goes live. Nothing else moves.**

When she approves that preview ("yes", "approved", "looks good", "merge it", or Approve on it), that is the merge. Merge it, let Netlify publish it, open the live page, and tell her what it now shows. Never ask again whether to merge something she approved, and never ask her to tap Merge herself. Never merge with a red check.

These wait for Melody's yes on that exact change, and her yes is enough:
- anything that touches payments or Stripe (prices, checkout, refunds)
- contracts, invoices, receipts and proposals sent to a client
- sign in and passcodes
- words a client will read that she has not approved

## Who can ask for work

| Who | May ask for |
| --- | --- |
| Melody (melody@weareme.co) | Anything. The only person who approves. |
| Michelle or Olivia at Mora Studios | Work up to an open pull request with its preview. Melody approves the merge. |

## How it runs

- Clients, cards and answers live in Netlify Blobs. `data/clients/*.json` is the starting shape and the local preview copy.
- `netlify/functions/portal/` is the portal, `netlify/functions/intake/` is sign in and the front door, `netlify/functions/admin/` is Melody's admin.
- `netlify/functions/hook-resend/` wakes Everly the moment mail reaches everly@admin.weareme.co.
- `npm run check` renders every page, runs the brand guard and tests Everly's wake.

## Rules

- Keys and passcodes live only in Netlify environment variables, typed in by Melody. Never in a file, a commit, a message or a log.
- Never push to `main`, never force push, never delete a client's records.
- Every push to `main` is a Netlify deploy, and every deploy spends Melody's Netlify credits. Batch finished changes into one merge, and push to `main` only to publish something she approved.
- `scripts/seed_blobs.js` never runs against production.
- Me&Co. colors only (navy #22315E, blue #2A4FBF, cream #FFFCF5, sand #EFE8DC, teal #6FAFA0, orange #E4572E, rose #D9A5A0), Fraunces for headings and DM Sans for text. The brand guard enforces it.
- No em dashes anywhere. No colored stripe down one edge of any box: a box is set apart by its background and a hairline border on all four sides.
