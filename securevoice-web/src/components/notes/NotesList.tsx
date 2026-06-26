import type { DecryptedNote } from '../../services/notes.service';
import type { Folder } from '../../types';
import NoteListItem from './NoteListItem';

interface NotesListProps {
  notes: DecryptedNote[];
  folders: Folder[];
  loading: boolean;
  selectedId: string | null;
  search: string;
  onSearch: (q: string) => void;
  onSelect: (id: string) => void;
  onPin: (note: DecryptedNote) => void;
  onMoveToFolder: (note: DecryptedNote, folderId: string | null) => void;
  onShare: (note: DecryptedNote) => void;
  onDelete: (note: DecryptedNote) => void;
}

export default function NotesList({
  notes, folders, loading, selectedId, search,
  onSearch, onSelect, onPin, onMoveToFolder, onShare, onDelete,
}: NotesListProps) {
  return (
    <div
      className="flex flex-col flex-shrink-0"
      style={{ width: 268, borderRight: '1px solid var(--sv-border-3)' }}
    >
      {/* Search */}
      <div className="px-3 py-3" style={{ borderBottom: '1px solid var(--sv-border)' }}>
        <div
          className="flex items-center gap-2 px-3 py-2.5 rounded-[9px]"
          style={{ background: 'var(--sv-surface)' }}
        >
          <i className="ti ti-search" style={{ fontSize: 14, color: 'var(--sv-text-4)' }} />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search notes"
            className="flex-1 bg-transparent text-[13px] min-w-0"
            style={{ color: 'var(--sv-text)', border: 'none', outline: 'none' }}
          />
          {search && (
            <button onClick={() => onSearch('')} className="hover:opacity-70 transition-opacity">
              <i className="ti ti-x" style={{ fontSize: 13, color: 'var(--sv-text-4)' }} />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-28">
            <i className="ti ti-loader-2 animate-spin" style={{ fontSize: 22, color: 'var(--sv-text-3)' }} />
          </div>
        ) : notes.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <i className="ti ti-notes" style={{ fontSize: 28, color: 'var(--sv-text-4)', display: 'block', marginBottom: 8 }} />
            <p className="text-[13px]" style={{ color: 'var(--sv-text-3)' }}>
              {search ? 'No results found' : 'No notes yet'}
            </p>
          </div>
        ) : (
          notes.map((note) => (
            <NoteListItem
              key={note.id}
              note={note}
              folders={folders}
              isSelected={note.id === selectedId}
              onSelect={() => onSelect(note.id)}
              onPin={() => onPin(note)}
              onMoveToFolder={(folderId) => onMoveToFolder(note, folderId)}
              onShare={() => onShare(note)}
              onDelete={() => onDelete(note)}
            />
          ))
        )}
      </div>
    </div>
  );
}