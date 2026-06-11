import { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}

export default function Modal({ isOpen, onClose, title, description, children }: ModalProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(0,0,0,0.65)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm mx-4 rounded-2xl p-6"
        style={{ background: 'var(--sv-surface)', border: '0.5px solid var(--sv-border-2)' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-[17px] font-medium" style={{ color: 'var(--sv-text)' }}>{title}</h3>
            {description && (
              <p className="text-[13px] mt-1" style={{ color: 'var(--sv-text-3)' }}>{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg ml-4 flex-shrink-0 hover:opacity-70 transition-opacity"
          >
            <i className="ti ti-x" style={{ fontSize: 17, color: 'var(--sv-text-3)' }} aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        {children}
      </div>
    </div>
  );
}