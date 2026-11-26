# Submission

## Links (fill in before submitting)
- Live product: `<your deployed URL>`
- Walkthrough video: `<your Loom/YouTube URL>` (also place in `VIDEO_URL.txt`)

## Included
- `server/` Express API, SQLite store, importer, tests
- `client/` React (Vite) app
- `README.md` setup, test accounts, review flow
- `ARCHITECTURE.md` priorities and tradeoffs
- `AI_WORKFLOW.md` AI usage note
- `Dockerfile` deployment

## Test accounts
alice@example.com, bob@example.com, carol@example.com (no password; pick on the sign-in screen).

## What works
Create/rename/edit/reopen documents; bold, italic, underline, H1–H3, bullet/numbered lists; autosave; upload `.txt/.md/.docx` into a new document; share by email as editor/viewer; owned vs shared lists; viewer read-only; owner-only sharing/delete; persistence in SQLite; validation and error messages; unit tests.

## Incomplete / known limits
- Mocked auth; last-write-wins (no real-time collaboration).
- `.docx` import keeps basic structure only (no images/tables).
- `execCommand` editor (deprecated API).

## Next with 2–4 more hours
Tiptap editor, Markdown/PDF export, version history, presence indicators, route-level API tests, real auth.
