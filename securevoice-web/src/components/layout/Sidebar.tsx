import type { DecryptedNote } from '../../services/notes.service';
import type { Folder, User } from '../../types';
import FolderList from './FolderList';

type NavKey = 'all' | 'shared' | 'pinned';

interface SidebarProps {
  user: User | null;
  notes: DecryptedNote[];
  folders: Folder[];
  activeNav: NavKey;
  activeFolderId: string | null;
  onNavChange: (nav: NavKey) => void;
  onFolderChange: (id: string | null) => void;
  onNewNote: () => void;
  onSignOut: () => void;
}

function initials(str: string) {
  return (str ?? '').slice(0, 2).toUpperCase();
}

const NAV_ITEMS: { key: NavKey; icon: string; label: string }[] = [
  { key: 'all',    icon: 'ti-notes', label: 'All Notes' },
  { key: 'shared', icon: 'ti-users', label: 'Shared'    },
  { key: 'pinned', icon: 'ti-pin',   label: 'Pinned'    },
];

export default function Sidebar({
  user, notes, folders,
  activeNav, activeFolderId,
  onNavChange, onFolderChange,
  onNewNote, onSignOut,
}: SidebarProps) {
  const counts: Record<NavKey, number> = {
    all:    notes.length,
    shared: notes.filter((n) => n.type === 'shared').length,
    pinned: notes.filter((n) => n.pinned).length,
  };

  return (
    <aside
      className="flex flex-col flex-shrink-0"
      style={{ width: 160, background: 'var(--sv-brand)', borderRight: '0.5px solid var(--sv-border)' }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-2.5 px-3.5 py-4"
        style={{ borderBottom: '0.5px solid var(--sv-border)' }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--sv-accent)' }}
        >
          <i className="ti ti-microphone" style={{ fontSize: 16, color: 'var(--sv-bg)' }} aria-hidden="true" />
        </div>
        <span className="text-[14px] font-medium" style={{ color: 'var(--sv-text)' }}>SecureVoice</span>
      </div>

      {/* New Note button */}
      <div className="px-2.5 py-3">
        <button
          onClick={onNewNote}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-[10px] text-[13px] font-medium
                     hover:opacity-80 transition-opacity"
          style={{ background: 'var(--sv-accent)', color: 'var(--sv-bg)' }}
        >
          <i className="ti ti-plus" style={{ fontSize: 16 }} aria-hidden="true" />
          New Note
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2.5 overflow-hidden">
        {NAV_ITEMS.map(({ key, icon, label }) => {
          const active = activeNav === key && !activeFolderId;
          return (
            <button
              key={key}
              onClick={() => { onNavChange(key); onFolderChange(null); }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left mb-0.5"
              style={{ background: active ? 'var(--sv-surface)' : 'transparent' }}
            >
              <i
                className={`ti ${icon}`}
                style={{ fontSize: 16, color: active ? 'var(--sv-accent)' : 'var(--sv-text-3)' }}
                aria-hidden="true"
              />
              <span
                className="text-[13px] flex-1"
                style={{ color: active ? 'var(--sv-text)' : 'var(--sv-text-3)' }}
              >
                {label}
              </span>
              {counts[key] > 0 && (
                <span className="text-[11px]" style={{ color: 'var(--sv-text-4)' }}>
                  {counts[key]}
                </span>
              )}
            </button>
          );
        })}

        {/* Folder list */}
        <FolderList
          folders={folders}
          activeFolderId={activeFolderId}
          onFolderClick={onFolderChange}
        />
      </nav>

      {/* User */}
      <div
        className="px-3 py-3 flex items-center gap-2 group"
        style={{ borderTop: '0.5px solid var(--sv-border)' }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--sv-accent)' }}
        >
          <span className="text-[11px] font-medium" style={{ color: 'var(--sv-bg)' }}>
            {initials((user?.first_name ?? '') + (user?.last_name ?? '') || (user?.username ?? 'U'))}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-medium truncate" style={{ color: 'var(--sv-text)' }}>
            {user?.first_name} {user?.last_name}
          </p>
          <p className="text-[11px] truncate" style={{ color: 'var(--sv-text-4)' }}>{user?.email}</p>
        </div>
        <button
          onClick={onSignOut}
          title="Sign out"
          className="opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <i className="ti ti-logout" style={{ fontSize: 15, color: 'var(--sv-text-3)' }} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}