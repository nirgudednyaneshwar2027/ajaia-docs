import React, { useEffect, useRef, useState, useCallback } from 'react';
import { api } from './api.js';
import ShareDialog from './ShareDialog.jsx';

// contenteditable + execCommand: deprecated but universally supported and dependency-free.
// Swapping in Tiptap/ProseMirror is the first thing to do for collaboration (see ARCHITECTURE.md).
const BUTTONS = [
  { cmd: 'bold', label: <b>B</b>, title: 'Bold (Ctrl+B)' },
  { cmd: 'italic', label: <i>I</i>, title: 'Italic (Ctrl+I)' },
  { cmd: 'underline', label: <u>U</u>, title: 'Underline (Ctrl+U)' },
  { cmd: 'insertUnorderedList', label: '• List', title: 'Bulleted list' },
  { cmd: 'insertOrderedList', label: '1. List', title: 'Numbered list' },
];

export default function Editor({ id, onBack, onChanged }) {
  const [doc, setDoc] = useState(null);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('saved'); // saved | saving | error
  const [error, setError] = useState('');
  const [showShare, setShowShare] = useState(false);
  const bodyRef = useRef(null);
  const timer = useRef(null);

  useEffect(() => {
    let live = true;
    api.get(id).then((d) => {
      if (!live) return;
      setDoc(d);
      setTitle(d.title);
    }).catch((e) => setError(e.message));
    return () => { live = false; clearTimeout(timer.current); };
  }, [id]);

  useEffect(() => {
    if (doc && bodyRef.current) bodyRef.current.innerHTML = doc.content;
  }, [doc && doc.id]); // set once per document; afterwards the DOM is the source of truth

  const save = useCallback(async (patch) => {
    setStatus('saving');
    try {
      await api.update(id, patch);
      setStatus('saved');
      setError('');
      onChanged();
    } catch (e) {
      setStatus('error');
      setError(e.message);
    }
  }, [id, onChanged]);

  const queueSave = (patch) => {
    setStatus('saving');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => save(patch), 700);
  };

  const exec = (cmd, value) => {
    bodyRef.current.focus();
    document.execCommand(cmd, false, value);
    queueSave({ content: bodyRef.current.innerHTML });
  };

  const commitTitle = () => {
    const t = title.trim();
    if (!t) { setTitle(doc.title); setError('Title cannot be empty'); return; }
    if (t !== doc.title) { setDoc({ ...doc, title: t }); save({ title: t }); }
  };

  if (error && !doc) return <div className="page"><button onClick={onBack}>← Back</button><p className="error">{error}</p></div>;
  if (!doc) return <div className="page">Loading…</div>;
  const canEdit = doc.canEdit;

  return (
    <div className="editor-shell">
      <header className="editor-head">
        <button onClick={onBack}>← Documents</button>
        <input
          className="title-input" value={title} disabled={!canEdit} maxLength={200} aria-label="Document title"
          onChange={(e) => setTitle(e.target.value)} onBlur={commitTitle}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
        <span className={`status ${status}`}>{status === 'saving' ? 'Saving…' : status === 'error' ? 'Not saved' : 'Saved'}</span>
        <span className="badge">{doc.role === 'owner' ? 'Owner' : doc.role === 'editor' ? `Shared by ${doc.owner_name} · can edit` : `Shared by ${doc.owner_name} · view only`}</span>
        {doc.role === 'owner' && <button className="primary" onClick={() => setShowShare(true)}>Share</button>}
      </header>

      {canEdit && (
        <div className="toolbar" role="toolbar" aria-label="Formatting">
          <select aria-label="Text style" defaultValue="p" onChange={(e) => { exec('formatBlock', e.target.value); e.target.value = 'p'; }}>
            <option value="p">Normal text</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
          </select>
          {BUTTONS.map((b) => (
            <button key={b.cmd} title={b.title} onMouseDown={(e) => { e.preventDefault(); exec(b.cmd); }}>{b.label}</button>
          ))}
        </div>
      )}
      {!canEdit && <div className="notice">You have view-only access to this document.</div>}
      {error && <div className="error banner">{error}</div>}

      <div className="paper-wrap">
        <div
          ref={bodyRef} className="paper" contentEditable={canEdit} suppressContentEditableWarning
          aria-label="Document body" spellCheck
          onInput={() => queueSave({ content: bodyRef.current.innerHTML })}
        />
      </div>
      {showShare && <ShareDialog id={id} onClose={() => setShowShare(false)} />}
    </div>
  );
}
