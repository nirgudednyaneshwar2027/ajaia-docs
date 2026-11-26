'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { openStore } = require('../src/store');
const { importFile } = require('../src/importer');

const setup = () => {
  const s = openStore(':memory:');
  const [alice, bob, carol] = s.listUsers();
  return { s, alice, bob, carol };
};

test('create, rename, edit and reopen a document keeps formatting', () => {
  const { s, alice } = setup();
  const d = s.createDocument(alice.id, { title: 'Plan' });
  s.updateDocument(d.id, alice.id, { title: 'Plan v2', content: '<h1>Hi</h1><p><strong>bold</strong></p><ul><li>a</li></ul>' });
  const again = s.getDocument(d.id, alice.id);
  assert.equal(again.title, 'Plan v2');
  assert.equal(again.content, '<h1>Hi</h1><p><strong>bold</strong></p><ul><li>a</li></ul>');
});

test('sharing: owner vs shared listing, and editor can edit', () => {
  const { s, alice, bob } = setup();
  const d = s.createDocument(alice.id, { title: 'Shared' });
  assert.equal(s.listDocuments(bob.id).shared.length, 0);
  s.share(d.id, alice.id, { email: bob.email, role: 'editor' });
  const list = s.listDocuments(bob.id);
  assert.equal(list.owned.length, 0);
  assert.equal(list.shared[0].role, 'editor');
  assert.equal(list.shared[0].owner_name, alice.name);
  s.updateDocument(d.id, bob.id, { content: '<p>from bob</p>' });
  assert.equal(s.getDocument(d.id, alice.id).content, '<p>from bob</p>');
});

test('viewer cannot edit; non-collaborator cannot see; only owner shares/deletes', () => {
  const { s, alice, bob, carol } = setup();
  const d = s.createDocument(alice.id, { title: 'Secret' });
  s.share(d.id, alice.id, { email: bob.email, role: 'viewer' });
  assert.throws(() => s.updateDocument(d.id, bob.id, { content: 'x' }), { status: 403 });
  assert.throws(() => s.getDocument(d.id, carol.id), { status: 404 });
  assert.throws(() => s.share(d.id, bob.id, { email: carol.email }), { status: 403 });
  assert.throws(() => s.deleteDocument(d.id, bob.id), { status: 403 });
  s.unshare(d.id, alice.id, bob.id);
  assert.throws(() => s.getDocument(d.id, bob.id), { status: 404 });
});

test('validation: empty title, unknown share target, bad role', () => {
  const { s, alice } = setup();
  assert.throws(() => s.createDocument(alice.id, { title: '   ' }), { status: 400 });
  const d = s.createDocument(alice.id, {});
  assert.throws(() => s.share(d.id, alice.id, { email: 'nobody@x.com' }), { status: 404 });
  assert.throws(() => s.share(d.id, alice.id, { email: 'bob@example.com', role: 'admin' }), { status: 400 });
});

test('import: txt becomes paragraphs and escapes HTML; unsupported type rejected', async () => {
  const f = (name, text) => ({ originalname: name, buffer: Buffer.from(text) });
  const r = await importFile(f('notes.txt', 'one\ntwo\n\n<script>x</script>'));
  assert.equal(r.title, 'notes');
  assert.equal(r.html, '<p>one<br>two</p><p>&lt;script&gt;x&lt;/script&gt;</p>');
  const md = await importFile(f('a.md', '# T'), { marked: { parse: (t) => `<h1>${t.slice(2)}</h1>` } });
  assert.equal(md.html, '<h1>T</h1>');
  await assert.rejects(importFile(f('a.exe', 'x')), { status: 415 });
});
