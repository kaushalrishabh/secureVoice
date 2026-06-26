import { useState, useRef, useEffect } from 'react';
import type { DecryptedNote } from '../../services/notes.service';
import type { User } from '../../types';

interface NoteFooterProps {
  note: DecryptedNote;
  user: User | null;
  onAddBlock: (text: string) => Promise<void>;
}

function initials(str: string) {
  return (str ?? '').slice(0, 2).toUpperCase();
}

function GrowTextarea({
  value, onChange, onKeyDown, placeholder, disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = Math.min(ref.current.scrollHeight, 120) + 'px';
    }
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      rows={1}
      style={{
        flex: 1,
        minWidth: 0,
        resize: 'none',
        overflow: 'hidden',
        background: 'transparent',
        border: 'none',
        outline: 'none',
        boxShadow: 'none',
        padding: 0,
        margin: 0,
        fontSize: 14,
        lineHeight: 1.7,
        color: disabled ? 'var(--sv-text-4)' : 'var(--sv-text-2)',
        caretColor: 'var(--sv-accent)',
        maxHeight: 120,
      }}
    />
  );
}

export default function NoteFooter({ note, user, onAddBlock }: NoteFooterProps) {
  const isShared = note.type === 'shared';
  const [text,   setText]   = useState('');
  const [adding, setAdding] = useState(false);

  const userInitials = initials(
    (user?.first_name ?? '') + (user?.last_name ?? '') || (user?.username ?? 'U'),
  );

  async function submit() {
    const trimmed = text.trim();
    if (!trimmed || adding) return;
    setText('');
    setAdding(true);
    try {
      await onAddBlock(trimmed);
    } catch {
      setText(trimmed);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div
      style={{
        flexShrink: 0,
        /* box-sizing: border-box makes padding subtract from width
           instead of adding to it — without this the 20px padding on
           each side makes the div wider than the parent container     */
        boxSizing: 'border-box',
        width: '100%',
        minWidth: 0,          // prevents flex children from exceeding parent
        overflow: 'hidden',   // clips anything that still manages to overflow
        borderTop: '1px solid var(--sv-border-3)',
        background: 'var(--sv-brand)',
        padding: '12px 20px',
      }}
    >
      {isShared ? (
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          minWidth: 0,        // same fix on the inner row
          overflow: 'hidden',
        }}>
          {/* Avatar */}
          <div style={{
            width: 26, height: 26, borderRadius: '50%',
            flexShrink: 0, marginTop: 3,
            background: 'var(--sv-accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--sv-bg)' }}>{userInitials}</span>
          </div>

          <GrowTextarea
            value={text}
            onChange={setText}
            placeholder={adding ? 'Saving…' : 'Write here…   ↵ save   ⇧↵ new line'}
            disabled={adding}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
            }}
          />

          {text.trim() && (
            <button
              onClick={submit}
              disabled={adding}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                flexShrink: 0, padding: '2px 0', marginTop: 3,
                display: 'flex', alignItems: 'center',
                opacity: adding ? 0.4 : 1,
              }}
            >
              <i className="ti ti-send" style={{ fontSize: 16, color: 'var(--sv-accent)' }} />
            </button>
          )}
        </div>

      ) : (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          minWidth: 0, overflow: 'hidden',
        }}>
          <div style={{
            width: 26, height: 26, borderRadius: '50%',
            flexShrink: 0,
            background: 'var(--sv-accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--sv-bg)' }}>{userInitials}</span>
          </div>
          <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: 'var(--sv-text-4)' }}>
            Voice input — coming in Phase 4
          </span>
          <button disabled style={{
            width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
            background: 'var(--sv-accent)', border: 'none',
            opacity: 0.35, cursor: 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <i className="ti ti-microphone" style={{ fontSize: 14, color: 'var(--sv-bg)' }} />
          </button>
        </div>
      )}
    </div>
  );
}