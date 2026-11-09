# Melody's workflow page

Melody's workflow page is a Claude artifact: every step a client goes through, her real emails, and a box on each step to change it or add a new one. What she saves is kept on the page. When she says "push my workflow changes", Claude builds them.

## Make the page (once)

Paste into a new session at claude.ai/code, signed in to Melody's account, with `wearemeandco/meandco.clientportal` attached:

> Publish `docs/workflow-artifact.html` from this repository as my artifact, with the `db` capability and one rule: path `changes`, read `view`, write `interact`. Give me the link, and remember it in this repository as `docs/WORKFLOW_ARTIFACT_URL.txt` in a pull request.

## Push the changes (every time)

Paste into a session with the same repository attached, signed in to Melody's account:

> Push my workflow changes. Read the `changes` collection of my workflow page (the link in `docs/WORKFLOW_ARTIFACT_URL.txt`). For every row whose status is `saved`: set it to `building`, then make the change in this repository on a `claude/` branch, following `CLAUDE.md`. Put everything from this round in one pull request, so one approval and one deploy covers it. When the preview is green, set each row to `preview` with the preview link in its `preview` field, and send me the preview with one line per change. When I approve, merge it, check the live page, and set each row to `live`. A change that needs money, a contract, or a decision only I can make: set it to `declined` with the reason in a `note` field, and ask me.
