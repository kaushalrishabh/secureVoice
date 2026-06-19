import type { DecryptedNote, DecryptedBlock } from '../../services/notes.service';
import type { Folder } from '../../types';

interface NoteEditorProps {
  note: DecryptedNote;
  blocks: DecryptedBlock[];
  editTitle: string;
  editContent: string;
  folders: Folder[];
  userId: string;
  onTitleChange: (v: string) => void;
  onContentChange: (v: string) => void;
  onSave: () => void;
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
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function NoteEditor({
  note, blocks, editTitle, editContent,
  folders, userId,
  onTitleChange, onContentChange, onSave,
}: NoteEditorProps) {
  const folderName = folders.find((f) => f.id === note.folder_id)?.name;
  const isShared   = note.type === 'shared';

  return (
    <div className="flex-1 overflow-y-auto px-8 py-7 flex flex-col">

      {/* Ownership / privacy badge — the clear distinction requested */}
      <div className="mb-3">
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
            ? (note.role === 'owner' ? 'Shared by you' : 'Shared with you')
            : 'Private note'}
        </span>
      </div>

      {/* Editable title */}
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

      {/* Meta row */}
      <div className="flex items-center gap-2.5 mb-7">
        <span className="text-[12px]" style={{ color: 'var(--sv-text-4)' }}>
          {relDate(note.updated_at)}
        </span>
        {folderName && (
          <>
            <span style={{ color: 'var(--sv-text-4)', fontSize: 12 }}>·</span>
            <span className="text-[12px]" style={{ color: 'var(--sv-text-4)' }}>{folderName}</span>
          </>
        )}
        <i className="ti ti-lock" style={{ fontSize: 12, color: 'var(--sv-text-4)' }} aria-hidden="true" />
      </div>

      {/* Editable content — no focus highlight */}
      <textarea
        value={editContent}
        onChange={(e) => onContentChange(e.target.value)}
        onBlur={onSave}
        placeholder="Click here to start writing…"
        className="bg-transparent text-[15px] leading-[1.8] resize-none w-full"
        style={{
          color: 'var(--sv-text-2)',
          caretColor: 'var(--sv-accent)',
          border: 'none',
          outline: 'none',
          boxShadow: 'none',
          minHeight: 140,
          flex: blocks.length > 0 ? 'none' : 1,
        }}
      />

      {/* Contributor blocks — shared notes, attributed to real usernames where available */}
      {isShared && blocks.length > 0 && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex-1 h-px" style={{ background: 'var(--sv-border-3)' }} />
            <span className="text-[11px] uppercase tracking-[0.6px] font-medium" style={{ color: 'var(--sv-text-3)' }}>
              Contributions
            </span>
            <div className="flex-1 h-px" style={{ background: 'var(--sv-border-3)' }} />
          </div>

          {blocks.map((block, idx) => {
            // author_username requires the backend to JOIN users on the blocks query.
            // Falls back to a short id if not yet wired up — see notes below.
            const displayName = (block as any).author_username ?? `User ${block.author_id.slice(0, 6)}`;
            const colorSeed   = (block as any).author_username ?? block.author_id;
            const color       = blockColor(colorSeed);
            const isMe        = block.author_id === userId;
            const isLast      = idx === blocks.length - 1;

            return (
              <div key={block.id} className="flex gap-3">
                {/* Avatar + thread line */}
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-medium"
                    style={{ background: color, color: '#0C0C0E' }}
                  >
                    {isMe ? 'You' : initials(displayName)}
                  </div>
                  {!isLast && (
                    <div className="w-px flex-1" style={{ background: `${color}30`, minHeight: 14 }} />
                  )}
                </div>

                {/* Block */}
                <div className="flex-1 min-w-0 pb-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[13px] font-medium" style={{ color: 'var(--sv-text)' }}>
                      {isMe ? 'You' : displayName}
                    </span>
                    <span className="text-[11px]" style={{ color: 'var(--sv-text-4)' }}>
                      {relDate(block.created_at)}
                    </span>
                  </div>
                  <div
                    className="rounded-[10px] px-4 py-3"
                    style={{ background: 'var(--sv-surface)', borderLeft: `3px solid ${color}` }}
                  >
                    <p className="text-[14px] leading-relaxed" style={{ color: 'var(--sv-text-2)' }}>
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
  );
}