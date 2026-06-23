import type { DecryptedNote } from '../../services/notes.service';
import type { User } from '../../types';

interface NoteFooterProps {
  note: DecryptedNote;
  user: User | null;
  blockText: string;
  addingBlock: boolean;
  onBlockTextChange: (v: string) => void;
  onAddBlock: () => void;
}

function initials(str: string) {
  return (str ?? '').slice(0, 2).toUpperCase();
}

export default function NoteFooter({
  note, user, blockText, addingBlock,
  onBlockTextChange, onAddBlock,
}: NoteFooterProps) {
  const isShared = note.type === 'shared';

  return (
    <div
      className="flex items-center gap-3 px-6 py-3.5 flex-shrink-0"
      style={{ borderTop: '1px solid var(--sv-border-3)', background: 'var(--sv-brand)' }}
    >
      {/* User avatar */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: 'var(--sv-accent)' }}
      >
        <span className="text-[11px] font-medium" style={{ color: 'var(--sv-bg)' }}>
          {initials((user?.first_name ?? '') + (user?.last_name ?? '') || (user?.username ?? 'U'))}
        </span>
      </div>

      {/* Input */}
      <input
        value={blockText}
        onChange={(e) => onBlockTextChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && isShared) {
            e.preventDefault();
            onAddBlock();
          }
        }}
        placeholder={
          isShared
            ? 'Add a contribution… press Enter to send'
            : 'Voice input — coming in Phase 4'
        }
        disabled={!isShared || addingBlock}
        className="flex-1 bg-transparent text-[14px]"
        style={{
          color: 'var(--sv-text)',
          outline: 'none',
          border: 'none',
          opacity: isShared ? 1 : 0.4,
          cursor: isShared ? 'text' : 'not-allowed',
        }}
      />

      {/* Send + mic */}
      <div className="flex items-center gap-2">
        {isShared && blockText.trim() && (
          <button
            onClick={onAddBlock}
            disabled={addingBlock}
            className="p-2 rounded-lg transition-opacity disabled:opacity-40 hover:opacity-70"
          >
            <i className="ti ti-send" style={{ fontSize: 17, color: 'var(--sv-accent)' }} aria-hidden="true" />
          </button>
        )}
        <button
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{
            background: isShared ? 'var(--sv-accent)' : 'var(--sv-surface)',
            opacity: isShared ? 1 : 0.4,
          }}
          title="Voice input — Phase 4"
          disabled={!isShared}
        >
          <i className="ti ti-microphone" style={{ fontSize: 17, color: isShared ? 'var(--sv-bg)' : 'var(--sv-text-3)' }} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}