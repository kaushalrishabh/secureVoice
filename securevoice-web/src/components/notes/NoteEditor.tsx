import { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import type { DecryptedNote, DecryptedBlock } from '../../services/notes.service';
import { updateBlock } from '../../services/notes.service';
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
}

const AUTHOR_COLORS = ['#F59E0B', '#06B6D4', '#8B5CF6', '#22C55E', '#F97316', '#EC4899'];

function authorColor(seed: string) {
  const n = seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AUTHOR_COLORS[n % AUTHOR_COLORS.length];
}

function relDate(d: string) {
  const dt   = new Date(d);
  const h    = (Date.now() - dt.getTime()) / 3_600_000;
  if (h < 24) return dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  if (h < 48) return 'Yesterday';
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Auto-growing textarea ─────────────────────────────────────────────────────
function AutoTextarea({
  value, onChange, onBlur, placeholder, autoFocus, style, className,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  style?: React.CSSProperties;
  className?: string;
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
      placeholder={placeholder}
      className={className}
      rows={1}
      style={{
        resize: 'none',
        overflow: 'hidden',
        width: '100%',
        background: 'transparent',
        border: 'none',
        outline: 'none',
        boxShadow: 'none',
        ...style,
      }}
    />
  );
}

// ── A single document segment (block) ────────────────────────────────────────
function Segment({
  block, noteId, userId,
}: {
  block: DecryptedBlock;
  noteId: string;
  userId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value,   setValue]   = useState(block.text);
  const [saving,  setSaving]  = useState(false);

  const name  = (block as any).author_username ?? `User ${block.author_id.slice(0, 6)}`;
  const color = authorColor(name);
  const isMe  = block.author_id === userId;

  async function save() {
    const trimmed = value.trim();
    if (!trimmed) { cancel(); return; }
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

  function cancel() {
    setValue(block.text);
    setEditing(false);
  }

  return (
    <div
      className="group relative"
      style={{
        paddingLeft: 16,
        paddingRight: 120,   // room for right-margin attribution
        paddingBottom: 10,
        borderLeft: `2px solid ${color}`,
        marginBottom: 2,
      }}
    >
      {/* Content — click own block to edit */}
      {editing ? (
        <AutoTextarea
          autoFocus
          value={value}
          onChange={setValue}
          onBlur={save}
          style={{
            fontSize: 15,
            lineHeight: 1.8,
            color: 'var(--sv-text-2)',
            caretColor: 'var(--sv-accent)',
          }}
        />
      ) : (
        <p
          className="text-[15px] leading-[1.8] whitespace-pre-wrap"
          style={{
            color: 'var(--sv-text-2)',
            cursor: isMe ? 'text' : 'default',
          }}
          onClick={() => isMe && setEditing(true)}
        >
          {block.text}
        </p>
      )}

      {/* Right-margin attribution — always visible, subtle */}
      <div
        className="absolute top-0.5 right-0 flex items-center gap-1.5"
        style={{ width: 112 }}
      >
        <div
          style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }}
        />
        <div>
          <p className="text-[11px] font-medium leading-tight" style={{ color }}>
            {isMe ? 'You' : name}
          </p>
          <p className="text-[10px]" style={{ color: 'var(--sv-text-4)' }}>
            {relDate(block.created_at)}
          </p>
        </div>

        {/* Edit / saving indicator */}
        {isMe && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity ml-0.5"
            style={{ color: 'var(--sv-accent)' }}
          >
            Edit
          </button>
        )}
        {editing && (
          <span className="text-[10px]" style={{ color: 'var(--sv-text-4)' }}>
            {saving ? 'Saving…' : '⌘↵'}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main NoteEditor ───────────────────────────────────────────────────────────

export default function NoteEditor({
  note, blocks, editTitle, editContent,
  folders, userId, isOwner,
  onTitleChange, onContentChange, onSave,
  onAddBlock,
}: NoteEditorProps) {
  const folderName = folders.find((f) => f.id === note.folder_id)?.name;
  const isShared   = note.type === 'shared';

  const [contribution, setContribution] = useState('');
  const [adding,       setAdding]       = useState(false);

  async function handleContribute() {
    const text = contribution.trim();
    if (!text) return;
    setAdding(true);
    try {
      await onAddBlock(text);
      setContribution('');
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
          <i className={`ti ${isShared ? 'ti-users' : 'ti-lock'}`} style={{ fontSize: 12 }} aria-hidden="true" />
          {isShared
            ? (isOwner ? 'Shared by you' : 'Shared with you')
            : 'Private note'}
        </span>
      </div>

      {/* Title */}
      <AutoTextarea
        value={editTitle}
        onChange={onTitleChange}
        onBlur={onSave}
        placeholder="Untitled"
        style={{
          fontSize: 30,
          fontWeight: 600,
          letterSpacing: '-0.5px',
          color: 'var(--sv-text)',
          caretColor: 'var(--sv-accent)',
          marginBottom: 8,
          lineHeight: 1.25,
        }}
      />

      {/* Meta */}
      <div className="flex items-center gap-2 mb-8">
        <span className="text-[12px]" style={{ color: 'var(--sv-text-4)' }}>
          {folderName ? `${folderName} · ` : ''}
          {new Date(note.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
        <i className="ti ti-lock" style={{ fontSize: 11, color: 'var(--sv-text-4)' }} aria-hidden="true" />
      </div>

      {/* ── Document body ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col" style={{ maxWidth: 720 }}>

        {/* Original note content — always editable by owner */}
        {isShared ? (
          /* Shared: show as attributed segment */
          <div
            className="relative"
            style={{
              paddingLeft: 16,
              paddingRight: 120,
              paddingBottom: 10,
              borderLeft: '2px solid var(--sv-accent)',
              marginBottom: 2,
            }}
          >
            <p
              className="text-[15px] leading-[1.8] whitespace-pre-wrap"
              style={{ color: 'var(--sv-text-2)' }}
            >
              {editContent || <span style={{ color: 'var(--sv-text-4)', fontStyle: 'italic' }}>No content</span>}
            </p>
            {/* Right-margin owner attribution */}
            <div className="absolute top-0.5 right-0 flex items-center gap-1.5" style={{ width: 112 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--sv-accent)', flexShrink: 0 }} />
              <div>
                <p className="text-[11px] font-medium leading-tight" style={{ color: 'var(--sv-accent)' }}>
                  {isOwner ? 'You' : 'Owner'}
                </p>
                <p className="text-[10px]" style={{ color: 'var(--sv-text-4)' }}>
                  {relDate(note.updated_at)}
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Private: full editable textarea */
          <AutoTextarea
            value={editContent}
            onChange={onContentChange}
            onBlur={onSave}
            placeholder="Start writing…"
            style={{
              fontSize: 15,
              lineHeight: 1.8,
              color: 'var(--sv-text-2)',
              caretColor: 'var(--sv-accent)',
              flex: 1,
              minHeight: 200,
            }}
          />
        )}

        {/* ── Contribution segments ──────────────────────────────────────────── */}
        {isShared && blocks.length > 0 && (
          <div className="mt-0">
            {blocks.map((block) => (
              <Segment
                key={block.id}
                block={block}
                noteId={note.id}
                userId={userId}
              />
            ))}
          </div>
        )}

        {/* ── Inline contribution input ──────────────────────────────────────── */}
        {isShared && (
          <div
            className="mt-4"
            style={{ borderTop: '1px solid var(--sv-border)', paddingTop: 16 }}
          >
            <AutoTextarea
              value={contribution}
              onChange={setContribution}
              placeholder={adding ? 'Saving…' : 'Continue writing…'}
              style={{
                fontSize: 15,
                lineHeight: 1.8,
                color: 'var(--sv-text-2)',
                caretColor: 'var(--sv-accent)',
                minHeight: 40,
                opacity: adding ? 0.5 : 1,
              }}
            />
            {contribution.trim() && (
              <div className="flex items-center justify-end gap-3 mt-2">
                <span className="text-[11px]" style={{ color: 'var(--sv-text-4)' }}>
                  Enter to save · Shift+Enter for new line
                </span>
                <button
                  onClick={handleContribute}
                  disabled={adding}
                  className="px-3 py-1 rounded-lg text-[12px] font-medium transition-opacity disabled:opacity-50"
                  style={{ background: 'var(--sv-accent)', color: 'var(--sv-bg)' }}
                >
                  {adding ? 'Saving…' : 'Save'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}