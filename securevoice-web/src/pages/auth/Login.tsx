import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '../../services/auth.service';
import { useAuthStore } from '../../store/authStore';
import FloatingInput from '../../components/ui/FloatingInput';

const features = [
  { icon: 'ti-shield-lock', label: 'Zero-knowledge encryption' },
  { icon: 'ti-key',         label: 'Keys stored on device only' },
  { icon: 'ti-microphone',  label: 'Voice-powered notes' },
];

export default function Login() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const setUser  = useAuthStore((s) => s.setUser);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      setUser(user as any);
      navigate('/notes');
    } catch (err: any) {
      setError(err.message ?? 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--sv-bg)' }}>

      {/* ── Brand panel (desktop only) ─────────────────────────────────── */}
      <div
        className="hidden lg:flex flex-col justify-between p-10 flex-shrink-0"
        style={{ width: '36%', background: 'var(--sv-brand)', borderRight: '0.5px solid var(--sv-border)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--sv-accent)' }}>
            <i className="ti ti-microphone" style={{ fontSize: 18, color: 'var(--sv-bg)' }} aria-hidden="true" />
          </div>
          <span className="text-[15px] font-medium" style={{ color: 'var(--sv-text)' }}>SecureVoice</span>
        </div>

        {/* Hero */}
        <div>
          <h2 className="text-[38px] font-medium leading-tight mb-4" style={{ color: 'var(--sv-text)', letterSpacing: '-0.5px' }}>
            Your notes,<br />
            <span style={{ color: 'var(--sv-accent)' }}>encrypted.</span>
          </h2>
          <p className="text-[14px] leading-relaxed mb-8" style={{ color: 'var(--sv-text-3)' }}>
            Voice-powered notes with end-to-end encryption.<br />Only you hold the keys.
          </p>
          <ul className="space-y-3">
            {features.map((f) => (
              <li key={f.label} className="flex items-center gap-3">
                <i className={`ti ${f.icon}`} style={{ fontSize: 14, color: 'var(--sv-accent)' }} aria-hidden="true" />
                <span className="text-[13px]" style={{ color: 'var(--sv-text-3)' }}>{f.label}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Crypto badge */}
        <p className="text-[10px] tracking-widest uppercase" style={{ color: 'var(--sv-text-4)', fontFamily: 'var(--sv-mono)' }}>
          PBKDF2 · AES-256-GCM · RSA-OAEP
        </p>
      </div>

      {/* ── Form panel ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--sv-accent)' }}>
              <i className="ti ti-microphone" style={{ fontSize: 18, color: 'var(--sv-bg)' }} aria-hidden="true" />
            </div>
            <span className="text-[15px] font-medium" style={{ color: 'var(--sv-text)' }}>SecureVoice</span>
          </div>

          <h1 className="text-[28px] font-medium mb-1.5" style={{ color: 'var(--sv-text)', letterSpacing: '-0.3px' }}>
            Welcome back
          </h1>
          <p className="text-[14px] mb-8" style={{ color: 'var(--sv-text-2)' }}>
            Sign in to your account
          </p>

          {/* Error */}
          {error && (
            <div
              className="mb-6 px-4 py-3 rounded-xl text-[13px]"
              style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--sv-danger)', border: '0.5px solid rgba(239,68,68,0.2)' }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="space-y-2 mb-8">
              <FloatingInput
                label="Email address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
              <FloatingInput
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            {/* Sign in button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-[10px] py-[13px] text-[14px] font-medium
                         flex items-center justify-center gap-2
                         transition-opacity disabled:opacity-50 mb-3"
              style={{ background: 'var(--sv-accent)', color: 'var(--sv-bg)' }}
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Deriving keys…
                </>
              ) : 'Sign In'}
            </button>

            {loading && (
              <p className="text-center text-[11px] mb-3" style={{ color: 'var(--sv-text-4)' }}>
                Deriving encryption keys — this takes a moment
              </p>
            )}

            {/* Divider */}
            <div className="flex items-center gap-3 my-3">
              <div className="flex-1 h-px" style={{ background: 'var(--sv-border)' }} />
              <span className="text-[11px]" style={{ color: 'var(--sv-text-4)' }}>or</span>
              <div className="flex-1 h-px" style={{ background: 'var(--sv-border)' }} />
            </div>

            {/* Create account */}
            <Link
              to="/register"
              className="block w-full rounded-[10px] py-[12px] text-[14px] text-center transition-colors"
              style={{ border: '0.5px solid var(--sv-accent-border)', color: 'var(--sv-accent)' }}
            >
              Create Account
            </Link>
          </form>

          {/* Bottom badge */}
          <div className="flex items-center justify-center gap-2 mt-8">
            <i className="ti ti-shield" style={{ fontSize: 11, color: 'var(--sv-text-4)' }} aria-hidden="true" />
            <span className="text-[10px]" style={{ color: 'var(--sv-text-4)', fontFamily: 'var(--sv-mono)' }}>
              Keys derived locally · Never sent to server
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}