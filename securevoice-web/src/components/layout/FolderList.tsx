import type { Folder } from '../../types';

const FOLDER_COLORS = ['#22C55E', '#F59E0B', '#8B5CF6', '#06B6D4', '#F97316', '#EC4899'];

interface FolderListProps {
  folders: Folder[];
  activeFolderId: string | null;
  onFolderClick: (id: string | null) => void;
}

export default function FolderList({ folders, activeFolderId, onFolderClick }: FolderListProps) {
  if (folders.length === 0) return null;

  return (
    <div>
      {/* <p
        className="px-2 mb-2 text-[10px] uppercase tracking-[0.8px] font-medium"
        style={{ color: 'var(--sv-text-4)' }}
      >
        Folders
      </p> */}

      {folders.map((folder, i) => {
        const active = activeFolderId === folder.id;
        return (
          <button
            key={folder.id}
            onClick={() => onFolderClick(active ? null : folder.id)}
            className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg transition-colors text-left"
            style={{ background: active ? 'var(--sv-surface)' : 'transparent' }}
          >
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: folder.color ?? FOLDER_COLORS[i % FOLDER_COLORS.length] }}
            />
            <span
              className="text-[13px] truncate"
              style={{ color: active ? 'var(--sv-text)' : 'var(--sv-text-3)' }}
            >
              {folder.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}