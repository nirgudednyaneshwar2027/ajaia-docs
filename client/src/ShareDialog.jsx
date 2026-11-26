import React, { useEffect, useState } from 'react';
import { api } from './api.js';

export default function ShareDialog({ id, onClose }) {
  const [shares, setShares] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('editor');
  const [error, setError] = useState('');

  useEffect(() => { api.shares(id).then(setShares).catch((e) => setError(e.message)); }, [id]);

  const add = async (e) => {
    e.preventDefault();
    setError('');
    try { setShares(await api.share(id, email, role)); setEmail(''); } catch (err) { setError(err.message); }
  };
  const remove = async (userId) => {
    try { setShares(await api.unshare(id, userId)); } catch (err) { setError(err.message); }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" role="dialog" aria-label="Share document" onClick={(e) => e.stopPropagation()}>
        <h2>Share document</h2>
        <form onSubmit={add} className="row">
          <input type="email" required placeholder="Email, e.g. bob@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Permission">
            <option value="editor">Can edit</option>
            <option value="viewer">Can view</option>
          </select>
          <button className="primary">Share</button>
        </form>
        <p className="hint">Demo users: alice@, bob@, carol@example.com</p>
        {error && <p className="error">{error}</p>}
        <ul className="shares">
          {shares.length === 0 && <li className="muted">Not shared with anyone yet.</li>}
          {shares.map((s) => (
            <li key={s.user_id}>
              <span>{s.name} <span className="muted">({s.email})</span></span>
              <span>{s.role === 'editor' ? 'Can edit' : 'Can view'} <button onClick={() => remove(s.user_id)}>Remove</button></span>
            </li>
          ))}
        </ul>
        <button onClick={onClose}>Done</button>
      </div>
    </div>
  );
}
