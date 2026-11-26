# Ajaia Docs — lightweight collaborative document editor

React (Vite) + Express + SQLite. Create/rename/edit rich-text documents, upload files into new documents, share with other users (editor/viewer), all persisted.

## Run locally

Requires Node 22.5+ (uses the built-in `node:sqlite`).

```bash
npm run install:all        # root + client dependencies
npm run build              # builds client/dist
npm start                  # http://localhost:3001 (serves API + built client)
```

Development with hot reload (two terminals): `npm run dev:server` and `npm run dev:client` (Vite on :5173, proxies `/api`).

Tests: `npm test` (Node's built-in test runner, no extra dependencies).

Docker / deployment: `docker build -t ajaia-docs . && docker run -p 8080:8080 -v ajaia-data:/data ajaia-docs`.
Any container host works (Render, Fly.io, Railway). Mount a persistent volume at `/data`, otherwise SQLite data resets on redeploy.

## Test accounts (seeded, mocked auth)

| User | Email |
|---|---|
| Alice Owner | alice@example.com |
| Bob Collaborator | bob@example.com |
| Carol Reviewer | carol@example.com |

Sign-in is a one-click user picker (no passwords) — deliberate scope cut, see ARCHITECTURE.md.

### Suggested review flow
1. Sign in as Alice → **New document**, type text, use the toolbar (bold/italic/underline, headings, lists). Rename via the title. Refresh: it persists.
2. **Upload file** with a `.txt`, `.md` or `.docx` → becomes a new editable document.
3. Open a document → **Share** → `bob@example.com`, "Can edit" (or "Can view").
4. In another browser/private window, sign in as Bob → document appears under **Shared with me** with its role. Editors can edit; viewers see a read-only page.
5. Sign in as Carol → cannot see the document (404).

## Supported uploads
`.txt`, `.md`, `.docx`, max 5MB. Shown in the UI. Images and tables inside `.docx` are not preserved.

## Status
See SUBMISSION.md for what works, what is incomplete, and next steps.
