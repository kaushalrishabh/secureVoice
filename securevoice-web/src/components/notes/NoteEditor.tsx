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
  onDeleteBlock: (blockId: string) => void;
  footer: React.ReactNode;
  activityPanel?: React.ReactNode;
}

const OWNER_BLOCK_COLOR = '#22C55E';
const ORIGINAL_COLOR    = '#F59E0B';
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
  noteOwnerId: string;
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

  const isBlockByOwner = noteOwnerId && block.author_id === noteOwnerId;
  const color = isTemp ? 'var(--sv-border-2)'
    : isBlockByOwner ? OWNER_BLOCK_COLOR
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
      <div style={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <AutoTextarea
            autoFocus value={value} onChange={setValue} onBlur={save}
            placeholder="Clear to delete…"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(); }
              if (e.key === 'Escape') cancel();
            }}
            style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--sv-text-2)', caretColor: 'var(--sv-accent)' }}
          />
        ) : (
          <p
            onClick={() => canEdit && setEditing(true)}
            style={{ fontSize: 15, lineHeight: 1.8, margin: 0, color: 'var(--sv-text-2)', whiteSpace: 'pre-wrap', cursor: canEdit ? 'text' : 'default' }}
          >
            {block.text}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, maxWidth: 160, overflow: 'hidden', paddingTop: 4 }}>
        <div style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0, background: color }} />
        <span style={{ fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color }}>
          {isTemp ? 'Saving…' : (isMe ? 'You' : name)}
        </span>
        {!isTemp && (
          <span style={{ fontSize: 11, color: 'var(--sv-text-4)', whiteSpace: 'nowrap', flexShrink: 0 }}>
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
  onTitleChange, onContentChange, onSave, onDeleteBlock,
  footer, activityPanel,
}: NoteEditorProps) {
  const folderName  = folders.find((f) => f.id === note.folder_id)?.name;
  const isShared    = note.type === 'shared';
  const noteOwnerId = (note as any).owner_id ?? '';

  const [editingOriginal, setEditingOriginal] = useState(false);
  const [hoveredOriginal, setHoveredOriginal] = useState(false);
  const showOriginalEdit = isOwner && hoveredOriginal && !editingOriginal;

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      minHeight: 0,
      minWidth: 0,
    }}>
      <div style={{
        flexShrink: 0,
        padding: '16px 20px 12px',
        borderBottom: '1px solid var(--sv-border)',
        background: 'var(--sv-bg)',
      }}>
        <input
          value={editTitle}
          onChange={(e) => onTitleChange(e.target.value)}
          onBlur={onSave}
          placeholder="Untitled"
          style={{
            display: 'block',
            width: '100%',
            background: 'transparent',
            border: 'none', outline: 'none', boxShadow: 'none',
            padding: 0, margin: 0,
            fontSize: 26, fontWeight: 600, letterSpacing: '-0.4px',
            color: 'var(--sv-text)', caretColor: 'var(--sv-accent)',
            lineHeight: 1.3,
          }}
        />
        {folderName && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
            <i className="ti ti-folder-filled" style={{ fontSize: 11, color: 'var(--sv-text-4)' }} />
            <span style={{ fontSize: 12, color: 'var(--sv-text-4)' }}>{folderName}</span>
          </div>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '16px 20px' }}>
        {isShared ? (
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
                  autoFocus value={editContent} onChange={onContentChange}
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
                  style={{ fontSize: 15, lineHeight: 1.8, margin: 0, color: 'var(--sv-text-2)', whiteSpace: 'pre-wrap', cursor: isOwner ? 'text' : 'default' }}
                >
                  {editContent || <span style={{ color: 'var(--sv-text-4)', fontStyle: 'italic' }}>No content</span>}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, maxWidth: 160, overflow: 'hidden', paddingTop: 4 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: ORIGINAL_COLOR, flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 500, color: ORIGINAL_COLOR, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {isOwner ? 'You' : 'Owner'}
              </span>
              {editingOriginal && (
                <>
                  <span style={{ fontSize: 10, color: 'var(--sv-text-4)', marginLeft: 4 }}>⌘↵ save</span>
                  <button onClick={() => setEditingOriginal(false)} style={{ fontSize: 10, color: 'var(--sv-text-4)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>esc</button>
                </>
              )}
              {isOwner && (
                <div style={{ display: 'flex', overflow: 'hidden', flexShrink: 0, maxWidth: showOriginalEdit ? 28 : 0, opacity: showOriginalEdit ? 1 : 0, transition: 'max-width 0.18s ease, opacity 0.12s ease' }}>
                  <button onClick={() => setEditingOriginal(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', display: 'flex', alignItems: 'center' }}>
                    <i className="ti ti-pencil" style={{ fontSize: 12, color: ORIGINAL_COLOR }} />
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <AutoTextarea
            value={editContent} onChange={onContentChange} onBlur={onSave}
            placeholder="Start writing…"
            style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--sv-text-2)', caretColor: 'var(--sv-accent)', flex: 1, minHeight: 200 }}
          />
        )}

        {isShared && blocks.length > 0 && (
          <div style={{ marginTop: 4 }}>
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
      </div>
      <div style={{
        maxWidth: activityPanel ? 220 : 0,
        overflow: 'hidden',
        flexShrink: 0,
        transition: 'max-width 0.22s ease',
      }}>
        {activityPanel}
      </div>
    </div>
    {footer}
    </div>
  );
}