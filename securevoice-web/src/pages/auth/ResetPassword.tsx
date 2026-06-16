import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  deriveClientHash,
  deriveKEK,
  wrapDEK,
  toBase64Url,
  fromBase64url,
} from '../../lib/crypto';
import { apiFetch } from '../../lib/api';
import FloatingInput from '../../components/ui/FloatingInput';

type Status = 'validating' | 'invalid' | 'ready' | 'success';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  const token          = searchParams.get('token') ?? '';

  const [status,   setStatus]   = useState<Status>('validating');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  // Validate token on mount
  useEffect(() => {
    if (!token) { setStatus('invalid'); return; }
    apiFetch(`/api/auth/validate-reset-token?token=${encodeURIComponent(token)}`)
      .then(() => setStatus('ready'))
      .catch(() => setStatus('invalid'));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }

    setLoading(true);
    try {
      // Step 1 — derive new KEK from new password
      const clientHashBuf = await deriveClientHash(password);
      const client_hash   = toBase64Url(clientHashBuf).replace(/=+$/, '');
      const dekSaltBytes  = crypto.getRandomValues(new Uint8Array(32));
      const dek_salt      = toBase64Url(dekSaltBytes).replace(/=+$/, '');
      const newKEK        = await deriveKEK(clientHashBuf, dek_salt);

      // Step 2 — recover the original user_DEK from server escrow
      // Server decrypts dek_escrow (RSA-OAEP with server private key) and returns raw bytes.
      // The same user_DEK means ALL existing note_keys and private_key_enc stay valid.
      const { user_dek: userDEKB64 } = await apiFetch<{ user_dek: string }>(
        `/api/auth/recover-dek?token=${encodeURIComponent(token)}`,
      );

      // Step 3 — import the recovered DEK
      const userDEK = await crypto.subtle.importKey(
        'raw',
        fromBase64url(userDEKB64),
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt'],
      );

      // Step 4 — re-wrap the SAME user_DEK with the new KEK
      // note_keys, private_key_enc, public_key — all untouched ✅
      const new_dek = await wrapDEK(userDEK, newKEK);

      // Step 5 — post only the password-related fields to the server
      await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, client_hash, dek_salt, dek: new_dek }),
      });

      setStatus('success');
      toast.success('Password reset — all your notes are intact');
      setTimeout(() => navigate('/login'), 2500);

    } catch (err: any) {
      setError(err.message ?? 'Reset failed. Please try again.');
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
          <h2 className="text-[36px] font-medium leading-tight mb-5"
              style={{ color: 'var(--sv-text)', letterSpacing: '-0.5px' }}>
            New password,<br />
            <span style={{ color: 'var(--sv-accent)' }}>same notes.</span>
          </h2>
          <p className="text-[14px] leading-relaxed mb-6" style={{ color: 'var(--sv-text-3)' }}>
            Your encryption keys are recovered securely from escrow.
            All existing notes remain accessible after the reset.
          </p>

          {/* How it works */}
          <div className="space-y-3">
            {[
              { icon: 'ti-lock',          text: 'Server decrypts your key escrow' },
              { icon: 'ti-refresh',       text: 'Key is re-wrapped with new password' },
              { icon: 'ti-notes',         text: 'All notes remain accessible' },
            ].map((f) => (
              <div key={f.text} className="flex items-center gap-3">
                <i className={`ti ${f.icon}`} style={{ fontSize: 14, color: 'var(--sv-accent)' }} aria-hidden="true" />
                <span className="text-[13px]" style={{ color: 'var(--sv-text-3)' }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[10px] tracking-widest uppercase"
           style={{ color: 'var(--sv-text-4)', fontFamily: 'var(--sv-mono)' }}>
          RSA-OAEP · AES-256-GCM · PBKDF2
        </p>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">

          {/* Validating */}
          {status === 'validating' && (
            <div className="text-center">
              <i className="ti ti-loader-2 animate-spin"
                 style={{ fontSize: 28, color: 'var(--sv-text-3)' }} aria-hidden="true" />
              <p className="mt-4 text-[14px]" style={{ color: 'var(--sv-text-3)' }}>
                Validating reset link…
              </p>
            </div>
          )}

          {/* Invalid */}
          {status === 'invalid' && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                   style={{ background: 'rgba(239,68,68,0.1)', border: '0.5px solid rgba(239,68,68,0.2)' }}>
                <i className="ti ti-link-off" style={{ fontSize: 28, color: 'var(--sv-danger)' }} aria-hidden="true" />
              </div>
              <h1 className="text-[22px] font-medium mb-2" style={{ color: 'var(--sv-text)' }}>
                Link expired
              </h1>
              <p className="text-[14px] mb-8" style={{ color: 'var(--sv-text-2)' }}>
                This reset link is invalid or has expired. Reset links are valid for 1 hour.
              </p>
              <Link to="/forgot-password"
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-[10px] text-[14px] font-medium"
                    style={{ background: 'var(--sv-accent)', color: 'var(--sv-bg)' }}>
                Request a new link
              </Link>
            </div>
          )}

          {/* Success */}
          {status === 'success' && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                   style={{ background: 'rgba(34,197,94,0.1)', border: '0.5px solid rgba(34,197,94,0.25)' }}>
                <i className="ti ti-circle-check" style={{ fontSize: 28, color: 'var(--sv-green)' }} aria-hidden="true" />
              </div>
              <h1 className="text-[22px] font-medium mb-2" style={{ color: 'var(--sv-text)' }}>
                Password reset
              </h1>
              <p className="text-[14px]" style={{ color: 'var(--sv-text-2)' }}>
                Your notes are intact. Redirecting to sign in…
              </p>
            </div>
          )}

          {/* Form */}
          {status === 'ready' && (
            <>
              <h1 className="text-[28px] font-medium mb-1.5"
                  style={{ color: 'var(--sv-text)', letterSpacing: '-0.3px' }}>
                Set new password
              </h1>
              <p className="text-[14px] mb-8" style={{ color: 'var(--sv-text-2)' }}>
                Your notes will remain accessible after the reset.
              </p>

              {error && (
                <div className="mb-5 px-4 py-3 rounded-xl text-[13px]"
                     style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--sv-danger)', border: '0.5px solid rgba(239,68,68,0.2)' }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-2">
                <FloatingInput
                  label="New password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                <FloatingInput
                  label="Confirm new password"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  required
                />

                <div className="pt-6">
                  <button
                    type="submit"
                    disabled={loading || !password || !confirm}
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
                        Recovering keys…
                      </>
                    ) : 'Reset password'}
                  </button>

                  {loading && (
                    <p className="text-center text-[11px] mt-3" style={{ color: 'var(--sv-text-4)' }}>
                      Recovering your encryption keys — this takes a moment
                    </p>
                  )}
                </div>
              </form>

              <div className="text-center mt-8">
                <Link to="/login"
                      className="text-[13px] hover:opacity-70 transition-opacity"
                      style={{ color: 'var(--sv-text-3)' }}>
                  Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}