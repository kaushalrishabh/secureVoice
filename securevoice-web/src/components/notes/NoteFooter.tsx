import { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import type { DecryptedNote } from '../../services/notes.service';
import type { User } from '../../types';

// ── Web Speech API type declarations ─────────────────────────────────────────
declare class SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror:  ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend:    (() => void) | null;
}
interface SpeechRecognitionEvent {
  readonly resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionAlternative {
  readonly transcript: string;
}
interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
}
declare const webkitSpeechRecognition: typeof SpeechRecognition;

// ── Constants ─────────────────────────────────────────────────────────────────

const SILENCE_TIMEOUT_MS = 5000;
const MAX_RESTARTS       = 10;
const RESTART_DELAY_MS   = 300;

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(str: string) {
  return (str ?? '').slice(0, 2).toUpperCase();
}

function speechSupported(): boolean {
  return typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
}

function makeSpeechRecognition(): SpeechRecognition | null {
  if (!speechSupported()) return null;
  const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
  const r  = new SR() as SpeechRecognition;
  r.continuous     = true;
  r.interimResults = true;
  r.lang           = navigator.language || 'en-US';
  return r;
}

// ── GrowTextarea ──────────────────────────────────────────────────────────────

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

// ── MicButton ─────────────────────────────────────────────────────────────────
//
// IMPORTANT: this component must NEVER be conditionally unmounted while
// listening is active. Use CSS (display:none) in the parent instead of
// React conditional rendering — unmounting fires cleanup which kills
// recognition mid-session.

