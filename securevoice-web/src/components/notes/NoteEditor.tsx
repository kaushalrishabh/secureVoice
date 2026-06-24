import { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import type { DecryptedNote, DecryptedBlock } from '../../services/notes.service';
import { updateBlock, deleteBlock } from '../../services/notes.service';
import type { Folder } from '../../types';

interface NoteEditorProps {
  note: DecryptedNote;
  blocks: DecryptedBlock[];
  editTitle: string;
  editContent: string;
  folders: Folder[];
  userId: string;
  isOwner: boolean;
  onTitleChange: (v: string) => void;
  onContentChange: (v: string) => void;
  onSave: () => void;
  onAddBlock: (text: string) => Promise<void>;
  onDeleteBlock: (blockId: string) => void;
}

// ── Semantic color scheme ─────────────────────────────────────────────────────
// Amber   #F59E0B  → original note body  (the note itself)
// Green   #22C55E  → note owner's blocks (their additions)
// Dynamic          → each collaborator gets a unique hue
const OWNER_BLOCK_COLOR = '#22C55E';
const ORIGINAL_COLOR    = '#F59E0B';

// Exclude amber + green from collaborator palette so they don't clash
const COLLAB_COLORS = ['#06B6D4', '#8B5CF6', '#F97316', '#EC4899', '#3B82F6', '#A855F7'];

function collabColor(seed: string) {
  const n = seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return COLLAB_COLORS[n % COLLAB_COLORS.length];
}

function relDate(d: string) {
  const dt = new Date(d);
  const h  = (Date.now() - dt.getTime()) / 3_600_000;
  if (h < 24) return dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  if (h < 48) return 'Yesterday';
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Auto-growing textarea ─────────────────────────────────────────────────────
function AutoTextarea({
  value, onChange, onBlur, onKeyDown, placeholder, autoFocus, style,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  autoFocus?: boolean;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = ref.current.scrollHeight + 'px';
    }
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      rows={1}
      style={{
        resize: 'none', overflow: 'hidden', width: '100%',
        background: 'transparent', border: 'none', outline: 'none', boxShadow: 'none',
        ...style,
      }}
    />
  );
}

// ── Segment ───────────────────────────────────────────────────────────────────
function Segment({
  block, noteId, userId, isNoteOwner, noteOwnerId, onDeleted,
}: {
  block: DecryptedBlock;
  noteId: string;
  userId: string;
  isNoteOwner: boolean;
  noteOwnerId: string;   // the note owner's user ID — for coloring their blocks green
  onDeleted: (id: string) => void;
}) {
  const [hovered,  setHovered]  = useState(false);
  const [editing,  setEditing]  = useState(false);
  const [value,    setValue]    = useState(block.text);
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);

  const name   = (block as any).author_username ?? `User ${block.author_id.slice(0, 6)}`;
  const isMe   = block.author_id === userId;
  const isTemp = block.id.startsWith('temp-');

  // Green for owner's blocks, unique hue per collaborator
  const isBlockByOwner = noteOwnerId && block.author_id === noteOwnerId;
  const color = isTemp
    ? 'var(--sv-border-2)'
    : isBlockByOwner
      ? OWNER_BLOCK_COLOR
      : collabColor(name);

  const canDelete = !isTemp && (isNoteOwner || isMe);
  const canEdit   = !isTemp && isMe;
  const showIcons = hovered && !editing && !isTemp && (canEdit || canDelete);

  async function save() {
    const trimmed = value.trim();
    if (!trimmed) { await handleDelete(); return; }
    if (trimmed === block.text) { setEditing(false); return; }
    setSaving(true);
    try {
      await updateBlock(noteId, block.id, trimmed);
      (block as any).text = trimmed;
      setEditing(false);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to update');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (isTemp) return;
    setDeleting(true);
    try {
      await deleteBlock(noteId, block.id);
      onDeleted(block.id);
      toast.success('Contribution removed');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to delete');
      setDeleting(false);
    }
  }

  function cancel() { setValue(block.text); setEditing(false); }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 20,
        paddingLeft: 14, paddingTop: 8, paddingBottom: 8, marginBottom: 4,
        borderLeft: `2px solid ${color}`,
        opacity: isTemp || deleting ? 0.5 : 1,
        transition: 'opacity 0.2s ease',
      }}
    >
      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <AutoTextarea
            autoFocus
            value={value}
            onChange={setValue}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(); }
              if (e.key === 'Escape') cancel();
            }}
            placeholder="Clear to delete…"
            style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--sv-text-2)', caretColor: 'var(--sv-accent)' }}
          />
        ) : (
          <p
            onClick={() => canEdit && setEditing(true)}
            style={{
              fontSize: 15, lineHeight: 1.8, margin: 0,
              color: 'var(--sv-text-2)', whiteSpace: 'pre-wrap',
              cursor: canEdit ? 'text' : 'default',
            }}
          >
            {block.text}
          </p>
        )}
      </div>

      {/* Attribution + sliding icons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, paddingTop: 4 }}>
        <div style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0, background: color }} />
        <span style={{ fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap', color }}>
          {isTemp ? 'Saving…' : (isMe ? 'You' : name)}
        </span>
        {!isTemp && (
          <span style={{ fontSize: 11, color: 'var(--sv-text-4)', whiteSpace: 'nowrap' }}>
            · {relDate(block.created_at)}
          </span>
        )}
        {editing && (
          <>
            <span style={{ fontSize: 10, color: 'var(--sv-text-4)', marginLeft: 4 }}>
              {saving ? 'Saving…' : '⌘↵'}
            </span>
            <button onClick={cancel} style={{ fontSize: 10, color: 'var(--sv-text-4)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              esc
            </button>
          </>
        )}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', flexShrink: 0,
          maxWidth: showIcons ? 52 : 0, opacity: showIcons ? 1 : 0,
          transition: 'max-width 0.18s ease, opacity 0.12s ease',
        }}>
          {canEdit && (
            <button onClick={() => setEditing(true)} title="Edit"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', display: 'flex', alignItems: 'center' }}>
              <i className="ti ti-pencil" style={{ fontSize: 12, color: 'var(--sv-accent)' }} />
            </button>
          )}
          {canDelete && (
            <button onClick={handleDelete} disabled={deleting} title="Delete"
              style={{ background: 'none', border: 'none', cursor: deleting ? 'default' : 'pointer', padding: '2px 0', display: 'flex', alignItems: 'center', opacity: deleting ? 0.4 : 1 }}>
              <i className={`ti ${deleting ? 'ti-loader-2 animate-spin' : 'ti-trash'}`} style={{ fontSize: 12, color: 'var(--sv-danger)' }} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main editor ───────────────────────────────────────────────────────────────
export default function NoteEditor({
  note, blocks, editTitle, editContent,
  folders, userId, isOwner,
  onTitleChange, onContentChange, onSave,
  onAddBlock, onDeleteBlock,
}: NoteEditorProps) {
  const folderName = folders.find((f) => f.id === note.folder_id)?.name;
  const isShared   = note.type === 'shared';

  // note.owner_id is returned by the backend via n.* — cast since type may not declare it
  const noteOwnerId = (note as any).owner_id ?? '';

  const [editingOriginal, setEditingOriginal] = useState(false);
  const [hoveredOriginal, setHoveredOriginal] = useState(false);
  const showOriginalEdit  = isOwner && hoveredOriginal && !editingOriginal;

  const [contribution, setContribution] = useState('');
  const [adding,       setAdding]       = useState(false);

  async function handleContribute() {
    const text = contribution.trim();
    if (!text || adding) return;
    setContribution('');
    setAdding(true);
    try {
      await onAddBlock(text);
    } catch {
      setContribution(text);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto flex flex-col" style={{ padding: '28px 40px' }}>

      {/* Privacy badge */}
      <div className="mb-5">
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium"
          style={
            isShared
              ? { background: 'rgba(6,182,212,0.12)', color: 'var(--sv-blue)', border: '1px solid rgba(6,182,212,0.35)' }
              : { background: 'rgba(255,255,255,0.06)', color: 'var(--sv-text-3)', border: '1px solid var(--sv-border-2)' }
          }
        >
          <i className={`ti ${isShared ? 'ti-users' : 'ti-lock'}`} style={{ fontSize: 12 }} />
          {isShared ? (isOwner ? 'Shared by you' : 'Shared with you') : 'Private note'}
        </span>
      </div>

      {/* Title */}
      <AutoTextarea
        value={editTitle}
        onChange={onTitleChange}
        onBlur={onSave}
        placeholder="Untitled"
        style={{
          fontSize: 30, fontWeight: 600, letterSpacing: '-0.5px',
          color: 'var(--sv-text)', caretColor: 'var(--sv-accent)',
          marginBottom: 8, lineHeight: 1.25,
        }}
      />

      {/* Meta */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32 }}>
        <span style={{ fontSize: 12, color: 'var(--sv-text-4)' }}>
          {folderName ? `${folderName} · ` : ''}
          {new Date(note.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
        <i className="ti ti-lock" style={{ fontSize: 11, color: 'var(--sv-text-4)' }} />
      </div>

      {/* Document body */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* ── Original note content ─────────────────────────────────────────── */}
        {isShared ? (
          /* Amber border = the original note body */
          <div
            onMouseEnter={() => setHoveredOriginal(true)}
            onMouseLeave={() => setHoveredOriginal(false)}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 20,
              paddingLeft: 14, paddingTop: 8, paddingBottom: 8, marginBottom: 4,
              borderLeft: `2px solid ${ORIGINAL_COLOR}`,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              {editingOriginal ? (
                <AutoTextarea
                  autoFocus
                  value={editContent}
                  onChange={onContentChange}
                  onBlur={() => { onSave(); setEditingOriginal(false); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onSave(); setEditingOriginal(false); }
                    if (e.key === 'Escape') setEditingOriginal(false);
                  }}
                  style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--sv-text-2)', caretColor: 'var(--sv-accent)' }}
                />
              ) : (
                <p
                  onClick={() => isOwner && setEditingOriginal(true)}
                  style={{
                    fontSize: 15, lineHeight: 1.8, margin: 0,
                    color: 'var(--sv-text-2)', whiteSpace: 'pre-wrap',
                    cursor: isOwner ? 'text' : 'default',
                  }}
                >
                  {editContent || <span style={{ color: 'var(--sv-text-4)', fontStyle: 'italic' }}>No content</span>}
                </p>
              )}
            </div>

            {/* Attribution */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, paddingTop: 4 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: ORIGINAL_COLOR }} />
              <span style={{ fontSize: 11, fontWeight: 500, color: ORIGINAL_COLOR, whiteSpace: 'nowrap' }}>
                {isOwner ? 'You' : 'Owner'}
              </span>
              <span style={{ fontSize: 11, color: 'var(--sv-text-4)', whiteSpace: 'nowrap' }}>
                · {relDate(note.updated_at)}
              </span>
              {editingOriginal && (
                <>
                  <span style={{ fontSize: 10, color: 'var(--sv-text-4)', marginLeft: 4 }}>⌘↵ save</span>
                  <button onClick={() => setEditingOriginal(false)} style={{ fontSize: 10, color: 'var(--sv-text-4)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>esc</button>
                </>
              )}
              {/* Sliding edit icon */}
              {isOwner && (
                <div style={{
                  display: 'flex', alignItems: 'center', overflow: 'hidden', flexShrink: 0,
                  maxWidth: showOriginalEdit ? 28 : 0,
                  opacity: showOriginalEdit ? 1 : 0,
                  transition: 'max-width 0.18s ease, opacity 0.12s ease',
                }}>
                  <button onClick={() => setEditingOriginal(true)} title="Edit original"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', display: 'flex', alignItems: 'center' }}>
                    <i className="ti ti-pencil" style={{ fontSize: 12, color: ORIGINAL_COLOR }} />
                  </button>
                </div>
              )}
            </div>
          </div>

        ) : (
          /* Private note — full editable textarea, no border treatment */
          <AutoTextarea
            value={editContent}
            onChange={onContentChange}
            onBlur={onSave}
            placeholder="Start writing…"
            style={{
              fontSize: 15, lineHeight: 1.8,
              color: 'var(--sv-text-2)', caretColor: 'var(--sv-accent)',
              flex: 1, minHeight: 200,
            }}
          />
        )}

        {/* Contribution segments */}
        {isShared && blocks.length > 0 && (
          <div>
            {blocks.map((block) => (
              <Segment
                key={block.id}
                block={block}
                noteId={note.id}
                userId={userId}
                isNoteOwner={isOwner}
                noteOwnerId={noteOwnerId}
                onDeleted={onDeleteBlock}
              />
            ))}
          </div>
        )}

        {/* ── Contribution input — plain, no box ───────────────────────────── */}
        {isShared && (
          <div style={{
            marginTop: 16,
            paddingTop: 16,
            borderTop: '1px solid var(--sv-border)',
          }}>
            <AutoTextarea
              value={contribution}
              onChange={setContribution}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleContribute(); }
              }}
              placeholder="Write here…   ↵ save   ⇧↵ new line"
              style={{
                fontSize: 15, lineHeight: 1.8,
                color: 'var(--sv-text-2)', caretColor: 'var(--sv-accent)',
                minHeight: 36, opacity: adding ? 0.5 : 1,
              }}
            />
            {/* Minimal keyboard hint — no button */}
            {contribution.trim() && (
              <p style={{ fontSize: 10, color: 'var(--sv-text-4)', marginTop: 6, textAlign: 'right' }}>
                ↵ save · ⇧↵ new line
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}