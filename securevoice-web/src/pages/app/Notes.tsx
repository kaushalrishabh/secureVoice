import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { signOut } from '../../services/auth.service';
import {
  listNotes, fetchNote, createNote, saveNote, deleteNote,
  fetchDecryptedBlocks, addBlock, getCachedNoteDEK,
  type DecryptedNote, type DecryptedBlock,
} from '../../services/notes.service';
import { shareNote } from '../../services/invites.service';
import { apiFetch } from '../../lib/api';
import type { Folder } from '../../types';
import { getSession, tryRestoreSession } from '../../lib/session';

// ── Sub-components ────────────────────────────────────────────────────────────
import Sidebar    from '../../components/layout/Sidebar.tsx';
import NotesList  from '../../components/notes/NotesList.tsx';
import Navbar     from '../../components/layout/Navbar.tsx';
import NoteEditor from '../../components/notes/NoteEditor.tsx';
import NoteFooter from '../../components/notes/NoteFooter.tsx';
import Modal      from '../../components/ui/Modal.tsx';
import FloatingInput from '../../components/ui/FloatingInput';
import PendingInvitesBanner from '../../components/notes/PendingInvitesBanner.tsx';

type NavKey = 'all' | 'shared' | 'pinned';

export default function Notes() {
  const user      = useAuthStore((s) => s.user);
  const clearUser = useAuthStore((s) => s.clearUser);
  const navigate  = useNavigate();

  // ── Data ──────────────────────────────────────────────────────────────────
  const [notes,   setNotes]   = useState<DecryptedNote[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Selection ─────────────────────────────────────────────────────────────
  const [selectedId,   setSelectedId]   = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<DecryptedNote | null>(null);
  const [blocks,       setBlocks]       = useState<DecryptedBlock[]>([]);
  const [noteLoading,  setNoteLoading]  = useState(false);

  // ── Editing ───────────────────────────────────────────────────────────────
  const [editTitle,   setEditTitle]   = useState('');
  const [editContent, setEditContent] = useState('');
  const [hasChanges,  setHasChanges]  = useState(false);
  const [saving,      setSaving]      = useState(false);

  // ── New note ──────────────────────────────────────────────────────────────
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle,   setNewTitle]   = useState('');
  const [newContent, setNewContent] = useState('');
  const [creating,   setCreating]   = useState(false);

  // ── Modals ─────────────────────────────────────────────────────────────────
  const [showShare,   setShowShare]   = useState(false);
  const [shareEmail,  setShareEmail]  = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);

  const [showDelete,  setShowDelete]  = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DecryptedNote | null>(null);
  const [deleting,    setDeleting]    = useState(false);

  // ── Block input ───────────────────────────────────────────────────────────
  const [blockText,   setBlockText]   = useState('');
  const [addingBlock, setAddingBlock] = useState(false);

  // ── Sidebar filter ────────────────────────────────────────────────────────
  const [search,         setSearch]         = useState('');
  const [activeNav,      setActiveNav]      = useState<NavKey>('all');
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  async function handleInviteAccepted(noteId: string) {
    // Refresh the notes list so the newly shared note appears
    try {
      const notesList = await listNotes();
      setNotes(notesList);
      openNote(noteId);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to refresh notes');
    }
  }

  // ── Sync edit state when note changes ────────────────────────────────────
  useEffect(() => {
    if (selectedNote) {
      setEditTitle(selectedNote.title);
      setEditContent(selectedNote.content);
      setHasChanges(false);
    }
  }, [selectedNote?.id]);

  // ── Load on mount ─────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const { userDEK } = getSession();

      if (!userDEK) {
        const recovered = user?.private_key_enc
          ? await tryRestoreSession(user.private_key_enc)
          : false;

        if (!recovered) {
          toast.error('Session expired. Please sign in again.');
          signOut();
          clearUser();
          navigate('/login');
          return;
        }
      }
      // Session valid — load data directly here
      try {
        const [notesList, { folders: fl }] = await Promise.all([
          listNotes(),
          apiFetch<{ folders: Folder[] }>('/api/folders'),
        ]);
        setNotes(notesList);
        setFolders(fl);
        if (notesList.length > 0) openNote(notesList[0].id);
      } catch (err: any) {
        toast.error(err.message ?? 'Failed to load notes');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function openNote(id: string) {
    if (id === selectedId) return;
    if (hasChanges && selectedId) {
      await handleSaveNote().catch(() => {});
    }
    setSelectedId(id);
    setIsCreating(false);
    setNoteLoading(true);
    setBlocks([]);
    setHasChanges(false);
    try {
      const note = await fetchNote(id);
      setSelectedNote(note);
      if (note.type === 'shared') {
        setBlocks(await fetchDecryptedBlocks(id));
      }
      else {
        setBlocks([]);
      }
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to open note');
    } finally {
      setNoteLoading(false);
    }
  }

  async function handleSaveNote() {
    if (!selectedId || !hasChanges) return;
    setSaving(true);
    try {
      await saveNote(selectedId, { title: editTitle, content: editContent });
      const now = new Date().toISOString();
      setSelectedNote((p) => p ? { ...p, title: editTitle, content: editContent, updated_at: now } : null);
      setNotes((p) => p.map((n) => n.id === selectedId ? { ...n, title: editTitle, content: editContent, updated_at: now } : n));
      setHasChanges(false);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save note');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateNote() {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const note = await createNote({ title: newTitle.trim(), content: newContent });
      setNotes((p) => [note, ...p]);
      setIsCreating(false);
      setNewTitle('');
      setNewContent('');
      toast.success('Note created');
      openNote(note.id);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to create note');
    } finally {
      setCreating(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteNote(deleteTarget.id);
      setNotes((p) => p.filter((n) => n.id !== deleteTarget.id));
      if (selectedId === deleteTarget.id) { setSelectedId(null); setSelectedNote(null); }
      toast.success('Note deleted');
      setShowDelete(false);
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to delete note');
    } finally {
      setDeleting(false);
    }
  }

  async function handleShare() {
    if (!selectedId || !shareEmail.trim()) return;
    const noteDEK = getCachedNoteDEK(selectedId);
    if (!noteDEK) { toast.error('Note key not loaded — reopen the note and try again'); return; }
    setShareLoading(true);
    try {
      await shareNote(selectedId, shareEmail.trim(), noteDEK);
      setShareSuccess(true);
      toast.success('Invite sent!');
      setShareEmail('');
      setTimeout(() => { setShowShare(false); setShareSuccess(false); }, 1800);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to send invite');
    } finally {
      setShareLoading(false);
    }
  }

  async function handleAddBlock() {
    if (!blockText.trim() || !selectedId) return;
    setAddingBlock(true);
    try {
      const block = await addBlock(selectedId, blockText.trim());
      setBlocks((p) => [...p, block]);
      setBlockText('');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to add block');
    } finally {
      setAddingBlock(false);
    }
  }

  function handleSignOut() {
    signOut();
    clearUser();
    navigate('/login');
  }

  // ── Filter + sort ─────────────────────────────────────────────────────────
  const sortedNotes = [...notes]
    .filter((n) => {
      if (activeNav === 'shared' && n.type !== 'shared') return false;
      if (activeNav === 'pinned' && !n.pinned) return false;
      if (activeFolderId && n.folder_id !== activeFolderId) return false;
      if (search) {
        const q = search.toLowerCase();
        return n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      const ap = a?.pinned ?? false;
      const bp = b?.pinned ?? false;
      if (ap && !bp) return -1;
      if (!ap && bp) return 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--sv-bg)' }}>

      {/* Banner spans full width, sits above the three-panel layout */}
      <PendingInvitesBanner onAccepted={handleInviteAccepted} />

      {/* Three-panel row — Sidebar / NotesList / Editor all live inside this flex row */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <Sidebar
          user={user}
          notes={notes}
          folders={folders}
          activeNav={activeNav}
          activeFolderId={activeFolderId}
          onNavChange={(nav) => { setActiveNav(nav); setActiveFolderId(null); }}
          onFolderChange={setActiveFolderId}
          onNewNote={() => { setIsCreating(true); setSelectedId(null); setSelectedNote(null); setNewTitle(''); setNewContent(''); }}
          onSignOut={handleSignOut}
        />

        {/* Notes list */}
        <NotesList
          notes={sortedNotes}
          loading={loading}
          selectedId={selectedId}
          search={search}
          onSearch={setSearch}
          onSelect={openNote}
          onShare={(note) => {
            setSelectedId(note.id);
            setShowShare(true);
            setShareSuccess(false);
            setShareEmail('');
          }}
          onDelete={(note) => {
            setDeleteTarget(note);
            setShowDelete(true);
          }}
        />

        {/* Editor panel */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

          <Navbar
            note={selectedNote}
            isCreating={isCreating}
            hasChanges={hasChanges}
            saving={saving}
            onShare={() => { setShowShare(true); setShareSuccess(false); setShareEmail(''); }}
            onDelete={() => { if (selectedNote) { setDeleteTarget(selectedNote); setShowDelete(true); } }}
            onSave={handleSaveNote}
          />

          {/* Body */}
          {noteLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <i className="ti ti-loader-2 animate-spin" style={{ fontSize: 26, color: 'var(--sv-text-3)' }} aria-hidden="true" />
            </div>

          ) : isCreating ? (
            <div className="flex-1 flex flex-col px-8 py-7 overflow-y-auto">
              <input
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Note title"
                className="w-full bg-transparent text-[24px] font-medium mb-4 leading-tight"
                style={{ color: 'var(--sv-text)', caretColor: 'var(--sv-accent)', border: 'none', outline: 'none' }}
              />
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Start writing…"
                className="flex-1 bg-transparent text-[15px] leading-relaxed resize-none w-full"
                style={{ color: 'var(--sv-text-2)', caretColor: 'var(--sv-accent)', border: 'none', outline: 'none' }}
              />
              <div className="flex gap-3 mt-6 flex-shrink-0">
                <button
                  onClick={handleCreateNote}
                  disabled={creating || !newTitle.trim()}
                  className="px-5 py-2.5 rounded-[10px] text-[14px] font-medium transition-opacity disabled:opacity-50"
                  style={{ background: 'var(--sv-accent)', color: 'var(--sv-bg)' }}
                >
                  {creating ? 'Encrypting…' : 'Save Note'}
                </button>
                <button
                  onClick={() => setIsCreating(false)}
                  className="px-5 py-2.5 rounded-[10px] text-[14px] hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--sv-text-3)', border: '0.5px solid var(--sv-border-2)' }}
                >
                  Cancel
                </button>
              </div>
            </div>

          ) : selectedNote ? (
            <>
              <NoteEditor
                note={selectedNote}
                blocks={blocks}
                editTitle={editTitle}
                editContent={editContent}
                folders={folders}
                userId={user?.id ?? ''}
                isOwner={selectedNote.role === 'owner'}
                onTitleChange={(v) => { setEditTitle(v); setHasChanges(true); }}
                onContentChange={(v) => { setEditContent(v); setHasChanges(true); }}
                onSave={handleSaveNote}
                onAddBlock={async (text) => {
                  const block = await addBlock(selectedNote.id, text);
                  setBlocks((p) => [...p, block]);
                }}
              />

              {/* Only show footer for private notes — mic button for Phase 4 */}
              {selectedNote.type !== 'shared' && (
                <NoteFooter
                  note={selectedNote}
                  user={user}
                  blockText={blockText}
                  addingBlock={addingBlock}
                  onBlockTextChange={setBlockText}
                  onAddBlock={handleAddBlock}
                />
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-5">
              <div className="w-18 h-18 rounded-2xl flex items-center justify-center"
                   style={{ background: 'var(--sv-surface)', width: 72, height: 72 }}>
                <i className="ti ti-notes" style={{ fontSize: 32, color: 'var(--sv-text-4)' }} aria-hidden="true" />
              </div>
              <div className="text-center">
                <p className="text-[16px] font-medium mb-1.5" style={{ color: 'var(--sv-text)' }}>
                  {notes.length === 0 ? 'No notes yet' : 'Select a note'}
                </p>
                <p className="text-[14px]" style={{ color: 'var(--sv-text-3)' }}>
                  {notes.length === 0 ? 'Create your first encrypted note' : 'Choose a note from the list'}
                </p>
              </div>
              {notes.length === 0 && (
                <button
                  onClick={() => setIsCreating(true)}
                  className="flex items-center gap-2 px-5 py-3 rounded-[10px] text-[14px] font-medium mt-1"
                  style={{ background: 'var(--sv-accent)', color: 'var(--sv-bg)' }}
                >
                  <i className="ti ti-plus" style={{ fontSize: 16 }} aria-hidden="true" />
                  Create your first note
                </button>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ── Share Modal ──────────────────────────────────────────────────── */}
      <Modal
        isOpen={showShare}
        onClose={() => { setShowShare(false); setShareEmail(''); setShareSuccess(false); }}
        title="Share Note"
        description="Invite someone to collaborate on this note"
      >
        {shareSuccess ? (
          <div className="text-center py-5">
            <i className="ti ti-circle-check" style={{ fontSize: 36, color: 'var(--sv-green)', display: 'block', marginBottom: 10 }} aria-hidden="true" />
            <p className="text-[15px]" style={{ color: 'var(--sv-text)' }}>Invite sent!</p>
          </div>
        ) : (
          <>
            <div className="mb-5">
              <FloatingInput
                label="Email address"
                type="email"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <p className="text-[12px] mb-5" style={{ color: 'var(--sv-text-4)' }}>
              The note key is encrypted with their public key — only they can decrypt it.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleShare}
                disabled={shareLoading || !shareEmail.trim()}
                className="flex-1 py-2.5 rounded-[10px] text-[14px] font-medium
                           flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
                style={{ background: 'var(--sv-accent)', color: 'var(--sv-bg)' }}
              >
                {shareLoading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Encrypting…
                  </>
                ) : 'Send Invite'}
              </button>
              <button
                onClick={() => { setShowShare(false); setShareEmail(''); }}
                className="px-4 py-2.5 rounded-[10px] text-[14px] hover:opacity-70 transition-opacity"
                style={{ color: 'var(--sv-text-3)', border: '0.5px solid var(--sv-border-2)' }}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* ── Delete Confirmation Modal ────────────────────────────────────── */}
      <Modal
        isOpen={showDelete}
        onClose={() => { setShowDelete(false); setDeleteTarget(null); }}
        title="Delete Note"
        description={`"${deleteTarget?.title || 'Untitled'}" will be permanently deleted.`}
      >
        <div className="flex gap-3">
          <button
            onClick={handleConfirmDelete}
            disabled={deleting}
            className="flex-1 py-2.5 rounded-[10px] text-[14px] font-medium transition-opacity disabled:opacity-50"
            style={{ background: 'var(--sv-danger)', color: '#fff' }}
          >
            {deleting ? 'Deleting…' : 'Delete Note'}
          </button>
          <button
            onClick={() => { setShowDelete(false); setDeleteTarget(null); }}
            className="px-4 py-2.5 rounded-[10px] text-[14px] hover:opacity-70 transition-opacity"
            style={{ color: 'var(--sv-text-3)', border: '0.5px solid var(--sv-border-2)' }}
          >
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
}