function MicButton({ onTranscript, onInterim, disabled, onListeningChange }: {
  onTranscript: (text: string) => void;
  onInterim?: (text: string) => void;
  disabled?: boolean;
  onListeningChange?: (listening: boolean) => void;
}) {
  const [listening, setListening] = useState(false);

  const recognitionRef   = useRef<SpeechRecognition | null>(null);
  const transcriptRef    = useRef('');
  const stoppedByUserRef = useRef(false);
  const restartCountRef  = useRef(0);
  const silenceTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onTranscriptRef      = useRef(onTranscript);
  const onInterimRef         = useRef(onInterim);
  const onListeningChangeRef = useRef(onListeningChange);
  useEffect(() => { onTranscriptRef.current      = onTranscript;      }, [onTranscript]);
  useEffect(() => { onInterimRef.current          = onInterim;         }, [onInterim]);
  useEffect(() => { onListeningChangeRef.current  = onListeningChange; }, [onListeningChange]);

  const supported = speechSupported();

  // Helper to set listening state in both local state and parent
  function setListeningState(val: boolean) {
    setListening(val);
    onListeningChangeRef.current?.(val);
  }

  function clearSilenceTimer() {
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
  }
  function clearRestartTimer() {
    if (restartTimerRef.current) { clearTimeout(restartTimerRef.current); restartTimerRef.current = null; }
  }
  function clearAllTimers() { clearSilenceTimer(); clearRestartTimer(); }

  function armSilenceTimer() {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      doSubmitRef.current();
    }, SILENCE_TIMEOUT_MS);
  }

  useEffect(() => {
    return () => {
      stoppedByUserRef.current = true;
      clearAllTimers();
      recognitionRef.current?.stop();
    };
  }, []);

  const doSubmitRef = useRef(() => {});
  doSubmitRef.current = () => {
    clearAllTimers();
    stoppedByUserRef.current = true;
    recognitionRef.current?.stop();
    recognitionRef.current = null;

    const final = transcriptRef.current.trim();
    transcriptRef.current   = '';
    restartCountRef.current = 0;

    setListeningState(false); // ← notifies parent

    if (final) {
      onTranscriptRef.current(final);
    } else {
      if (onInterimRef.current) onInterimRef.current('');
      toast('No speech detected', { icon: '🎤' });
    }
  };

  const startRecognitionRef = useRef(() => {});
  startRecognitionRef.current = () => {
    if (stoppedByUserRef.current) return;
    if (restartCountRef.current >= MAX_RESTARTS) {
      setListeningState(false); // ← notifies parent
      toast.error('Voice input stopped — microphone unavailable');
      return;
    }

    const r = makeSpeechRecognition();
    if (!r) return;
    recognitionRef.current = r;

    r.onresult = (e: SpeechRecognitionEvent) => {
      let finalChunk = '';
      let interim    = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalChunk += res[0].transcript;
        else             interim    += res[0].transcript;
      }
      if (finalChunk) {
        transcriptRef.current += finalChunk;
        armSilenceTimer();
      }
      if (onInterimRef.current) {
        onInterimRef.current(transcriptRef.current + interim);
      }
    };

    r.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === 'not-allowed') {
        toast.error('Microphone access denied — check browser permissions');
        stoppedByUserRef.current = true;
        clearAllTimers();
        setListeningState(false); // ← notifies parent
        if (onInterimRef.current) onInterimRef.current('');
      }
    };

    r.onend = () => {
      recognitionRef.current = null;
      if (stoppedByUserRef.current) return;

      clearSilenceTimer();

      restartCountRef.current += 1;
      restartTimerRef.current = setTimeout(() => {
        restartTimerRef.current = null;
        startRecognitionRef.current();
      }, RESTART_DELAY_MS);
    };

    try {
      r.start();
      if (transcriptRef.current.trim()) armSilenceTimer();
    } catch {
      restartCountRef.current += 1;
      restartTimerRef.current = setTimeout(() => {
        restartTimerRef.current = null;
        startRecognitionRef.current();
      }, RESTART_DELAY_MS * 2);
    }
  };

  function startListening() {
    if (listening || disabled) return;
    stoppedByUserRef.current  = false;
    transcriptRef.current     = '';
    restartCountRef.current   = 0;
    setListeningState(true); // ← notifies parent
    startRecognitionRef.current();
  }

  function stopListening() {
    if (!listening) return;
    doSubmitRef.current();
  }

  if (!supported) return null;

  return (
    <button
      onClick={listening ? stopListening : startListening}
      disabled={disabled}
      title={listening ? 'Stop and send' : 'Start voice input'}
      style={{
        width: 30, height: 30,
        borderRadius: '50%',
        flexShrink: 0,
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.15s, box-shadow 0.15s',
        background: listening ? 'var(--sv-accent)' : 'var(--sv-surface)',
        boxShadow: listening ? '0 0 0 4px rgba(245,158,11,0.25)' : 'none',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <i
        className={`ti ${listening ? 'ti-player-stop-filled' : 'ti-microphone'}`}
        style={{ fontSize: 13, color: listening ? 'var(--sv-bg)' : 'var(--sv-text-3)' }}
      />
    </button>
  );
}

// ── NoteFooter ────────────────────────────────────────────────────────────────

interface NoteFooterProps {
  note: DecryptedNote;
  user: User | null;
  onAddBlock: (text: string) => Promise<void>;
  onAppendContent?: (text: string) => void;
}

export default function NoteFooter({ note, user, onAddBlock, onAppendContent }: NoteFooterProps) {
  const isShared = note.type === 'shared';
  const [text,       setText]       = useState('');
  const [adding,     setAdding]     = useState(false);
  const [micListening, setMicListening] = useState(false);

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

  async function handleTranscript(transcript: string) {
    if (isShared) {
      setText('');
      setAdding(true);
      try {
        await onAddBlock(transcript);
      } catch {
        toast.error('Failed to save voice contribution');
      } finally {
        setAdding(false);
      }
    } else {
      if (onAppendContent) onAppendContent(transcript);
    }
  }

  function handleInterim(partial: string) {
    if (isShared) setText(partial);
  }

  return (
    <div
      style={{
        flexShrink: 0,
        boxSizing: 'border-box',
        width: '100%',
        minWidth: 0,
        overflow: 'hidden',
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
          minWidth: 0,
          overflow: 'hidden',
        }}>
          {/* User avatar */}
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

          {/* Send button — shown when text is present and mic is not active */}
          {text.trim() && !micListening && (
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

          {/*
            MicButton is ALWAYS mounted (never conditionally removed).
            display:none hides it when there is typed text and mic is idle.
            When micListening is true the stop button stays visible regardless
            of text content so the user can always stop recording.
          */}
          <div style={{
            marginTop: 3,
            flexShrink: 0,
            display: (text.trim() && !micListening) ? 'none' : 'flex',
          }}>
            <MicButton
              onTranscript={handleTranscript}
              onInterim={handleInterim}
              disabled={adding}
              onListeningChange={setMicListening}
            />
          </div>
        </div>

      ) : (
        // Private note: mic only — transcript appended to note body
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
          <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--sv-text-4)' }}>
            Tap the mic to dictate
          </span>
          <MicButton
            onTranscript={handleTranscript}
            disabled={false}
            onListeningChange={setMicListening}
          />
        </div>
      )}
    </div>
  );
}