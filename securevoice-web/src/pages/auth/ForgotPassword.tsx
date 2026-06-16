import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import FloatingInput from '../../components/ui/FloatingInput';

export default function ForgotPassword() {
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--sv-bg)' }}>

      {/* Brand panel */}
      <div
        className="hidden lg:flex flex-col justify-between p-10 flex-shrink-0"
        style={{ width: '36%', background: 'var(--sv-brand)', borderRight: '0.5px solid var(--sv-border)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
               style={{ background: 'var(--sv-accent)' }}>
            <i className="ti ti-microphone" style={{ fontSize: 18, color: 'var(--sv-bg)' }} aria-hidden="true" />
          </div>
          <span className="text-[15px] font-medium" style={{ color: 'var(--sv-text)' }}>SecureVoice</span>
        </div>

        <div>
          <h2 className="text-[36px] font-medium leading-tight mb-4"
              style={{ color: 'var(--sv-text)', letterSpacing: '-0.5px' }}>
            Reset your<br />
            <span style={{ color: 'var(--sv-accent)' }}>password.</span>
          </h2>
          {/* E2EE warning */}
          <div className="rounded-2xl p-5"
               style={{ background: 'var(--sv-accent-dim)', border: '0.5px solid var(--sv-accent-border)' }}>
            <i className="ti ti-alert-triangle block mb-3" style={{ fontSize: 22, color: 'var(--sv-accent)' }} aria-hidden="true" />
            <p className="text-[13px] font-medium mb-1.5" style={{ color: 'var(--sv-text)' }}>
              Your notes cannot be recovered
            </p>
            <p className="text-[12px] leading-relaxed" style={{ color: 'var(--sv-text-3)' }}>
              SecureVoice is end-to-end encrypted. Resetting your password generates
              new encryption keys — your existing notes will become permanently inaccessible.
            </p>
          </div>
        </div>

        <p className="text-[10px] tracking-widest uppercase"
           style={{ color: 'var(--sv-text-4)', fontFamily: 'var(--sv-mono)' }}>
          PBKDF2 · AES-256-GCM · RSA-OAEP
        </p>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                 style={{ background: 'var(--sv-accent)' }}>
              <i className="ti ti-microphone" style={{ fontSize: 18, color: 'var(--sv-bg)' }} aria-hidden="true" />
            </div>
            <span className="text-[15px] font-medium" style={{ color: 'var(--sv-text)' }}>SecureVoice</span>
          </div>

          {/* Back */}
          <Link to="/login"
                className="inline-flex items-center gap-1.5 text-[13px] mb-6 transition-opacity hover:opacity-70"
                style={{ color: 'var(--sv-accent)' }}>
            <i className="ti ti-chevron-left" style={{ fontSize: 15 }} aria-hidden="true" />
            Back to sign in
          </Link>

          {sent ? (
            /* ── Success state ───────────────────────────────────────── */
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                   style={{ background: 'rgba(34,197,94,0.1)', border: '0.5px solid rgba(34,197,94,0.25)' }}>
                <i className="ti ti-mail-check" style={{ fontSize: 28, color: 'var(--sv-green)' }} aria-hidden="true" />
              </div>
              <h1 className="text-[24px] font-medium mb-2" style={{ color: 'var(--sv-text)' }}>
                Check your email
              </h1>
              <p className="text-[14px] leading-relaxed mb-8" style={{ color: 'var(--sv-text-2)' }}>
                If an account with <strong style={{ color: 'var(--sv-text)' }}>{email}</strong> exists,
                we've sent a reset link. Check your spam folder if you don't see it.
              </p>
              <p className="text-[12px]" style={{ color: 'var(--sv-text-4)' }}>
                The link expires in 1 hour.
              </p>
              <Link
                to="/login"
                className="inline-block mt-8 text-[13px] transition-opacity hover:opacity-70"
                style={{ color: 'var(--sv-accent)' }}
              >
                Back to sign in
              </Link>
            </div>

          ) : (
            /* ── Form ───────────────────────────────────────────────── */
            <>
              <h1 className="text-[28px] font-medium mb-1.5"
                  style={{ color: 'var(--sv-text)', letterSpacing: '-0.3px' }}>
                Forgot password?
              </h1>
              <p className="text-[14px] mb-8" style={{ color: 'var(--sv-text-2)' }}>
                Enter your email and we'll send a reset link.
              </p>

              {error && (
                <div className="mb-6 px-4 py-3 rounded-xl text-[13px]"
                     style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--sv-danger)', border: '0.5px solid rgba(239,68,68,0.2)' }}>
                  {error}
                </div>
              )}

              {/* Mobile warning */}
              <div className="lg:hidden rounded-xl p-4 mb-6"
                   style={{ background: 'var(--sv-accent-dim)', border: '0.5px solid var(--sv-accent-border)' }}>
                <p className="text-[12px]" style={{ color: 'var(--sv-accent)' }}>
                  ⚠️ Resetting your password generates new encryption keys. Existing notes will be permanently lost.
                </p>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="mb-8">
                  <FloatingInput
                    label="Email address"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full flex items-center justify-center gap-2 rounded-[10px] py-[13px]
                             text-[14px] font-medium transition-opacity disabled:opacity-50"
                  style={{ background: 'var(--sv-accent)', color: 'var(--sv-bg)' }}
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Sending…
                    </>
                  ) : 'Send reset link'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}