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
      style={{ borderTop: '0.5px solid var(--sv-border)', background: 'var(--sv-brand)' }}
    >
      {/* User avatar */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: 'var(--sv-accent)' }}
      >
        <span className="text-[11px] font-medium" style={{ color: 'var(--sv-bg)' }}>
          {initials((user?.first_name ?? '') + (user?.last_name ?? ''))}
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
        placeholder={isShared ? 'Add a block… press Enter to send' : 'Voice input — coming in Phase 4'}
        disabled={!isShared || addingBlock}
        className="flex-1 bg-transparent text-[14px]"
        style={{ color: 'var(--sv-text)', outline: 'none', border: 'none' }}
      />

      {/* Send + Mic */}
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
          style={{ background: 'var(--sv-accent)' }}
          title="Record voice (Phase 4)"
        >
          <i className="ti ti-microphone" style={{ fontSize: 17, color: 'var(--sv-bg)' }} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}