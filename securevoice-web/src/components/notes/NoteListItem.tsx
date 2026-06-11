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
  return (
    <div
      onClick={onSelect}
      className="group cursor-pointer"
      style={{
        padding: '11px 16px',
        background: isSelected ? 'var(--sv-surface)' : 'transparent',
        borderLeft: isSelected ? '2px solid var(--sv-accent)' : '2px solid transparent',
        borderBottom: '0.5px solid var(--sv-border)',
      }}
    >
      {/* Pinned badge */}
      {note.pinned && (
        <div className="flex items-center gap-1 mb-1.5">
          <i className="ti ti-pin" style={{ fontSize: 11, color: 'var(--sv-accent)' }} aria-hidden="true" />
          <span className="text-[11px]" style={{ color: 'var(--sv-accent)' }}>Pinned</span>
        </div>
      )}

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

      {/* Footer row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {note.type === 'shared' && (
            <i className="ti ti-users" style={{ fontSize: 11, color: 'var(--sv-text-3)' }} aria-hidden="true" />
          )}
          <i className="ti ti-lock" style={{ fontSize: 11, color: 'var(--sv-text-4)' }} aria-hidden="true" />
        </div>

        {/* Actions — reveal on hover */}
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