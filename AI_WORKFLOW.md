# AI workflow note

> DRAFT — edit this so it reflects what you actually did and decided. Reviewers are grading your judgment, so replace the bracketed parts with your own specifics.

## Tools used
- Claude (Sonnet 5.5) as a coding assistant for scaffolding, implementation and docs.
- [Add anything else: Copilot, Cursor, ChatGPT, etc.]

## Where AI materially sped things up
- Generating the Express/React skeleton, SQL schema and the permission matrix in one pass.
- Writing the first draft of the unit tests (access rules, validation, import) and the docs.
- Boilerplate: API client, dialog/list UI, CSS.

## What I changed or rejected
- Chose `node:sqlite` over `better-sqlite3` to avoid a native build in deployment.
- Kept `contenteditable` instead of adding Tiptap, to keep the dependency surface small and the editor behavior fully understood within the timebox.
- Returned 404 (not 403) for documents a user cannot access.
- [Add your own: things you rewrote, simplified or rejected after reviewing the output.]

## How I verified
- `npm test`: 5 unit tests on the store/import logic pass (create/edit/persist, sharing roles, viewer/outsider denial, validation, import).
- Client sources were syntax-checked; **the full stack (Express routes, Vite build, browser UX) was not executed by the AI in its sandbox** because package installs were unavailable. [Describe your own manual run-through here: login, edit, upload, share as Bob, viewer restrictions, refresh persistence.]
- [Add: browser checks, deployment smoke test.]
