'use strict';
// Persistence + access logic. Framework-free so it can be unit tested without HTTP.
const { DatabaseSync } = require('node:sqlite');
const crypto = require('node:crypto');

const ROLES = ['viewer', 'editor'];
const MAX_TITLE = 200;
const MAX_CONTENT = 2_000_000; // ~2MB of HTML

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const SEED_USERS = [
  { email: 'alice@example.com', name: 'Alice Owner' },
  { email: 'bob@example.com', name: 'Bob Collaborator' },
  { email: 'carol@example.com', name: 'Carol Reviewer' },
];

function openStore(file = ':memory:', { sanitize = (h) => h } = {}) {
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY, owner_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL, content TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS shares (
      document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      role TEXT NOT NULL CHECK (role IN ('viewer','editor')),
      PRIMARY KEY (document_id, user_id));
  `);

  const insUser = db.prepare('INSERT OR IGNORE INTO users (email, name) VALUES (?, ?)');
  for (const u of SEED_USERS) insUser.run(u.email, u.name);

  const now = () => new Date().toISOString();

  function validateTitle(title) {
    if (typeof title !== 'string' || !title.trim()) throw new HttpError(400, 'Title is required');
    if (title.trim().length > MAX_TITLE) throw new HttpError(400, `Title must be at most ${MAX_TITLE} characters`);
    return title.trim();
  }

  function validateContent(content) {
    if (typeof content !== 'string') throw new HttpError(400, 'Content must be a string');
    if (content.length > MAX_CONTENT) throw new HttpError(413, 'Document is too large');
    return sanitize(content);
  }

  const api = {
    db,
    HttpError,

    listUsers: () => db.prepare('SELECT id, email, name FROM users ORDER BY id').all(),

    login(email) {
      const user = db.prepare('SELECT id, email, name FROM users WHERE email = ?').get(String(email || '').toLowerCase().trim());
      if (!user) throw new HttpError(401, 'Unknown user');
      const token = crypto.randomBytes(24).toString('hex');
      db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id);
      return { token, user };
    },

    userForToken(token) {
      if (!token) return null;
      return db.prepare('SELECT u.id, u.email, u.name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?').get(token) || null;
    },

    /** Returns 'owner' | 'editor' | 'viewer' | null */
    roleFor(documentId, userId) {
      const doc = db.prepare('SELECT owner_id FROM documents WHERE id = ?').get(documentId);
      if (!doc) return null;
      if (doc.owner_id === userId) return 'owner';
      const s = db.prepare('SELECT role FROM shares WHERE document_id = ? AND user_id = ?').get(documentId, userId);
      return s ? s.role : null;
    },

    createDocument(userId, { title = 'Untitled document', content = '' } = {}) {
      const t = validateTitle(title);
      const c = validateContent(content);
      const ts = now();
      const r = db.prepare('INSERT INTO documents (owner_id, title, content, created_at, updated_at) VALUES (?,?,?,?,?)')
        .run(userId, t, c, ts, ts);
      return api.getDocument(Number(r.lastInsertRowid), userId);
    },

    listDocuments(userId) {
      const rows = db.prepare(`
        SELECT d.id, d.title, d.updated_at, d.owner_id, o.name AS owner_name,
               CASE WHEN d.owner_id = @u THEN 'owner' ELSE s.role END AS role
        FROM documents d
        JOIN users o ON o.id = d.owner_id
        LEFT JOIN shares s ON s.document_id = d.id AND s.user_id = @u
        WHERE d.owner_id = @u OR s.user_id = @u
        ORDER BY d.updated_at DESC`).all({ u: userId });
      return { owned: rows.filter((r) => r.role === 'owner'), shared: rows.filter((r) => r.role !== 'owner') };
    },

    getDocument(documentId, userId) {
      const role = api.roleFor(documentId, userId);
      // 404 (not 403) so non-collaborators cannot probe for document ids.
      if (!role) throw new HttpError(404, 'Document not found');
      const d = db.prepare(`SELECT d.id, d.title, d.content, d.created_at, d.updated_at, o.name AS owner_name, o.email AS owner_email
        FROM documents d JOIN users o ON o.id = d.owner_id WHERE d.id = ?`).get(documentId);
      return { ...d, role, canEdit: role !== 'viewer' };
    },

    updateDocument(documentId, userId, { title, content }) {
      const role = api.roleFor(documentId, userId);
      if (!role) throw new HttpError(404, 'Document not found');
      if (role === 'viewer') throw new HttpError(403, 'You have view-only access to this document');
      const sets = [];
      const vals = [];
      if (title !== undefined) { sets.push('title = ?'); vals.push(validateTitle(title)); }
      if (content !== undefined) { sets.push('content = ?'); vals.push(validateContent(content)); }
      if (!sets.length) throw new HttpError(400, 'Nothing to update');
      sets.push('updated_at = ?'); vals.push(now());
      db.prepare(`UPDATE documents SET ${sets.join(', ')} WHERE id = ?`).run(...vals, documentId);
      return api.getDocument(documentId, userId);
    },

    deleteDocument(documentId, userId) {
      const role = api.roleFor(documentId, userId);
      if (!role) throw new HttpError(404, 'Document not found');
      if (role !== 'owner') throw new HttpError(403, 'Only the owner can delete a document');
      db.prepare('DELETE FROM documents WHERE id = ?').run(documentId);
    },

    listShares(documentId, userId) {
      if (api.roleFor(documentId, userId) !== 'owner') throw new HttpError(403, 'Only the owner can manage sharing');
      return db.prepare('SELECT u.id AS user_id, u.email, u.name, s.role FROM shares s JOIN users u ON u.id = s.user_id WHERE s.document_id = ? ORDER BY u.name').all(documentId);
    },

    share(documentId, userId, { email, role = 'editor' }) {
      if (api.roleFor(documentId, userId) !== 'owner') throw new HttpError(403, 'Only the owner can manage sharing');
      if (!ROLES.includes(role)) throw new HttpError(400, 'Role must be viewer or editor');
      const target = db.prepare('SELECT id FROM users WHERE email = ?').get(String(email || '').toLowerCase().trim());
      if (!target) throw new HttpError(404, 'No user with that email');
      if (target.id === userId) throw new HttpError(400, 'You already own this document');
      db.prepare(`INSERT INTO shares (document_id, user_id, role) VALUES (?,?,?)
        ON CONFLICT(document_id, user_id) DO UPDATE SET role = excluded.role`).run(documentId, target.id, role);
      return api.listShares(documentId, userId);
    },

    unshare(documentId, userId, targetUserId) {
      if (api.roleFor(documentId, userId) !== 'owner') throw new HttpError(403, 'Only the owner can manage sharing');
      db.prepare('DELETE FROM shares WHERE document_id = ? AND user_id = ?').run(documentId, targetUserId);
      return api.listShares(documentId, userId);
    },
  };
  return api;
}

module.exports = { openStore, HttpError, SEED_USERS };
