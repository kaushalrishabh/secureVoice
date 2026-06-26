import type { DecryptedNote } from '../../services/notes.service';

interface NavbarProps {
  note: DecryptedNote | null;
  isCreating: boolean;
  hasChanges: boolean;
  saving: boolean;
  updatedAt?: string;
  onShare: () => void;
  onDelete: () => void;
  onSave: () => void;
}

function fmtDate(iso: string) {
  const dt = new Date(iso);
  const h  = (Date.now() - dt.getTime()) / 3_600_000;
  if (h < 24) return dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  if (h < 48) return 'Yesterday';
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function Navbar({
  note, isCreating, hasChanges, saving, updatedAt,
  onShare, onDelete, onSave,
}: NavbarProps) {
  if (!note && !isCreating) return null;

  const isShared = note?.type === 'shared';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 24px',
        flexShrink: 0,
        borderBottom: '1px solid var(--sv-border-3)',
      }}
    >
      {/* Left — actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 130 }}>
        {note && (
          <>
            <button
              onClick={onShare}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 10px', borderRadius: 8,
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 13, color: 'var(--sv-text-3)',
              }}
            >
              <i className="ti ti-user-plus" style={{ fontSize: 15 }} />
              Share
            </button>
            {note.role === 'owner' && (
              <button
                onClick={onDelete}
                title="Delete note"
                style={{
                  padding: '6px 8px', borderRadius: 8,
                  background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center',
                }}
              >
                <i className="ti ti-trash" style={{ fontSize: 15, color: 'var(--sv-danger)' }} />
              </button>
            )}
          </>
        )}
      </div>

      {/* Centre — encryption + visibility badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 20, fontSize: 11,
          background: 'rgba(34,197,94,0.1)', color: 'var(--sv-green)',
          border: '1px solid rgba(34,197,94,0.3)', fontFamily: 'var(--sv-mono)',
        }}>
          <i className="ti ti-shield-lock" style={{ fontSize: 12 }} />
          Encrypted
        </span>

        {note && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500,
            ...(isShared
              ? { background: 'rgba(6,182,212,0.12)', color: 'var(--sv-blue)', border: '1px solid rgba(6,182,212,0.35)' }
              : { background: 'rgba(255,255,255,0.06)', color: 'var(--sv-text-3)', border: '1px solid var(--sv-border-2)' }),
          }}>
            <i className={`ti ${isShared ? 'ti-users' : 'ti-lock'}`} style={{ fontSize: 12 }} />
            {isShared ? 'Shared' : 'Private'}
          </span>
        )}
      </div>

      {/* Right — date + save button */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        minWidth: 130, justifyContent: 'flex-end',
      }}>
        {updatedAt && (
          <span style={{ fontSize: 11, color: 'var(--sv-text-4)', whiteSpace: 'nowrap' }}>
            {fmtDate(updatedAt)}
          </span>
        )}
        {hasChanges && (
          <button
            onClick={onSave}
            disabled={saving}
            style={{
              padding: '5px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
              background: 'var(--sv-accent)', color: 'var(--sv-bg)',
              border: 'none', cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.5 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        )}
      </div>
    </div>
  );
}