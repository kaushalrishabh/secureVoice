import { useState } from 'react';
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
  // For adding new blocks inline (shared notes)
  onAddBlock: (text: string) => Promise<void>;
}

const BLOCK_COLORS = ['#F59E0B', '#06B6D4', '#8B5CF6', '#22C55E', '#F97316', '#EC4899'];

function blockColor(seed: string) {
  const n = seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
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
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ── Editable block ────────────────────────────────────────────────────────────

function EditableBlock({
  block, noteId, userId,
}: {
  block: DecryptedBlock;
  noteId: string;
  userId: string;
}) {
  const [editing, setEditing]   = useState(false);
  const [value,   setValue]     = useState(block.text);
  const [saving,  setSaving]    = useState(false);

  const isMe    = block.author_id === userId;
  const name    = (block as any).author_username ?? `User ${block.author_id.slice(0, 6)}`;
  const color   = blockColor(name);

  async function save() {
    if (value.trim() === block.text) { setEditing(false); return; }
    setSaving(true);
    try {
      await updateBlock(noteId, block.id, value.trim());
      // Mutate in place — parent will re-fetch on next open
      (block as any).text = value.trim();
      setEditing(false);
      toast.success('Contribution updated');
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
    <div className="group relative pl-4 pb-5" style={{ borderLeft: `2px solid ${color}20` }}>
      {/* Accent dot on the left rail */}
      <div
        className="absolute left-[-5px] top-1"
        style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }}
      />

      {/* Content */}
      {editing ? (
        <textarea
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.metaKey) save();
            if (e.key === 'Escape') cancel();
          }}
          className="w-full bg-transparent text-[15px] leading-[1.8] resize-none"
          style={{
            color: 'var(--sv-text-2)',
            caretColor: 'var(--sv-accent)',
            border: 'none',
            outline: 'none',
            minHeight: 60,
          }}
        />
      ) : (
        <p
          className="text-[15px] leading-[1.8] whitespace-pre-wrap"
          style={{ color: 'var(--sv-text-2)' }}
        >
          {block.text}
        </p>
      )}

      {/* Attribution row */}
      <div className="flex items-center gap-2 mt-1.5">
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-medium flex-shrink-0"
          style={{ background: color, color: '#0C0C0E' }}
        >
          {isMe ? 'You' : initials(name)}
        </div>
        <span className="text-[12px] font-medium" style={{ color: 'var(--sv-text-3)' }}>
          {isMe ? 'You' : name}
        </span>
        <span className="text-[11px]" style={{ color: 'var(--sv-text-4)' }}>
          · {relDate(block.created_at)}
        </span>

        {/* Edit / Save / Cancel — only for author */}
        {isMe && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-[11px] opacity-0 group-hover:opacity-100 transition-opacity ml-1"
            style={{ color: 'var(--sv-accent)' }}
          >
            Edit
          </button>
        )}
        {editing && (
          <div className="flex items-center gap-2 ml-1">
            <button
              onClick={save}
              disabled={saving}
              className="text-[11px] font-medium transition-opacity disabled:opacity-50"
              style={{ color: 'var(--sv-accent)' }}
            >
              {saving ? 'Saving…' : '⌘↵ Save'}
            </button>
            <button
              onClick={cancel}
              className="text-[11px]"
              style={{ color: 'var(--sv-text-4)' }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main editor ───────────────────────────────────────────────────────────────

export default function NoteEditor({
  note, blocks, editTitle, editContent,
  folders, userId, isOwner,
  onTitleChange, onContentChange, onSave,
  onAddBlock,
}: NoteEditorProps) {
  const folderName   = folders.find((f) => f.id === note.folder_id)?.name;
  const isShared     = note.type === 'shared';

  // Inline contribution input state
  const [contribution, setContribution] = useState('');
  const [adding,       setAdding]       = useState(false);

  async function handleAddContribution() {
    if (!contribution.trim()) return;
    setAdding(true);
    try {
      await onAddBlock(contribution.trim());
      setContribution('');
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-8 py-7 flex flex-col">

      {/* Privacy badge */}
      <div className="mb-4">
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
      <input
        value={editTitle}
        onChange={(e) => onTitleChange(e.target.value)}
        onBlur={onSave}
        placeholder="Note title"
        className="w-full bg-transparent text-[24px] font-medium mb-3 leading-tight"
        style={{
          color: 'var(--sv-text)',
          letterSpacing: '-0.3px',
          caretColor: 'var(--sv-accent)',
          border: 'none',
          outline: 'none',
        }}
      />

      {/* Meta */}
      <div className="flex items-center gap-2.5 mb-7">
        <span className="text-[12px]" style={{ color: 'var(--sv-text-4)' }}>
          {folderName ? `${folderName} · ` : ''}
          {new Date(note.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
        <i className="ti ti-lock" style={{ fontSize: 12, color: 'var(--sv-text-4)' }} aria-hidden="true" />
      </div>

      {/* ── Main note content ──────────────────────────────────────────────── */}
      <textarea
        value={editContent}
        onChange={(e) => onContentChange(e.target.value)}
        onBlur={onSave}
        placeholder="Start writing…"
        className="bg-transparent text-[15px] leading-[1.8] resize-none w-full"
        style={{
          color: 'var(--sv-text-2)',
          caretColor: 'var(--sv-accent)',
          border: 'none',
          outline: 'none',
          boxShadow: 'none',
          minHeight: 120,
          flex: isShared ? 'none' : 1,
        }}
      />

      {/* ── Shared: contributions ─────────────────────────────────────────── */}
      {isShared && (
        <div className="mt-4 flex flex-col flex-1">

          {/* Subtle divider */}
          <div
            className="mb-5"
            style={{ height: 1, background: 'var(--sv-border)' }}
          />

          {/* Block list */}
          {blocks.length > 0 && (
            <div className="mb-6 space-y-0">
              {blocks.map((block) => (
                <EditableBlock
                  key={block.id}
                  block={block}
                  noteId={note.id}
                  userId={userId}
                />
              ))}
            </div>
          )}

          {/* Inline contribution input */}
          <div className="mt-auto">
            <textarea
              value={contribution}
              onChange={(e) => setContribution(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAddContribution();
                }
              }}
              placeholder="Add your contribution… (Enter to save, Shift+Enter for new line)"
              rows={2}
              className="w-full bg-transparent text-[14px] leading-relaxed resize-none"
              style={{
                color: 'var(--sv-text-2)',
                caretColor: 'var(--sv-accent)',
                border: 'none',
                outline: 'none',
                borderTop: '1px solid var(--sv-border)',
                paddingTop: 14,
              }}
            />
            {contribution.trim() && (
              <div className="flex items-center justify-between mt-2">
                <span className="text-[11px]" style={{ color: 'var(--sv-text-4)' }}>
                  Enter to save · Shift+Enter for new line
                </span>
                <button
                  onClick={handleAddContribution}
                  disabled={adding}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-opacity disabled:opacity-50"
                  style={{ background: 'var(--sv-accent)', color: 'var(--sv-bg)' }}
                >
                  {adding ? 'Saving…' : 'Save contribution'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}