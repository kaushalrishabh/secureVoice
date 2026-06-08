import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../../services/auth.service';
import { useAuthStore } from '../../store/authStore';

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
      const user = await register(
        form.email, form.username, form.password,
        form.first_name, form.last_name,
      );
      setUser(user as any);
      navigate('/notes');
    } catch (err: any) {
      setError(err.message ?? 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    'w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 ' +
    'text-white text-sm placeholder-slate-600 ' +
    'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ' +
    'hover:border-slate-700 transition-all';

  return (
    <div className="flex min-h-screen bg-slate-950">

      {/* ── Left panel ──────────────────────────────────────────────────── */}
      <div
        className="hidden lg:flex w-[45%] flex-col justify-between p-14 relative overflow-hidden"
        style={{
          background:
            'radial-gradient(ellipse at 80% 40%, rgba(99,102,241,0.35) 0%, transparent 55%), ' +
            'linear-gradient(150deg, #1e1b4b 0%, #0f172a 60%, #020617 100%)',
        }}
      >
        <div
          className="absolute top-[-80px] left-[-80px] w-80 h-80 rounded-full opacity-25"
          style={{ background: 'radial-gradient(circle, #6366f1, transparent 70%)' }}
        />
        <div
          className="absolute bottom-[-60px] right-[-60px] w-64 h-64 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #818cf8, transparent 70%)' }}
        />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/40">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <span className="text-white font-bold text-xl tracking-tight">SecureVoice</span>
        </div>

        {/* Copy */}
        <div className="relative space-y-5">
          <h2 className="text-5xl font-bold text-white leading-tight">
            Start secure.<br />
            <span className="text-indigo-400">Stay private.</span>
          </h2>
          <p className="text-slate-400 text-base leading-relaxed max-w-xs">
            Your encryption keys are generated right here in your browser
            and never leave your device.
          </p>

          {/* Key generation visual */}
          <div className="flex items-center gap-3 mt-6 p-4 rounded-2xl
                          bg-white/5 border border-white/10 backdrop-blur-sm">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30
                            flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <div>
              <p className="text-white text-sm font-medium">Keys generated locally</p>
              <p className="text-slate-500 text-xs mt-0.5">
                RSA-2048 keypair · AES-256 DEK · PBKDF2
              </p>
            </div>
          </div>
        </div>

        <p className="relative text-xs font-mono text-slate-600 tracking-widest uppercase">
          PBKDF2 · AES-256-GCM · RSA-OAEP
        </p>
      </div>

      {/* ── Right panel ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-9 h-9 rounded-xl bg-indigo-500 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <span className="text-white font-bold text-lg">SecureVoice</span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white">Create account</h1>
            <p className="text-slate-400 mt-1.5 text-sm">
              Your keys are generated here — never on our servers
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 flex items-start gap-2.5 p-4 rounded-xl
                            bg-red-500/10 border border-red-500/20">
              <svg className="w-4 h-4 text-red-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">First name</label>
                <input name="first_name" type="text" value={form.first_name}
                  onChange={handleChange} placeholder="Jane" required className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Last name</label>
                <input name="last_name" type="text" value={form.last_name}
                  onChange={handleChange} placeholder="Smith" required className={inputClass} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Email address</label>
              <input name="email" type="email" value={form.email}
                onChange={handleChange} placeholder="you@example.com"
                required autoComplete="email" className={inputClass} />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Username</label>
              <input name="username" type="text" value={form.username}
                onChange={handleChange} placeholder="janesmith"
                required className={inputClass} />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
              <input name="password" type="password" value={form.password}
                onChange={handleChange} placeholder="••••••••"
                required minLength={8}
                autoComplete="new-password" className={inputClass} />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 mt-2
                         bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700
                         disabled:opacity-50 disabled:cursor-not-allowed
                         text-white font-semibold py-3.5 rounded-xl
                         transition-all shadow-lg shadow-indigo-500/25
                         focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-950"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10"
                      stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating keys…
                </>
              ) : (
                'Create account'
              )}
            </button>

            {loading && (
              <p className="text-center text-slate-600 text-xs">
                Generating your encryption keys — this takes a moment
              </p>
            )}
          </form>

          <div className="mt-8 pt-6 border-t border-slate-800/60 text-center">
            <p className="text-slate-500 text-sm">
              Already have an account?{' '}
              <Link to="/login"
                className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}