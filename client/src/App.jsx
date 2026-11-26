import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api, getToken, setToken } from './api.js';
import Editor from './Editor.jsx';

function Login({ onLogin }) {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => { api.users().then(setUsers).catch((e) => setError(e.message)); }, []);
  const go = async (email) => {
    try { const r = await api.login(email); setToken(r.token); onLogin(r.user); } catch (e) { setError(e.message); }
  };
  return (
    <div className="login">
      <h1>Ajaia Docs</h1>
      <p>Demo sign-in. Pick a seeded user (try two browsers/windows to see sharing).</p>
      {users.map((u) => <button key={u.id} className="user" onClick={() => go(u.email)}>{u.name}<small>{u.email}</small></button>)}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

function DocRow({ d, onOpen, onDelete }) {
  return (
    <li onClick={() => onOpen(d.id)}>
      <span className="doc-title">{d.title}</span>
      <span className="muted">{d.role === 'owner' ? 'Owned by you' : `Shared by ${d.owner_name} · ${d.role === 'editor' ? 'can edit' : 'view only'}`}</span>
      <span className="muted">{new Date(d.updated_at).toLocaleString()}</span>
      {d.role === 'owner' && <button onClick={(e) => { e.stopPropagation(); onDelete(d); }}>Delete</button>}
    </li>
  );
}

function Home({ user, onOpen, onLogout }) {
  const [docs, setDocs] = useState({ owned: [], shared: [] });
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const load = useCallback(() => api.list().then(setDocs).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const create = async () => { try { onOpen((await api.create('Untitled document')).id); } catch (e) { setError(e.message); } };
  const upload = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    try { onOpen((await api.importFile(file)).id); } catch (err) { setError(err.message); }
  };
  const remove = async (d) => {
    if (!window.confirm(`Delete "${d.title}"? This cannot be undone.`)) return;
    try { await api.remove(d.id); load(); } catch (e) { setError(e.message); }
  };

  return (
    <div className="page">
      <header className="top">
        <h1>Ajaia Docs</h1>
        <span>{user.name} <button onClick={onLogout}>Sign out</button></span>
      </header>
      <div className="actions">
        <button className="primary" onClick={create}>+ New document</button>
        <button onClick={() => fileRef.current.click()}>Upload file</button>
        <small className="muted">Supported uploads: .txt, .md, .docx (max 5MB). Creates a new editable document.</small>
        <input ref={fileRef} type="file" accept=".txt,.md,.docx" hidden onChange={upload} />
      </div>
      {error && <p className="error">{error}</p>}
      <h2>My documents</h2>
      <ul className="doclist">
        {docs.owned.length === 0 && <li className="muted empty">No documents yet. Create one or upload a file.</li>}
        {docs.owned.map((d) => <DocRow key={d.id} d={d} onOpen={onOpen} onDelete={remove} />)}
      </ul>
      <h2>Shared with me</h2>
      <ul className="doclist">
        {docs.shared.length === 0 && <li className="muted empty">Nothing has been shared with you.</li>}
        {docs.shared.map((d) => <DocRow key={d.id} d={d} onOpen={onOpen} onDelete={remove} />)}
      </ul>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!getToken()) { setReady(true); return; }
    api.me().then(setUser).catch(() => setToken(null)).finally(() => setReady(true));
  }, []);

  const logout = () => { setToken(null); setUser(null); setOpenId(null); };
  if (!ready) return null;
  if (!user) return <Login onLogin={setUser} />;
  if (openId) return <Editor key={openId} id={openId} onBack={() => { setOpenId(null); setTick((t) => t + 1); }} onChanged={() => {}} />;
  return <Home key={tick} user={user} onOpen={setOpenId} onLogout={logout} />;
}
