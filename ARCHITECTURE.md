# Architecture note

## Shape
```
client (React/Vite)  ──/api──▶  Express  ──▶  store.js (rules + SQL)  ──▶  SQLite (node:sqlite)
                                  └─ importer.js (txt/md/docx → HTML)
```
One deployable: Express serves the built client and the API from a single container.

## What I prioritized and why
1. **Access logic in one place.** `store.js` owns every permission check (`owner | editor | viewer | none`) and has no HTTP dependency, so the rules that matter most are unit tested directly. Non-collaborators get 404 rather than 403 so ids can't be probed.
2. **Persistence that preserves formatting.** Content is stored as sanitized HTML. It round-trips exactly what the editor produces, and the allowlist (`sanitize-html`) limits stored HTML to the tags the toolbar can create, which also blocks XSS from imported/pasted content.
3. **A coherent editing loop.** Debounced autosave (700ms), visible Saving/Saved/Not saved state, title rename with validation, read-only mode for viewers.
4. **Upload that fits the workflow.** `.txt/.md/.docx` become a new editable document owned by the uploader. Unsupported types and oversize files return clear errors.
5. **Simple, demonstrable sharing.** Owner grants `editor` or `viewer` by email; lists show "Owned by you" vs "Shared by X · role".

## Deliberate cuts
- **Auth:** seeded users + bearer token from a user picker. No passwords/OAuth. Enough to demo sharing; not production auth.
- **Editor:** `contenteditable` + `execCommand` (deprecated but dependable, zero dependencies). Next step would be Tiptap/ProseMirror.
- **Concurrency:** last write wins; no real-time collaboration, presence, or conflict handling.
- **Search, comments, version history, export:** not built.
- **Storage:** single SQLite file; fine for a demo, would move to Postgres for multiple instances.

## Tradeoffs worth naming
- Autosave sends the full HTML each time: simple and robust at this document size; would become operational transforms/CRDT or deltas for collaboration.
- Using `node:sqlite` avoids a native dependency (and build step) but ties the project to Node 22.5+.
