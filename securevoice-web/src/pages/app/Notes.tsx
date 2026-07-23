import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { flushSync } from 'react-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { signOut } from '../../services/auth.service';
import {
  listNotes, fetchNote, createNote, saveNote, deleteNote,
  fetchDecryptedBlocks, addBlock, getCachedNoteDEK,
  pinNote, moveNoteToFolder,
  type DecryptedNote, type DecryptedBlock,
} from '../../services/notes.service';
import { shareNote } from '../../services/invites.service';
import { apiFetch } from '../../lib/api';
import type { Folder } from '../../types';
import { getSession, tryRestoreSession } from '../../lib/session';
import { connectSocket, disconnectSocket, getSocket } from '../../lib/socket';
import { decrypt, decryptNote } from '../../lib/crypto';

// ── Sub-components ────────────────────────────────────────────────────────────
import Sidebar    from '../../components/layout/Sidebar.tsx';
import NotesList  from '../../components/notes/NotesList.tsx';
import Navbar     from '../../components/layout/Navbar.tsx';
import NoteEditor from '../../components/notes/NoteEditor.tsx';
import NoteFooter from '../../components/notes/NoteFooter';
import Modal      from '../../components/ui/Modal.tsx';
import FloatingInput from '../../components/ui/FloatingInput';
import PendingInvitesBanner from '../../components/notes/PendingInvitesBanner.tsx';
import ActivityPanel from '../../components/notes/ActivityPanel.tsx';
import { fetchActivity, type ActivityEntry } from '../../services/activity.service.ts';

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

  // ── Sidebar filter ────────────────────────────────────────────────────────
  const [search,         setSearch]         = useState('');
  const [activeNav,      setActiveNav]      = useState<NavKey>('all');
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState<'sidebar' | 'list' | 'editor'>('list');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [socketReady, setSocketReady] = useState(false);
  const initialSocketRun = useRef(false);

  // --- Activity Panel -----------------------------
  const [activity,         setActivity]         = useState<ActivityEntry[]>([]);
  const [activityLoading,  setActivityLoading]  = useState(false);
  const [showActivity,     setShowActivity]      = useState(false);

  async function handleInviteAccepted(noteId: string) {
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
    if (initialSocketRun.current) return;
    initialSocketRun.current = true;

    async function init() {
      const { userDEK } = getSession();

      if (!userDEK) {
        const recovered = user?.private_key_enc
          ? await tryRestoreSession(user.private_key_enc, user.id)
          : false;

        if (!recovered) {
          toast.error('Session expired. Please sign in again.');
          signOut();
          clearUser();
          navigate('/login');
          return;
        }
      }

      try {
        // Connect the socket BEFORE opening the first note
        const token = localStorage.getItem(`sv_token_${user!.id}`);
        if (token){
          connectSocket(token);
          setSocketReady(true);
        } 

        const [notesList, { folders: fl }] = await Promise.all([
          listNotes(),
          apiFetch<{ folders: Folder[] }>('/api/folders'),
        ]);
        setNotes(notesList);
        setFolders(fl);
        if (notesList.length > 0) openNote(notesList[0].id);
      }
      catch (err: any) {
        toast.error(err.message ?? 'Failed to load notes');
      }
      finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // ── Join the room + reconnect re-sync
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !selectedId) return;

    function joinCurrentNote() {
      socket!.emit('note:join', selectedId);
    }

    async function handleConnect() {
      joinCurrentNote();
      try {
        const refreshed = await fetchDecryptedBlocks(selectedId!);
        setBlocks(refreshed);
      } catch {
      }
    }

    joinCurrentNote(); 
    socket.on('connect', handleConnect);

    return () => {
      socket.off('connect', handleConnect);
      socket.emit('note:leave', selectedId);
    };
  }, [selectedId]);

  // ── Real-time event listeners ────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    async function handleBlockNew({ noteId, block }: any) {
      if (noteId !== selectedId) return;
      if (block.author_id === user?.id) return; // our own optimistic block is already rendered
      const noteDEK = getCachedNoteDEK(noteId);
      if (!noteDEK) return;
      try {
        const text = await decrypt(block.content_iv, block.content_cipher, noteDEK);
        setBlocks((p) => [...p, { ...block, text }]);
      } catch {
        setBlocks((p) => [...p, { ...block, text: '[Decryption failed]' }]);
      }
    }

    function handleBlockDeleted({ noteId, blockId }: any) {
      if (noteId !== selectedId) return;
      setBlocks((p) => p.filter((b) => b.id !== blockId));
    }

    async function handleBlockUpdated({ noteId, blockId, content_iv, content_cipher }: any) {
      if (noteId !== selectedId) return;
      const noteDEK = getCachedNoteDEK(noteId);
      if (!noteDEK) return;
      try {
        const text = await decrypt(content_iv, content_cipher, noteDEK);
        setBlocks((p) => p.map((b) => b.id === blockId ? { ...b, text } : b));
      } catch {
        // leave existing text in place rather than corrupting the UI
      }
    }

    async function handleNoteUpdated({ noteId, content_iv, content_cipher, updated_at }: any) {
      const noteDEK = getCachedNoteDEK(noteId);
      if (!noteDEK) return;
      try {
        const { title, content } = await decryptNote(content_iv, content_cipher, noteDEK);

        // Always keep the list view's title/snippet/updated_at fresh.
        setNotes((p) => p.map((n) => n.id === noteId ? { ...n, title, content, updated_at } : n));

        if (noteId !== selectedId) return;

        // If the user has unsaved local edits open, don't clobber them —
        // just warn that the note changed elsewhere.
        if (hasChanges) {
          toast('This note was updated elsewhere. Saving now may overwrite those changes.', { icon: '⚠️' });
          setSelectedNote((p) => p ? { ...p, updated_at } : null);
          return;
        }

        setSelectedNote((p) => p ? { ...p, title, content, updated_at } : null);
        setEditTitle(title);
        setEditContent(content);
      } catch {
        // ignore malformed/undecryptable update — next manual fetch will recover
      }
    }

    function handleInviteAcceptedSocket({ noteId, accepterUsername }: any) {
      toast.success(`${accepterUsername} accepted your invite`);
      listNotes().then(setNotes).catch(() => {});
    }

    function handleInviteDeclined({ noteId, declinerUsername }: any) {
      toast(`${declinerUsername} declined your invite`, { icon: '👋' });
    }
    
    function handleNoteActivity({ entry }: any) {
      setActivity((p) => {
        if (p.some((a) => a.id === entry.id)) return p; // dedupe
        return [entry, ...p]; // newest first
      });
    }
    socket.on('block:new', handleBlockNew);
    socket.on('block:deleted', handleBlockDeleted);
    socket.on('block:updated', handleBlockUpdated);
    socket.on('note:updated', handleNoteUpdated);
    socket.on('invite:accepted', handleInviteAcceptedSocket);
    socket.on('invite:declined', handleInviteDeclined);
    socket.on('note:activity', handleNoteActivity);

    return () => {
      socket.off('block:new', handleBlockNew);
      socket.off('block:deleted', handleBlockDeleted);
      socket.off('block:updated', handleBlockUpdated);
      socket.off('note:updated', handleNoteUpdated);
      socket.off('invite:accepted', handleInviteAcceptedSocket);
      socket.off('invite:declined', handleInviteDeclined);
      socket.off('note:activity', handleNoteActivity);
    };
  }, [selectedId, user?.id, hasChanges]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function openNote(id: string) {
    if (id === selectedId) return;
    if (hasChanges && selectedId) await handleSaveNote().catch(() => {});
    setSelectedId(id);
    setIsCreating(false);
    setNoteLoading(true);
    setBlocks([]);
    setHasChanges(false);
    setMobilePanel('editor');

    try {
      const note = await fetchNote(id);
      setSelectedNote(note);
      setEditTitle(note.title || '');
      setEditContent(note.content || '');
       if (note.type === 'shared') {
        setBlocks(await fetchDecryptedBlocks(id));
        setActivityLoading(true);
        fetchActivity(id)
          .then(setActivity)
          .catch(() => {})
          .finally(() => setActivityLoading(false));
      } else {
        setActivity([]);
      }
    }
    catch (err: any) {
      toast.error(err.message ?? 'Failed to open note');
    }
    finally {
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
    }
    catch (err: any) {
      toast.error(err.message ?? 'Failed to create note');
    }
    finally {
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

  // Optimistic block add — the only add-block handler; wired to NoteFooter below.
  const handleOnBlockAdd = async (text: string) => {
    if (!selectedNote) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticBlock: DecryptedBlock = {
      id: tempId,
      author_id: user?.id ?? '',
      author_username: user?.username ?? 'You',
      text,
      created_at: new Date().toISOString(),
    };

    flushSync(() => {
      setBlocks((p) => [...p, optimisticBlock]);
    });

    try {
      const real = await addBlock(selectedNote.id, text);
      const now  = new Date().toISOString();
      setBlocks((p) => p.map((b) => b.id === tempId ? real : b));
      setSelectedNote((p) => p ? { ...p, updated_at: now } : null);
      setNotes((p) => p.map((n) => n.id === selectedNote.id ? { ...n, updated_at: now } : n));
    } catch (err: any) {
      setBlocks((p) => p.filter((b) => b.id !== tempId));
      throw err;
    }
  };

  function handleOnBlockDelete(blockId: string) {
    setBlocks((p) => p.filter((b) => b.id !== blockId));
  }

  function handleSignOut() {
    disconnectSocket();
    signOut(user?.id);
    clearUser();
    navigate('/login');
  }

  async function handleCreateFolder(name: string, color: string) {
    try {
      const { folder } = await apiFetch<{ folder: Folder }>('/api/folders', {
        method: 'POST',
        body: JSON.stringify({ name, color }),
      });
      setFolders((p) => [...p, folder]);
      toast.success(`Folder "${name}" created`);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to create folder');
    }
  }

  async function handlePinNote(note: DecryptedNote) {
    const newPinned = !note.pinned;
    setNotes((p) => p.map((n) => n.id === note.id ? { ...n, pinned: newPinned } : n));
    if (selectedNote?.id === note.id) setSelectedNote((p) => p ? { ...p, pinned: newPinned } : null);
    try {
      await pinNote(note.id, newPinned);
      toast.success(newPinned ? 'Note pinned' : 'Note unpinned');
    } catch (err: any) {
      setNotes((p) => p.map((n) => n.id === note.id ? { ...n, pinned: note.pinned } : n));
      toast.error(err.message ?? 'Failed to update pin');
    }
  }

  async function handleMoveToFolder(note: DecryptedNote, folderId: string | null) {
    setNotes((p) => p.map((n) => n.id === note.id ? { ...n, folder_id: folderId } : n));
    if (selectedNote?.id === note.id) setSelectedNote((p) => p ? { ...p, folder_id: folderId } : null);
    try {
      await moveNoteToFolder(note.id, folderId);
      const name = folders.find((f) => f.id === folderId)?.name;
      toast.success(folderId ? `Moved to ${name}` : 'Removed from folder');
    } catch (err: any) {
      setNotes((p) => p.map((n) => n.id === note.id ? { ...n, folder_id: note.folder_id } : n));
      toast.error(err.message ?? 'Failed to move note');
    }
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
      <PendingInvitesBanner
        onAccepted={handleInviteAccepted}
        socketReady = {socketReady}
      />
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex flex-1 overflow-hidden relative">
        <div className="flex-shrink-0 z-30 hidden lg:flex lg:flex-col h-full" style={{ width: 160 }}>
          <Sidebar
            user={user}
            notes={notes}
            folders={folders}
            activeNav={activeNav}
            activeFolderId={activeFolderId}
            onNavChange={(nav) => {
              setActiveNav(nav);
              setActiveFolderId(null);
              setSidebarOpen(false);
            }}
            onFolderChange={(id) => {
              setActiveFolderId(id);
              setSidebarOpen(false);
            }}
            onNewNote={() => {
              setIsCreating(true);
              setSelectedId(null);
              setSelectedNote(null);
              setNewTitle('');
              setNewContent('');
              setMobilePanel('list');
            }}
            onSignOut={handleSignOut}
            onCreateFolder={handleCreateFolder}
          />
        </div>

        {/* Tablet drawer */}
        <div
          className={`
            fixed top-0 left-0 h-full z-30 flex flex-col flex-shrink-0
            lg:hidden
            transition-transform duration-300
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
          style={{ width: 200 }}
        >
          <Sidebar
            user={user}
            notes={notes}
            folders={folders}
            activeNav={activeNav}
            activeFolderId={activeFolderId}
            onNavChange={(nav) => {
              setActiveNav(nav);
              setActiveFolderId(null);
              setSidebarOpen(false);
            }}
            onFolderChange={(id) => {
              setActiveFolderId(id);
              setSidebarOpen(false);
            }}
            onNewNote={() => {
              setIsCreating(true);
              setSelectedId(null);
              setSelectedNote(null);
              setNewTitle('');
              setNewContent('');
              setSidebarOpen(false);
              setMobilePanel('list');
            }}
            onSignOut={handleSignOut}
            onCreateFolder={handleCreateFolder}
          />
        </div>

        {/* Notes list */}
        <div
          className={`
            flex-shrink-0 flex-col
            w-full md:w-[268px]
            ${mobilePanel === 'list' ? 'flex' : 'hidden'}
            md:flex
          `}
          style={{ borderRight: '1px solid var(--sv-border-3)' }}
        >
          {/* Tablet hamburger row */}
          <div className="flex items-center gap-2 px-3 pt-3 pb-1 lg:hidden">
            <button
              onClick={() => setSidebarOpen(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
            >
              <i className="ti ti-menu-2" style={{ fontSize: 20, color: 'var(--sv-text-2)' }} />
            </button>
            <button
              onClick={() => {
                setIsCreating(true);
                setSelectedId(null);
                setSelectedNote(null);
                setNewTitle('');
                setNewContent('');
                setMobilePanel('editor');
              }}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
            >
              <i className="ti ti-edit" style={{ fontSize: 20, color: 'var(--sv-accent)' }} />
            </button>
          </div>
          <NotesList
            notes={sortedNotes} folders={folders}
            loading={loading} selectedId={selectedId}
            search={search} onSearch={setSearch}
            onSelect={(id) => { openNote(id); }}
            onPin={handlePinNote}
            onMoveToFolder={handleMoveToFolder}
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
        </div>

        {/* ── Editor panel ── */}
        <main className={`
          flex-1 flex flex-col min-w-0 overflow-hidden
          ${mobilePanel === 'editor' ? 'flex' : 'hidden'}
          md:flex
        `}>
          {/* Mobile back button */}
          <div className="flex items-center md:hidden px-3 pt-2 flex-shrink-0">
            <button
              onClick={() => setMobilePanel('list')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '4px 8px 4px 0', display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <i className="ti ti-chevron-left" style={{ fontSize: 18, color: 'var(--sv-text-2)' }} />
              <span style={{ fontSize: 13, color: 'var(--sv-text-2)' }}>Notes</span>
            </button>
          </div>

          <Navbar
            note={selectedNote} isCreating={isCreating}
            hasChanges={hasChanges} saving={saving}
            updatedAt={selectedNote?.updated_at}
            onShare={() => {
              setShowShare(true);
              setShareSuccess(false);
              setShareEmail('');
            }}
            onDelete={() => {
              if (selectedNote) {
                setDeleteTarget(selectedNote);
                setShowDelete(true);
              }
            }}
            onSave={handleSaveNote}
            showActivity={showActivity}
            onToggleActivity={() => setShowActivity((v) => !v)}
          />

          {/* Body */}
          {noteLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <i className="ti ti-loader-2 animate-spin" style={{ fontSize: 26, color: 'var(--sv-text-3)' }} />
            </div>
          ) : isCreating ? (
            <div className="flex-1 flex flex-col px-6 py-7 overflow-y-auto sv-scroll">
              <input
                autoFocus value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Note title"
                className="w-full bg-transparent text-[22px] font-medium mb-4 leading-tight"
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
                <button onClick={handleCreateNote} disabled={creating || !newTitle.trim()}
                  className="px-5 py-2.5 rounded-[10px] text-[14px] font-medium transition-opacity disabled:opacity-50"
                  style={{ background: 'var(--sv-accent)', color: 'var(--sv-bg)' }}>
                  {creating ? 'Encrypting…' : 'Save Note'}
                </button>
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setMobilePanel('list');
                  }}
                  className="px-5 py-2.5 rounded-[10px] text-[14px] hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--sv-text-3)', border: '0.5px solid var(--sv-border-2)' }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : selectedNote ? (
            <NoteEditor
              note={selectedNote} blocks={blocks}
              editTitle={editTitle} editContent={editContent}
              folders={folders} userId={user?.id ?? ''}
              isOwner={selectedNote.role === 'owner'}
              onTitleChange={(v) => { setEditTitle(v); setHasChanges(true); }}
              onContentChange={(v) => { setEditContent(v); setHasChanges(true); }}
              onSave={handleSaveNote}
              onDeleteBlock={handleOnBlockDelete}
              footer={
                <NoteFooter
                  note={selectedNote} user={user}
                  onAddBlock={handleOnBlockAdd}
                  onAppendContent={(transcript) => {
                    setEditContent((prev) => prev ? `${prev}\n\n${transcript}` : transcript);
                    setHasChanges(true);
                  }}
                />
              }
              activityPanel={
                selectedNote?.type === 'shared' && showActivity
                  ? <ActivityPanel activity={activity} loading={activityLoading} />
                  : null
              }
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3" style={{ color: 'var(--sv-text-4)' }}>
              <i className="ti ti-notes" style={{ fontSize: 40, opacity: 0.3 }} />
              <p style={{ fontSize: 14 }}>Select a note to start editing</p>
            </div>
          )}
        </main>
      </div>

      {/* ── Mobile bottom nav ── */}
      <nav className="flex md:hidden flex-shrink-0" style={{
        borderTop: '1px solid var(--sv-border-3)',
        background: 'var(--sv-brand)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {[
          { key: 'sidebar' as const, icon: 'ti-layout-sidebar', label: 'Menu' },
          { key: 'list'    as const, icon: 'ti-notes',          label: 'Notes' },
          { key: 'editor'  as const, icon: 'ti-edit',           label: 'Editor' },
        ].map(({ key, icon, label }) => (
          <button key={key} onClick={() => {
            if (key === 'sidebar') setSidebarOpen(true);
            else setMobilePanel(key);
          }}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: mobilePanel === key ? 'var(--sv-accent)' : 'var(--sv-text-3)',
            }}
          >
            <i className={`ti ${icon}`} style={{ fontSize: 20 }} />
            <span style={{ fontSize: 10 }}>{label}</span>
          </button>
        ))}
      </nav>

      {/* ── Share Modal ──────────────────────────────────────────────────── */}
      <Modal
        isOpen={showShare}
        onClose={() => { setShowShare(false); setShareEmail(''); setShareSuccess(false); }}
        title="Share Note"
        description="Invite someone to collaborate on this note"
      >
        {shareSuccess ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <i className="ti ti-circle-check" style={{ fontSize: 36, color: 'var(--sv-green)' }} />
            <p style={{ fontSize: 14, color: 'var(--sv-text)' }}>Invite sent successfully</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <FloatingInput
              label="Email address"
              type="email"
              value={shareEmail}
              onChange={(e) => setShareEmail(e.target.value)}
            />
            <button
              onClick={handleShare}
              disabled={shareLoading || !shareEmail.trim()}
              className="px-5 py-2.5 rounded-[10px] text-[14px] font-medium transition-opacity disabled:opacity-50"
              style={{ background: 'var(--sv-accent)', color: 'var(--sv-bg)' }}
            >
              {shareLoading ? 'Sending…' : 'Send Invite'}
            </button>
          </div>
        )}
      </Modal>

      {/* ── Delete Confirm Modal ─────────────────────────────────────────── */}
      <Modal
        isOpen={showDelete}
        onClose={() => { setShowDelete(false); setDeleteTarget(null); }}
        title="Delete Note"
        description={`Are you sure you want to delete "${deleteTarget?.title ?? 'this note'}"? This cannot be undone.`}
      >
        <div className="flex gap-3">
          <button
            onClick={handleConfirmDelete}
            disabled={deleting}
            className="px-5 py-2.5 rounded-[10px] text-[14px] font-medium transition-opacity disabled:opacity-50"
            style={{ background: 'var(--sv-danger)', color: 'var(--sv-text)' }}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
          <button
            onClick={() => { setShowDelete(false); setDeleteTarget(null); }}
            className="px-5 py-2.5 rounded-[10px] text-[14px] hover:opacity-70 transition-opacity"
            style={{ color: 'var(--sv-text-3)', border: '0.5px solid var(--sv-border-2)' }}
          >
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
}