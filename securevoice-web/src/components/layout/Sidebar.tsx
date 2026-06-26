import { useState } from 'react';
import type { DecryptedNote } from '../../services/notes.service';
import type { Folder, User } from '../../types';
import FolderList from "./FolderList"

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
  onCreateFolder: (name: string, color: string) => Promise<void>;
}

function initials(str: string) {
  return (str ?? '').slice(0, 2).toUpperCase();
}

const NAV_ITEMS: { key: NavKey; icon: string; label: string }[] = [
  { key: 'all',    icon: 'ti-notes', label: 'All Notes' },
  { key: 'shared', icon: 'ti-users', label: 'Shared'    },
  { key: 'pinned', icon: 'ti-pin',   label: 'Pinned'    },
];

const FOLDER_PALETTE = [
  '#22C55E', '#F59E0B', '#8B5CF6',
  '#06B6D4', '#F97316', '#EC4899',
];

export default function Sidebar({
  user, notes, folders,
  activeNav, activeFolderId,
  onNavChange, onFolderChange,
  onNewNote, onSignOut, onCreateFolder,
}: SidebarProps) {
  const counts: Record<NavKey, number> = {
    all:    notes.length,
    shared: notes.filter((n) => n.type === 'shared').length,
    pinned: notes.filter((n) => n.pinned).length,
  };

  // Folder creation state
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderName,     setFolderName]     = useState('');
  const [folderColor,    setFolderColor]    = useState(FOLDER_PALETTE[0]);
  const [savingFolder,   setSavingFolder]   = useState(false);

  async function handleCreateFolder() {
    if (!folderName.trim()) return;
    setSavingFolder(true);
    try {
      await onCreateFolder(folderName.trim(), folderColor);
      setFolderName('');
      setFolderColor(FOLDER_PALETTE[0]);
      setCreatingFolder(false);
    } finally {
      setSavingFolder(false);
    }
  }

  function cancelCreate() {
    setFolderName('');
    setFolderColor(FOLDER_PALETTE[0]);
    setCreatingFolder(false);
  }

  return (
    <aside
      className="flex flex-col flex-shrink-0"
      style={{ width: 160, background: 'var(--sv-brand)', borderRight: '1px solid var(--sv-border-3)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3.5 py-4" style={{ borderBottom: '1px solid var(--sv-border)' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--sv-accent)' }}>
          <i className="ti ti-microphone" style={{ fontSize: 16, color: 'var(--sv-bg)' }} />
        </div>
        <span className="text-[14px] font-medium" style={{ color: 'var(--sv-text)' }}>SecureVoice</span>
      </div>

      {/* New Note */}
      <div className="px-2.5 py-3">
        <button
          onClick={onNewNote}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-[10px] text-[13px] font-medium hover:opacity-80 transition-opacity"
          style={{ background: 'var(--sv-accent)', color: 'var(--sv-bg)' }}
        >
          <i className="ti ti-plus" style={{ fontSize: 16 }} />
          New Note
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2.5 overflow-y-auto">
        {NAV_ITEMS.map(({ key, icon, label }) => {
          const active = activeNav === key && !activeFolderId;
          return (
            <button
              key={key}
              onClick={() => { onNavChange(key); onFolderChange(null); }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left mb-0.5"
              style={{ background: active ? 'var(--sv-surface)' : 'transparent' }}
            >
              <i className={`ti ${icon}`} style={{ fontSize: 16, color: active ? 'var(--sv-accent)' : 'var(--sv-text-3)' }} />
              <span className="text-[13px] flex-1" style={{ color: active ? 'var(--sv-text)' : 'var(--sv-text-3)' }}>
                {label}
              </span>
              {counts[key] > 0 && (
                <span className="text-[11px]" style={{ color: 'var(--sv-text-4)' }}>{counts[key]}</span>
              )}
            </button>
          );
        })}

        {/* Folders section */}
        <div className="mt-5">
          <div className="flex items-center justify-between px-2 mb-2">
            <p className="text-[10px] uppercase tracking-[0.8px] font-medium" style={{ color: 'var(--sv-text-4)' }}>
              Folders
            </p>
            <button
              onClick={() => setCreatingFolder(true)}
              title="New folder"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
            >
              <i className="ti ti-folder-plus" style={{ fontSize: 13, color: 'var(--sv-text-4)' }} />
            </button>
          </div>

          {/* New folder form */}
          {creatingFolder && (
            <div
              style={{
                padding: '8px 8px 10px',
                marginBottom: 4,
                borderRadius: 8,
                background: 'var(--sv-surface)',
                border: '0.5px solid var(--sv-border-2)',
              }}
            >
              {/* Name input */}
              <input
                autoFocus
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder();
                  if (e.key === 'Escape') cancelCreate();
                }}
                placeholder="Folder name"
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: 12,
                  color: 'var(--sv-text)',
                  marginBottom: 8,
                }}
              />

              {/* Color picker */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                {FOLDER_PALETTE.map((c) => (
                  <button
                    key={c}
                    onClick={() => setFolderColor(c)}
                    style={{
                      width: 14, height: 14, borderRadius: '50%',
                      background: c, border: 'none', cursor: 'pointer', padding: 0,
                      outline: folderColor === c ? `2px solid ${c}` : 'none',
                      outlineOffset: 2,
                    }}
                  />
                ))}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={handleCreateFolder}
                  disabled={savingFolder || !folderName.trim()}
                  style={{
                    flex: 1, fontSize: 11, fontWeight: 500,
                    padding: '3px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
                    background: 'var(--sv-accent)', color: 'var(--sv-bg)',
                    opacity: savingFolder || !folderName.trim() ? 0.5 : 1,
                  }}
                >
                  {savingFolder ? '…' : 'Create'}
                </button>
                <button
                  onClick={cancelCreate}
                  style={{
                    flex: 1, fontSize: 11,
                    padding: '3px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
                    background: 'transparent', color: 'var(--sv-text-3)',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <FolderList
            folders={folders}
            activeFolderId={activeFolderId}
            onFolderClick={onFolderChange}
          />

          {folders.length === 0 && !creatingFolder && (
            <p style={{ fontSize: 11, color: 'var(--sv-text-4)', padding: '2px 8px' }}>
              No folders yet
            </p>
          )}
        </div>
      </nav>

      {/* User */}
      <div className="px-3 py-3 flex items-center gap-2 group" style={{ borderTop: '1px solid var(--sv-border)' }}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--sv-accent)' }}>
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
        <button onClick={onSignOut} title="Sign out" className="opacity-0 group-hover:opacity-100 transition-opacity">
          <i className="ti ti-logout" style={{ fontSize: 15, color: 'var(--sv-text-3)' }} />
        </button>
      </div>
    </aside>
  );
}