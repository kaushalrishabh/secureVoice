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

  const isShared = note?.type === 'shared';

  return (
    <div
      className="flex items-center justify-between px-6 py-3 flex-shrink-0"
      style={{ borderBottom: '1px solid var(--sv-border-3)' }}
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

      {/* Centre — Encrypted + Private/Shared badges */}
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px]"
          style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--sv-green)', border: '1px solid rgba(34,197,94,0.3)', fontFamily: 'var(--sv-mono)' }}
        >
          <i className="ti ti-shield-lock" style={{ fontSize: 12 }} aria-hidden="true" />
          Encrypted
        </span>
        {note && (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium"
            style={
              isShared
                ? { background: 'rgba(6,182,212,0.12)', color: 'var(--sv-blue)', border: '1px solid rgba(6,182,212,0.35)' }
                : { background: 'rgba(255,255,255,0.06)', color: 'var(--sv-text-3)', border: '1px solid var(--sv-border-2)' }
            }
          >
            <i className={`ti ${isShared ? 'ti-users' : 'ti-lock'}`} style={{ fontSize: 12 }} aria-hidden="true" />
            {isShared ? 'Shared' : 'Private'}
          </span>
        )}
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