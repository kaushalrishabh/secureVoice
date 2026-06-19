import type { DecryptedNote } from '../../services/notes.service';

interface NoteListItemProps {
  note: DecryptedNote;
  isSelected: boolean;
  onSelect: () => void;
  onShare: () => void;
  onDelete: () => void;
}

function relDate(d: string) {
  const h = (Date.now() - new Date(d).getTime()) / 3_600_000;
  if (h < 24) return 'Today';
  if (h < 48) return 'Yesterday';
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function NoteListItem({ note, isSelected, onSelect, onShare, onDelete }: NoteListItemProps) {
  const isShared = note.type === 'shared';

  return (
    <div
      onClick={onSelect}
      className="group cursor-pointer"
      style={{
        padding: '11px 16px',
        background: isSelected ? 'var(--sv-surface)' : 'transparent',
        borderLeft: isSelected ? '3px solid var(--sv-accent)' : '3px solid transparent',
        borderBottom: '0.5px solid var(--sv-border)',
      }}
    >
      {/* Badges row — Pinned + Private/Shared, always visible */}
      <div className="flex items-center gap-1.5 mb-2">
        {note.pinned && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
            style={{ background: 'var(--sv-accent-dim)', color: 'var(--sv-accent)', border: '1px solid var(--sv-accent-border)' }}
          >
            <i className="ti ti-pin" style={{ fontSize: 10 }} aria-hidden="true" />
            Pinned
          </span>
        )}
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
          style={
            isShared
              ? { background: 'rgba(6,182,212,0.12)', color: 'var(--sv-blue)', border: '1px solid rgba(6,182,212,0.35)' }
              : { background: 'rgba(255,255,255,0.06)', color: 'var(--sv-text-3)', border: '1px solid var(--sv-border-2)' }
          }
        >
          <i className={`ti ${isShared ? 'ti-users' : 'ti-lock'}`} style={{ fontSize: 10 }} aria-hidden="true" />
          {isShared ? 'Shared' : 'Private'}
        </span>
      </div>

      {/* Title + date */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[14px] font-medium truncate flex-1 mr-2" style={{ color: 'var(--sv-text)' }}>
          {note.title || 'Untitled'}
        </span>
        <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--sv-text-4)' }}>
          {relDate(note.updated_at)}
        </span>
      </div>

      {/* Preview */}
      <p className="text-[12px] truncate mb-2" style={{ color: 'var(--sv-text-3)' }}>
        {note.content || 'No content yet'}
      </p>

      {/* Actions — reveal on hover */}
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onShare(); }}
            title="Share"
            className="p-1 rounded hover:opacity-70 transition-opacity"
          >
            <i className="ti ti-user-plus" style={{ fontSize: 13, color: 'var(--sv-text-3)' }} aria-hidden="true" />
          </button>
          {note.role === 'owner' && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              title="Delete"
              className="p-1 rounded hover:opacity-70 transition-opacity"
            >
              <i className="ti ti-trash" style={{ fontSize: 13, color: 'var(--sv-danger)' }} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}