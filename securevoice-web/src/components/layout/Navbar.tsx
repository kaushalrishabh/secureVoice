import type { DecryptedNote } from '../../services/notes.service';

interface NavbarProps {
  note: DecryptedNote | null;
  isCreating: boolean;
  hasChanges: boolean;
  saving: boolean;
  onShare: () => void;
  onDelete: () => void;
  onSave: () => void;
}

export default function Navbar({ note, isCreating, hasChanges, saving, onShare, onDelete, onSave }: NavbarProps) {
  if (!note && !isCreating) return null;

  return (
    <div
      className="flex items-center justify-between px-6 py-3 flex-shrink-0"
      style={{ borderBottom: '0.5px solid var(--sv-border)' }}
    >
      {/* Left — actions */}
      <div className="flex items-center gap-1">
        {note && (
          <>
            <button
              onClick={onShare}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px]
                         hover:opacity-70 transition-opacity"
              style={{ color: 'var(--sv-text-3)' }}
            >
              <i className="ti ti-user-plus" style={{ fontSize: 16 }} aria-hidden="true" />
              Share
            </button>

            {note.role === 'owner' && (
              <button
                onClick={onDelete}
                className="p-1.5 rounded-lg hover:opacity-70 transition-opacity"
                title="Delete note"
              >
                <i className="ti ti-trash" style={{ fontSize: 16, color: 'var(--sv-danger)' }} aria-hidden="true" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Centre — encrypted badge */}
      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--sv-green)' }} />
        <span
          className="text-[11px]"
          style={{ color: 'var(--sv-green)', fontFamily: 'var(--sv-mono)' }}
        >
          {note?.type === 'shared' ? 'Encrypted · Shared' : 'Encrypted'}
        </span>
      </div>

      {/* Right — save */}
      <div style={{ minWidth: 80, textAlign: 'right' }}>
        {hasChanges && (
          <button
            onClick={onSave}
            disabled={saving}
            className="px-3.5 py-1.5 rounded-lg text-[13px] font-medium
                       transition-opacity disabled:opacity-50"
            style={{ background: 'var(--sv-accent)', color: 'var(--sv-bg)' }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        )}
      </div>
    </div>
  );
}