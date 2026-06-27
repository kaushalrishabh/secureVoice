import { useState, useRef, useEffect } from 'react';
import type { DecryptedNote } from '../../services/notes.service';
import type { Folder } from '../../types';

interface NoteListItemProps {
  note: DecryptedNote;
  folders: Folder[];
  isSelected: boolean;
  onSelect: () => void;
  onPin: () => void;
  onMoveToFolder: (folderId: string | null) => void;
  onShare: () => void;
  onDelete: () => void;
}

const FOLDER_COLORS = ['#22C55E', '#F59E0B', '#8B5CF6', '#06B6D4', '#F97316', '#EC4899'];

function relDate(d: string) {
  const h = (Date.now() - new Date(d).getTime()) / 3_600_000;
  if (h < 24) return 'Today';
  if (h < 48) return 'Yesterday';
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Folder picker dropdown ────────────────────────────────────────────────────
function FolderDropdown({
  folders, currentFolderId, onSelect, onClose,
}: {
  folders: Folder[];
  currentFolderId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    const t = setTimeout(() => document.addEventListener('mousedown', outside), 60);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', outside); };
  }, [onClose]);

  const row = (active: boolean): React.CSSProperties => ({
    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
    padding: '7px 12px', fontSize: 13, textAlign: 'left',
    color: active ? 'var(--sv-accent)' : 'var(--sv-text-2)',
    background: 'none', border: 'none', cursor: 'pointer',
  });

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 4px)',
        right: 0,
        zIndex: 200,
        background: 'var(--sv-surface)',
        border: '0.5px solid var(--sv-border-2)',
        borderRadius: 10,
        padding: '4px 0',
        minWidth: 175,
        boxShadow: '0 8px 24px rgba(0,0,0,0.55)',
      }}
    >
      {/* No folder */}
      <button style={row(!currentFolderId)} onClick={() => { onSelect(null); onClose(); }}>
        <i className="ti ti-folder-off" style={{ fontSize: 13, color: 'var(--sv-text-4)', flexShrink: 0 }} />
        <span style={{ flex: 1 }}>No folder</span>
        {!currentFolderId && <i className="ti ti-check" style={{ fontSize: 11, color: 'var(--sv-accent)' }} />}
      </button>

      {folders.length > 0 && (
        <div style={{ height: 1, background: 'var(--sv-border)', margin: '3px 10px' }} />
      )}

      {folders.map((folder, i) => {
        const color    = folder.color ?? FOLDER_COLORS[i % FOLDER_COLORS.length];
        const isActive = currentFolderId === folder.id;
        return (
          <button
            key={folder.id}
            style={row(isActive)}
            onClick={() => { onSelect(folder.id); onClose(); }}
          >
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {folder.name}
            </span>
            {isActive && <i className="ti ti-check" style={{ fontSize: 11, color: 'var(--sv-accent)' }} />}
          </button>
        );
      })}
    </div>
  );
}

// ── NoteListItem ──────────────────────────────────────────────────────────────
export default function NoteListItem({
  note, folders, isSelected,
  onSelect, onPin, onMoveToFolder, onShare, onDelete,
}: NoteListItemProps) {
  const [showFolderMenu, setShowFolderMenu] = useState(false);

  const myFolder = note?.folder_id ? folders.find((folder) => folder.id === note.folder_id ) ?? null : null;
  return (
    <div
      onClick={onSelect}
      className="group cursor-pointer"
      style={{
        padding: '11px 16px',
        background: isSelected ? 'var(--sv-surface)' : 'transparent',
        borderLeft: isSelected ? '3px solid var(--sv-accent)' : '3px solid transparent',
        borderBottom: '0.5px solid var(--sv-border)',
        position: 'relative',
      }}
    >
      {/* Pinned badge */}
      {note.pinned && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
          <i className="ti ti-pin-filled" style={{ fontSize: 10, color: 'var(--sv-accent)' }} />
          <span style={{ fontSize: 10, color: 'var(--sv-accent)' }}>Pinned</span>
        </div>
      )}

      {/* Private / Shared badge */}
      <div style={{ marginBottom: 6 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 500,
          ...(note.type === 'shared'
            ? { background: 'rgba(6,182,212,0.12)', color: 'var(--sv-blue)', border: '1px solid rgba(6,182,212,0.3)' }
            : { background: 'rgba(255,255,255,0.06)', color: 'var(--sv-text-3)', border: '1px solid var(--sv-border-2)' }),
        }}>
          <i className={`ti ${note.type === 'shared' ? 'ti-users' : 'ti-lock'}`} style={{ fontSize: 10 }} />
          {note.type === 'shared' ? 'Shared' : 'Private'}
        </span>
      </div>

      {/* Title + date */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{
          fontSize: 14, fontWeight: 500, color: 'var(--sv-text)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          flex: 1, marginRight: 8,
        }}>
          {note.title || 'Untitled'}
        </span>
        <span style={{ fontSize: 11, flexShrink: 0, color: 'var(--sv-text-4)' }}>
          {relDate(note.updated_at)}
        </span>
      </div>

      {/* Preview */}
      <p style={{
        fontSize: 12, color: 'var(--sv-text-3)', marginBottom: 8,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {note.content || 'No content yet'}
      </p>

      {/* ── Action row — revealed on hover ───────────────────────────────── */}
      <div
        className="opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 2 }}
      >
        {/* Pin / Unpin */}
        <button
          onClick={(e) => { e.stopPropagation(); onPin(); }}
          title={note.pinned ? 'Unpin' : 'Pin'}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '3px 5px', borderRadius: 6, display: 'flex', alignItems: 'center',
          }}
        >
          <i
            className={`ti ${note.pinned ? 'ti-pin-filled' : 'ti-pin'}`}
            style={{ fontSize: 13, color: note.pinned ? 'var(--sv-accent)' : 'var(--sv-text-3)' }}
          />
        </button>

        {/* Move to folder */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={(e) => { e.stopPropagation(); setShowFolderMenu((v) => !v); }}
            title="Move to folder"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '3px 5px', borderRadius: 6, display: 'flex', alignItems: 'center',
            }}
          >
            <i
              className={`ti ${myFolder ? 'ti-folder-filled' : 'ti-folder'}`}
              style={{ fontSize: 13, color: myFolder ? 'var(--sv-accent)' : 'var(--sv-text-3)' }}
            />
          </button>

          {showFolderMenu && (
            <FolderDropdown
              folders={folders}
              currentFolderId={myFolder?.id ?? null}
              onSelect={onMoveToFolder}
              onClose={() => setShowFolderMenu(false)}
            />
          )}
        </div>

        {/* Share */}
        <button
          onClick={(e) => { e.stopPropagation(); onShare(); }}
          title="Share"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '3px 5px', borderRadius: 6, display: 'flex', alignItems: 'center',
          }}
        >
          <i className="ti ti-user-plus" style={{ fontSize: 13, color: 'var(--sv-text-3)' }} />
        </button>

        {/* Delete — owner only */}
        {note.role === 'owner' && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="Delete"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '3px 5px', borderRadius: 6, display: 'flex', alignItems: 'center',
            }}
          >
            <i className="ti ti-trash" style={{ fontSize: 13, color: 'var(--sv-danger)' }} />
          </button>
        )}
      </div>
    </div>
  );
}