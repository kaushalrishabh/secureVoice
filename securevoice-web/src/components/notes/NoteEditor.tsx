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

export default function NoteEditor({
  note, blocks, editTitle, editContent,
  folders, userId,
  onTitleChange, onContentChange, onSave,
}: NoteEditorProps) {
  const folderName = folders.find((f) => f.id === note.folder_id)?.name;

  return (
    <div className="flex-1 overflow-y-auto px-8 py-7 flex flex-col">
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

      {/* Editable content — click to type, no highlight */}
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

      {/* Contributor blocks — shared notes */}
      {note.type === 'shared' && blocks.length > 0 && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex-1 h-px" style={{ background: 'var(--sv-border)' }} />
            <span className="text-[11px] uppercase tracking-[0.6px]" style={{ color: 'var(--sv-text-4)' }}>
              Contributions
            </span>
            <div className="flex-1 h-px" style={{ background: 'var(--sv-border)' }} />
          </div>

          {blocks.map((block, idx) => {
            const color  = blockColor(block.author_id);
            const isMe   = block.author_id === userId;
            const isLast = idx === blocks.length - 1;

            return (
              <div key={block.id} className="flex gap-3">
                {/* Avatar + thread line */}
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-medium"
                    style={{ background: color, color: '#0C0C0E' }}
                  >
                    {isMe ? initials(userId.slice(0, 4)) : initials(block.author_id)}
                  </div>
                  {!isLast && (
                    <div
                      className="w-px flex-1"
                      style={{ background: `${color}20`, minHeight: 14 }}
                    />
                  )}
                </div>

                {/* Block */}
                <div className="flex-1 min-w-0 pb-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[13px] font-medium" style={{ color: 'var(--sv-text)' }}>
                      {isMe ? 'You' : `User ${block.author_id.slice(0, 6)}`}
                    </span>
                    <span className="text-[11px]" style={{ color: 'var(--sv-text-4)' }}>
                      {relDate(block.created_at)}
                    </span>
                  </div>
                  <div
                    className="rounded-[10px] px-4 py-3"
                    style={{ background: 'var(--sv-surface)', borderLeft: `2px solid ${color}` }}
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