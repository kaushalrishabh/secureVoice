import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../../services/auth.service';
import { useAuthStore } from '../../store/authStore';
import FloatingInput from '../../components/ui/FloatingInput';

export default function Register() {
  const [form, setForm] = useState({
    first_name: '', last_name: '',
    email: '', username: '', password: '',
  });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const setUser  = useAuthStore((s) => s.setUser);
  const navigate = useNavigate();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await register(form.email, form.username, form.password, form.first_name, form.last_name);
      setUser(user as any);
      navigate('/notes');
    }
    catch (err: any) {
      setError(err.message ?? 'Registration failed. Please try again.');
    }
    finally {
      setLoading(false);
    }
  }

  const fieldClass = 'w-full bg-transparent text-[14px]';
  const fieldStyle = { color: 'var(--sv-text)', caretColor: 'var(--sv-accent)' };
  const labelClass = 'block text-[10px] font-medium uppercase tracking-[0.7px] mb-2';
  const labelStyle = { color: 'var(--sv-text-3)' };
  const wrapStyle  = { borderBottom: '1px solid var(--sv-border-2)', paddingBottom: '10px' };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--sv-bg)' }}>
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

        {/* Key generation callout */}
        <div>
          <div
            className="rounded-2xl p-5 mb-6"
            style={{ background: 'var(--sv-accent-dim)', border: '0.5px solid var(--sv-accent-border)' }}
          >
            <i className="ti ti-cpu block mb-3" style={{ fontSize: 22, color: 'var(--sv-accent)' }} aria-hidden="true" />
            <p className="text-[14px] font-medium mb-1.5" style={{ color: 'var(--sv-text)' }}>Generated on your device</p>
            <p className="text-[12px] leading-relaxed" style={{ color: 'var(--sv-text-3)' }}>
              Your RSA-2048 keypair and AES-256 master key are created right here in the browser.
              They are never transmitted to our servers.
            </p>
          </div>
          <ul className="space-y-3">
            {[
              { icon: 'ti-shield-lock', label: 'Client-side PBKDF2 key derivation' },
              { icon: 'ti-lock',        label: 'Argon2id server-side auth' },
              { icon: 'ti-share',       label: 'RSA-OAEP encrypted sharing' },
            ].map((f) => (
              <li key={f.label} className="flex items-center gap-3">
                <i className={`ti ${f.icon}`} style={{ fontSize: 13, color: 'var(--sv-accent)' }} aria-hidden="true" />
                <span className="text-[12px]" style={{ color: 'var(--sv-text-3)' }}>{f.label}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[10px] tracking-widest uppercase" style={{ color: 'var(--sv-text-4)', fontFamily: 'var(--sv-mono)' }}>
          PBKDF2 · AES-256-GCM · RSA-OAEP
        </p>
      </div>

      {/* ── Form panel ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--sv-accent)' }}>
              <i className="ti ti-microphone" style={{ fontSize: 18, color: 'var(--sv-bg)' }} aria-hidden="true" />
            </div>
            <span className="text-[15px] font-medium" style={{ color: 'var(--sv-text)' }}>SecureVoice</span>
          </div>

          {/* Back link */}
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-[13px] mb-6 transition-opacity hover:opacity-70"
            style={{ color: 'var(--sv-accent)' }}
          >
            <i className="ti ti-chevron-left" style={{ fontSize: 15 }} aria-hidden="true" />
            Back to sign in
          </Link>

          <h1 className="text-[28px] font-medium mb-1.5" style={{ color: 'var(--sv-text)', letterSpacing: '-0.3px' }}>
            Create account
          </h1>
          <p className="text-[14px] mb-8" style={{ color: 'var(--sv-text-2)' }}>
            Keys are generated on your device
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

          <form onSubmit={handleSubmit} className="space-y-5">
             <div className="flex gap-5 mb-0">
              <div className="flex-1">
                <FloatingInput
                  label="First name"
                  name="first_name"
                  value={form.first_name}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="flex-1">
                <FloatingInput
                  label="Last name"
                  name="last_name"
                  value={form.last_name}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
            <div className="space-y-1 mb-8">
              <FloatingInput
                label="Email address"
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
                required
              />
              <FloatingInput
                label="Username"
                name="username"
                value={form.username}
                onChange={handleChange}
                required
              />
              <FloatingInput
                label="Password"
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-[10px] py-[13px] text-[14px] font-medium
              flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
              style={{ background: 'var(--sv-accent)', color: 'var(--sv-bg)' }}
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating keys…
                </>
              ) : 'Create Account'}
            </button>

            {loading && (
              <p className="text-center text-[11px]" style={{ color: 'var(--sv-text-4)' }}>
                Generating your encryption keys — this takes a moment
              </p>
            )}
          </form>

          {/* Bottom badge */}
          <div className="flex items-center justify-center gap-2 mt-8">
            <i className="ti ti-lock" style={{ fontSize: 11, color: 'var(--sv-text-4)' }} aria-hidden="true" />
            <span className="text-[10px]" style={{ color: 'var(--sv-text-4)', fontFamily: 'var(--sv-mono)' }}>
              Keys never leave your device
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}