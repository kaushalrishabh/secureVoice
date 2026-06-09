import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { signOut } from '../../services/auth.service';
import {
  listNotes, fetchNote, createNote, saveNote, deleteNote,
  fetchDecryptedBlocks, addBlock,
  type DecryptedNote, type DecryptedBlock,
} from '../../services/notes.service';
import { apiFetch } from '../../lib/api';
import type { Folder } from '../../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const BLOCK_COLORS = ['#F59E0B', '#06B6D4', '#8B5CF6', '#22C55E', '#F97316', '#EC4899'];

function blockColor(userId: string) {
  const n = userId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return BLOCK_COLORS[n % BLOCK_COLORS.length];
}

function initials(str: string) {
  return (str ?? '').slice(0, 2).toUpperCase();
}

function relDate(d: string) {
  const h = (Date.now() - new Date(d).getTime()) / 3_600_000;
  if (h < 24) return 'Today';
  if (h < 48) return 'Yesterday';
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const FOLDER_COLORS = ['#22C55E', '#F59E0B', '#8B5CF6', '#06B6D4', '#F97316', '#EC4899'];

// ── Component ─────────────────────────────────────────────────────────────────

export default function Notes() {
  const user      = useAuthStore((s) => s.user);
  const clearUser = useAuthStore((s) => s.clearUser);
  const navigate  = useNavigate();

  // Data
  const [notes,   setNotes]   = useState<DecryptedNote[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);

  // Selection + editor
  const [selectedId,   setSelectedId]   = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<DecryptedNote | null>(null);
  const [blocks,       setBlocks]       = useState<DecryptedBlock[]>([]);
  const [noteLoading,  setNoteLoading]  = useState(false);

  // New note creation
  const [isCreating,  setIsCreating]  = useState(false);
  const [newTitle,    setNewTitle]    = useState('');
  const [newContent,  setNewContent]  = useState('');
  const [saving,      setSaving]      = useState(false);

  // New block input (shared notes)
  const [blockText,   setBlockText]   = useState('');
  const [addingBlock, setAddingBlock] = useState(false);

  // Sidebar / filter
  const [search,          setSearch]          = useState('');
  const [activeNav,       setActiveNav]       = useState<'all' | 'shared' | 'pinned'>('all');
  const [activeFolderId,  setActiveFolderId]  = useState<string | null>(null);

  const blockInputRef = useRef<HTMLInputElement>(null);

  // ── Load on mount ───────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const [notesList, foldersRes] = await Promise.all([
          listNotes(),
          apiFetch<{ folders: Folder[] }>('/api/folders'),
        ]);
        setNotes(notesList);
        setFolders(foldersRes.folders);
        if (notesList.length > 0) openNote(notesList[0].id);
      } catch (err) {
        console.error('Load failed:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────────
  async function openNote(id: string) {
    if (id === selectedId) return;
    setSelectedId(id);
    setIsCreating(false);
    setNoteLoading(true);
    setBlocks([]);
    try {
      const note = await fetchNote(id);
      setSelectedNote(note);
      if (note.type === 'shared') {
        const bks = await fetchDecryptedBlocks(id);
        setBlocks(bks);
      }
    } catch (err) {
      console.error('Open note failed:', err);
    } finally {
      setNoteLoading(false);
    }
  }

  async function handleCreateNote() {
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      const note = await createNote({ title: newTitle.trim(), content: newContent });
      setNotes((prev) => [note, ...prev]);
      setIsCreating(false);
      setNewTitle('');
      setNewContent('');
      openNote(note.id);
    } catch (err: any) {
      alert(err.message ?? 'Failed to create note');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddBlock() {
    if (!blockText.trim() || !selectedId) return;
    setAddingBlock(true);
    try {
      const block = await addBlock(selectedId, blockText.trim());
      setBlocks((prev) => [...prev, block]);
      setBlockText('');
    } catch (err: any) {
      alert(err.message ?? 'Failed to add block');
    } finally {
      setAddingBlock(false);
    }
  }

  async function handleDeleteNote(id: string) {
    if (!confirm('Delete this note? This cannot be undone.')) return;
    await deleteNote(id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (selectedId === id) { setSelectedId(null); setSelectedNote(null); }
  }

  function handleSignOut() {
    signOut();
    clearUser();
    navigate('/login');
  }

  // ── Filter notes ────────────────────────────────────────────────────────────
  const filtered = notes.filter((n) => {
    if (activeNav === 'shared' && n.type !== 'shared') return false;
    if (activeNav === 'pinned' && !n.pinned) return false;
    if (activeFolderId && n.folder_id !== activeFolderId) return false;
    if (search) {
      const q = search.toLowerCase();
      return n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
    }
    return true;
  });

  const sortedNotes = [...filtered].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  // ── Style helpers ───────────────────────────────────────────────────────────
  const navItem = (active: boolean) => ({
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '7px 8px', borderRadius: 8, cursor: 'pointer',
    background: active ? 'var(--sv-surface)' : 'transparent',
    marginBottom: 1,
  } as React.CSSProperties);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--sv-bg)' }}>

      {/* ════════════════════════════════════════════════════════════════════
          SIDEBAR
      ════════════════════════════════════════════════════════════════════ */}
      <aside
        className="flex flex-col flex-shrink-0"
        style={{ width: 152, background: 'var(--sv-brand)', borderRight: '0.5px solid var(--sv-border)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-3 py-4" style={{ borderBottom: '0.5px solid var(--sv-border)' }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
               style={{ background: 'var(--sv-accent)' }}>
            <i className="ti ti-microphone" style={{ fontSize: 14, color: 'var(--sv-bg)' }} aria-hidden="true" />
          </div>
          <span className="text-[13px] font-medium" style={{ color: 'var(--sv-text)' }}>SecureVoice</span>
        </div>

        {/* New note */}
        <div className="px-2 py-3">
          <button
            onClick={() => { setIsCreating(true); setSelectedId(null); setSelectedNote(null); setNewTitle(''); setNewContent(''); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-[9px] text-[12px] font-medium transition-opacity hover:opacity-80"
            style={{ background: 'var(--sv-accent)', color: 'var(--sv-bg)' }}
          >
            <i className="ti ti-plus" style={{ fontSize: 14 }} aria-hidden="true" />
            New Note
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 overflow-hidden">
          {([
            { key: 'all',    icon: 'ti-notes',  label: 'All Notes', count: notes.length },
            { key: 'shared', icon: 'ti-users',  label: 'Shared',    count: notes.filter(n => n.type === 'shared').length },
            { key: 'pinned', icon: 'ti-pin',    label: 'Pinned',    count: notes.filter(n => n.pinned).length },
          ] as const).map((item) => (
            <div
              key={item.key}
              style={navItem(activeNav === item.key && !activeFolderId)}
              onClick={() => { setActiveNav(item.key); setActiveFolderId(null); }}
            >
              <i className={`ti ${item.icon}`}
                 style={{ fontSize: 14, color: activeNav === item.key && !activeFolderId ? 'var(--sv-accent)' : 'var(--sv-text-3)' }}
                 aria-hidden="true" />
              <span className="text-[12px] flex-1"
                    style={{ color: activeNav === item.key && !activeFolderId ? 'var(--sv-text)' : 'var(--sv-text-3)' }}>
                {item.label}
              </span>
              {item.count > 0 && (
                <span className="text-[10px]" style={{ color: 'var(--sv-text-3)' }}>{item.count}</span>
              )}
            </div>
          ))}

          {/* Folders */}
          {folders.length > 0 && (
            <div className="mt-4">
              <p className="px-2 mb-2 text-[9px] uppercase tracking-[0.7px] font-medium"
                 style={{ color: 'var(--sv-text-4)' }}>Folders</p>
              {folders.map((f, i) => (
                <div
                  key={f.id}
                  style={navItem(activeFolderId === f.id)}
                  onClick={() => setActiveFolderId(activeFolderId === f.id ? null : f.id)}
                >
                  <div className="w-2 h-2 rounded-full flex-shrink-0"
                       style={{ background: f.color ?? FOLDER_COLORS[i % FOLDER_COLORS.length] }} />
                  <span className="text-[12px] truncate"
                        style={{ color: activeFolderId === f.id ? 'var(--sv-text)' : 'var(--sv-text-3)' }}>
                    {f.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </nav>

        {/* User */}
        <div className="px-3 py-3 flex items-center gap-2 group"
             style={{ borderTop: '0.5px solid var(--sv-border)' }}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
               style={{ background: 'var(--sv-accent)' }}>
            <span className="text-[10px] font-medium" style={{ color: 'var(--sv-bg)' }}>
              {initials((user?.first_name ?? '') + (user?.last_name ?? '') || (user?.username ?? 'U'))}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium truncate" style={{ color: 'var(--sv-text)' }}>
              {user?.first_name} {user?.last_name}
            </p>
            <p className="text-[10px] truncate" style={{ color: 'var(--sv-text-4)' }}>{user?.email}</p>
          </div>
          <button onClick={handleSignOut} title="Sign out"
                  className="opacity-0 group-hover:opacity-100 transition-opacity">
            <i className="ti ti-logout" style={{ fontSize: 13, color: 'var(--sv-text-3)' }} aria-hidden="true" />
          </button>
        </div>
      </aside>

      {/* ════════════════════════════════════════════════════════════════════
          NOTE LIST
      ════════════════════════════════════════════════════════════════════ */}
      <div
        className="flex flex-col flex-shrink-0"
        style={{ width: 200, borderRight: '0.5px solid var(--sv-border)' }}
      >
        {/* Search */}
        <div className="px-3 py-2.5" style={{ borderBottom: '0.5px solid var(--sv-border)' }}>
          <div className="flex items-center gap-2 px-3 py-2 rounded-[8px]"
               style={{ background: 'var(--sv-surface)' }}>
            <i className="ti ti-search" style={{ fontSize: 12, color: 'var(--sv-text-4)' }} aria-hidden="true" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="flex-1 bg-transparent text-[12px] min-w-0"
              style={{ color: 'var(--sv-text)' }}
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-24">
              <i className="ti ti-loader-2 animate-spin" style={{ fontSize: 18, color: 'var(--sv-text-3)' }} aria-hidden="true" />
            </div>
          ) : sortedNotes.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-[12px]" style={{ color: 'var(--sv-text-3)' }}>
                {search ? 'No results' : 'No notes yet'}
              </p>
            </div>
          ) : (
            sortedNotes.map((note) => {
              const isSelected = note.id === selectedId;
              return (
                <div
                  key={note.id}
                  onClick={() => openNote(note.id)}
                  style={{
                    padding: '9px 12px',
                    cursor: 'pointer',
                    background: isSelected ? 'var(--sv-surface)' : 'transparent',
                    borderLeft: isSelected ? '2px solid var(--sv-accent)' : '2px solid transparent',
                    borderBottom: '0.5px solid var(--sv-border)',
                  }}
                >
                  {note.pinned && (
                    <div className="flex items-center gap-1 mb-1">
                      <i className="ti ti-pin" style={{ fontSize: 10, color: 'var(--sv-accent)' }} aria-hidden="true" />
                      <span className="text-[10px]" style={{ color: 'var(--sv-accent)' }}>Pinned</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-medium truncate flex-1 mr-2"
                          style={{ color: 'var(--sv-text)' }}>
                      {note.title || 'Untitled'}
                    </span>
                    <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--sv-text-4)' }}>
                      {relDate(note.updated_at)}
                    </span>
                  </div>
                  <p className="text-[11px] truncate mb-1.5" style={{ color: 'var(--sv-text-3)' }}>
                    {note.content || 'No content'}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {note.type === 'shared' && (
                        <i className="ti ti-users" style={{ fontSize: 10, color: 'var(--sv-text-3)' }} aria-hidden="true" />
                      )}
                      <i className="ti ti-lock" style={{ fontSize: 10, color: 'var(--sv-text-4)' }} aria-hidden="true" />
                    </div>
                    {note.role === 'owner' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteNote(note.id); }}
                        className="opacity-0 hover:opacity-100 transition-opacity"
                      >
                        <i className="ti ti-trash" style={{ fontSize: 11, color: 'var(--sv-danger)' }} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          EDITOR
      ════════════════════════════════════════════════════════════════════ */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Toolbar */}
        {(selectedNote || isCreating) && (
          <div className="flex items-center justify-between px-5 py-2.5 flex-shrink-0"
               style={{ borderBottom: '0.5px solid var(--sv-border)' }}>
            <div className="flex items-center gap-1">
              {selectedNote && (
                <>
                  <button className="p-1.5 rounded-lg hover:opacity-70 transition-opacity">
                    <i className="ti ti-share" style={{ fontSize: 15, color: 'var(--sv-text-3)' }} aria-hidden="true" />
                  </button>
                  <button className="p-1.5 rounded-lg hover:opacity-70 transition-opacity">
                    <i className="ti ti-user-plus" style={{ fontSize: 15, color: 'var(--sv-text-3)' }} aria-hidden="true" />
                  </button>
                  <button className="p-1.5 rounded-lg hover:opacity-70 transition-opacity">
                    <i className="ti ti-dots" style={{ fontSize: 15, color: 'var(--sv-text-3)' }} aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--sv-green)' }} />
              <span className="text-[10px]" style={{ color: 'var(--sv-green)', fontFamily: 'var(--sv-mono)' }}>
                {selectedNote?.type === 'shared' ? 'Encrypted · Shared' : 'Encrypted'}
              </span>
            </div>
            <div style={{ width: 80 }} /> {/* spacer */}
          </div>
        )}

        {/* Editor body */}
        {noteLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <i className="ti ti-loader-2 animate-spin" style={{ fontSize: 24, color: 'var(--sv-text-3)' }} aria-hidden="true" />
          </div>

        ) : isCreating ? (
          /* ── New note form ───────────────────────────────────────────── */
          <div className="flex-1 flex flex-col p-8 overflow-y-auto">
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Note title"
              className="text-[22px] font-medium bg-transparent mb-6 w-full"
              style={{ color: 'var(--sv-text)', caretColor: 'var(--sv-accent)' }}
            />
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Start writing…"
              className="flex-1 bg-transparent text-[14px] leading-relaxed resize-none w-full"
              style={{ color: 'var(--sv-text-2)', caretColor: 'var(--sv-accent)' }}
            />
            <div className="flex gap-3 mt-6 flex-shrink-0">
              <button
                onClick={handleCreateNote}
                disabled={saving || !newTitle.trim()}
                className="px-5 py-2.5 rounded-[9px] text-[13px] font-medium transition-opacity disabled:opacity-50"
                style={{ background: 'var(--sv-accent)', color: 'var(--sv-bg)' }}
              >
                {saving ? 'Encrypting…' : 'Save Note'}
              </button>
              <button
                onClick={() => setIsCreating(false)}
                className="px-5 py-2.5 rounded-[9px] text-[13px] transition-opacity hover:opacity-70"
                style={{ color: 'var(--sv-text-3)', border: '0.5px solid var(--sv-border-2)' }}
              >
                Cancel
              </button>
            </div>
          </div>

        ) : selectedNote ? (
          /* ── Existing note ───────────────────────────────────────────── */
          <>
            <div className="flex-1 overflow-y-auto px-7 py-6">
              {/* Title + meta */}
              <h1 className="text-[22px] font-medium mb-2 leading-tight"
                  style={{ color: 'var(--sv-text)', letterSpacing: '-0.3px' }}>
                {selectedNote.title}
              </h1>
              <div className="flex items-center gap-2 mb-6">
                <span className="text-[11px]" style={{ color: 'var(--sv-text-4)' }}>
                  {relDate(selectedNote.updated_at)}
                </span>
                {selectedNote.folder_id && (
                  <>
                    <span style={{ color: 'var(--sv-text-4)', fontSize: 11 }}>·</span>
                    <span className="text-[11px]" style={{ color: 'var(--sv-text-4)' }}>
                      {folders.find(f => f.id === selectedNote.folder_id)?.name ?? 'Folder'}
                    </span>
                  </>
                )}
                <i className="ti ti-lock" style={{ fontSize: 11, color: 'var(--sv-text-4)' }} aria-hidden="true" />
              </div>

              {/* Note body */}
              {selectedNote.content && (
                <p className="text-[14px] leading-[1.75] mb-6" style={{ color: 'var(--sv-text-2)' }}>
                  {selectedNote.content}
                </p>
              )}

              {/* Contributor blocks (shared notes) */}
              {selectedNote.type === 'shared' && blocks.length > 0 && (
                <div className="space-y-4 mt-4">
                  {blocks.map((block, idx) => {
                    const color    = blockColor(block.author_id);
                    const isMe     = block.author_id === user?.id;
                    const label    = isMe ? 'You' : initials(block.author_id);
                    const isLast   = idx === blocks.length - 1;
                    return (
                      <div key={block.id} className="flex gap-3">
                        {/* Avatar + thread line */}
                        <div className="flex flex-col items-center gap-1 flex-shrink-0">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-medium"
                               style={{ background: color, color: '#0C0C0E', flexShrink: 0 }}>
                            {label}
                          </div>
                          {!isLast && (
                            <div className="w-px flex-1" style={{ background: `${color}25`, minHeight: 12 }} />
                          )}
                        </div>
                        {/* Block content */}
                        <div className="flex-1 min-w-0 pb-1">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[12px] font-medium" style={{ color: 'var(--sv-text)' }}>
                              {isMe ? 'You' : `User ${block.author_id.slice(0, 6)}`}
                            </span>
                            <span className="text-[10px]" style={{ color: 'var(--sv-text-4)' }}>
                              {relDate(block.created_at)}
                            </span>
                          </div>
                          <div className="rounded-[9px] px-3.5 py-2.5"
                               style={{ background: 'var(--sv-surface)', borderLeft: `2px solid ${color}` }}>
                            <p className="text-[13px] leading-relaxed" style={{ color: 'var(--sv-text-2)' }}>
                              {block.text}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Input bar */}
            <div className="flex items-center gap-3 px-5 py-3 flex-shrink-0"
                 style={{ borderTop: '0.5px solid var(--sv-border)', background: 'var(--sv-brand)' }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                   style={{ background: 'var(--sv-accent)' }}>
                <span className="text-[10px] font-medium" style={{ color: 'var(--sv-bg)' }}>
                  {initials((user?.first_name ?? '') + (user?.last_name ?? ''))}
                </span>
              </div>
              <input
                ref={blockInputRef}
                value={blockText}
                onChange={(e) => setBlockText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddBlock(); }}}
                placeholder={selectedNote.type === 'shared' ? 'Add a block… (Enter to send)' : 'Voice input coming in Phase 4…'}
                disabled={selectedNote.type !== 'shared' || addingBlock}
                className="flex-1 bg-transparent text-[13px]"
                style={{ color: 'var(--sv-text)' }}
              />
              <div className="flex items-center gap-2">
                {selectedNote.type === 'shared' && (
                  <button
                    onClick={handleAddBlock}
                    disabled={!blockText.trim() || addingBlock}
                    className="p-1.5 rounded-lg transition-opacity disabled:opacity-40"
                  >
                    <i className="ti ti-send" style={{ fontSize: 15, color: 'var(--sv-accent)' }} aria-hidden="true" />
                  </button>
                )}
                <button className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{ background: 'var(--sv-accent)' }}>
                  <i className="ti ti-microphone" style={{ fontSize: 15, color: 'var(--sv-bg)' }} aria-hidden="true" />
                </button>
              </div>
            </div>
          </>

        ) : (
          /* ── Empty state ──────────────────────────────────────────────── */
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                 style={{ background: 'var(--sv-surface)' }}>
              <i className="ti ti-notes" style={{ fontSize: 28, color: 'var(--sv-text-4)' }} aria-hidden="true" />
            </div>
            <div className="text-center">
              <p className="text-[15px] font-medium mb-1" style={{ color: 'var(--sv-text)' }}>
                {notes.length === 0 ? 'No notes yet' : 'Select a note'}
              </p>
              <p className="text-[13px]" style={{ color: 'var(--sv-text-3)' }}>
                {notes.length === 0
                  ? 'Create your first encrypted note'
                  : 'Choose a note from the list to view it'}
              </p>
            </div>
            {notes.length === 0 && (
              <button
                onClick={() => setIsCreating(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-[9px] text-[13px] font-medium mt-2"
                style={{ background: 'var(--sv-accent)', color: 'var(--sv-bg)' }}
              >
                <i className="ti ti-plus" style={{ fontSize: 14 }} aria-hidden="true" />
                Create your first note
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}