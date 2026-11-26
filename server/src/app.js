'use strict';
const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const multer = require('multer');
const sanitizeHtml = require('sanitize-html');
const { marked } = require('marked');
const mammoth = require('mammoth');
const { openStore, HttpError } = require('./store');
const { importFile, SUPPORTED } = require('./importer');

// Allowlist keeps stored HTML to what the editor can produce (blocks XSS via pasted/imported content).
const sanitize = (html) =>
  sanitizeHtml(html, {
    allowedTags: ['p', 'br', 'h1', 'h2', 'h3', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'blockquote', 'a', 'code', 'pre', 'hr'],
    allowedAttributes: { a: ['href'] },
    allowedSchemes: ['http', 'https', 'mailto'],
  });

function createApp({ dbFile = ':memory:' } = {}) {
  const store = openStore(dbFile, { sanitize });
  const app = express();
  app.use(express.json({ limit: '3mb' }));
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).then((r) => r !== undefined && res.json(r)).catch(next);

  const auth = (req, _res, next) => {
    const token = (req.headers.authorization || '').replace(/^Bearer /, '');
    req.user = store.userForToken(token);
    if (!req.user) return next(new HttpError(401, 'Please sign in'));
    next();
  };
  const docId = (req) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(400, 'Invalid document id');
    return id;
  };

  app.get('/api/users', wrap(() => store.listUsers()));
  app.post('/api/login', wrap((req) => store.login(req.body && req.body.email)));
  app.get('/api/me', auth, wrap((req) => req.user));

  app.get('/api/documents', auth, wrap((req) => store.listDocuments(req.user.id)));
  app.post('/api/documents', auth, wrap((req) => store.createDocument(req.user.id, req.body || {})));
  app.get('/api/documents/:id', auth, wrap((req) => store.getDocument(docId(req), req.user.id)));
  app.patch('/api/documents/:id', auth, wrap((req) => store.updateDocument(docId(req), req.user.id, req.body || {})));
  app.delete('/api/documents/:id', auth, wrap((req) => { store.deleteDocument(docId(req), req.user.id); return { ok: true }; }));

  app.get('/api/documents/:id/shares', auth, wrap((req) => store.listShares(docId(req), req.user.id)));
  app.post('/api/documents/:id/shares', auth, wrap((req) => store.share(docId(req), req.user.id, req.body || {})));
  app.delete('/api/documents/:id/shares/:userId', auth, wrap((req) => store.unshare(docId(req), req.user.id, Number(req.params.userId))));

  // Upload .txt/.md/.docx -> new editable document owned by the uploader.
  app.post('/api/documents/import', auth, upload.single('file'), wrap(async (req) => {
    if (!req.file) throw new HttpError(400, `Choose a file to upload (${SUPPORTED.join(', ')})`);
    try {
      const { title, html } = await importFile(req.file, { marked, mammoth });
      return store.createDocument(req.user.id, { title, content: html });
    } catch (e) {
      if (e.status) throw new HttpError(e.status, e.message);
      throw new HttpError(422, 'Could not read that file');
    }
  }));

  const dist = path.join(__dirname, '..', '..', 'client', 'dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof multer.MulterError) return res.status(413).json({ error: 'File is too large (max 5MB)' });
    const status = err.status || 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: status === 500 ? 'Something went wrong' : err.message });
  });
  return app;
}

module.exports = { createApp };
