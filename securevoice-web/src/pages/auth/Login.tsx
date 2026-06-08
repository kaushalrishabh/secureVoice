import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '../../services/auth.service';
import { useAuthStore } from '../../store/authStore';

const features = [
  'AES-256-GCM note encryption',
  'Keys derived locally — never sent to server',
  'RSA-OAEP secure sharing',
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
    <div className="flex min-h-screen bg-slate-950">

      {/* ── Left panel (desktop only) ───────────────────────────────────── */}
      <div
        className="hidden lg:flex w-[45%] flex-col justify-between p-14 relative overflow-hidden"
        style={{
          background:
            'radial-gradient(ellipse at 20% 60%, rgba(99,102,241,0.35) 0%, transparent 55%), ' +
            'linear-gradient(150deg, #1e1b4b 0%, #0f172a 60%, #020617 100%)',
        }}
      >
        {/* Decorative blur orb */}
        <div
          className="absolute top-[-80px] right-[-80px] w-80 h-80 rounded-full opacity-30"
          style={{ background: 'radial-gradient(circle, #6366f1, transparent 70%)' }}
        />
        <div
          className="absolute bottom-[-60px] left-[-60px] w-64 h-64 rounded-full opacity-20"
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

        {/* Hero copy */}
        <div className="relative space-y-6">
          <div>
            <h2 className="text-5xl font-bold text-white leading-tight">
              Your notes,<br />
              <span className="text-indigo-400">encrypted.</span>
            </h2>
            <p className="text-slate-400 mt-4 text-base leading-relaxed max-w-xs">
              Voice-powered notes with end-to-end encryption.
              Only you hold the keys.
            </p>
          </div>

          {/* Features */}
          <ul className="space-y-3">
            {features.map((f) => (
              <li key={f} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-indigo-500/20 border border-indigo-500/40
                                flex items-center justify-center shrink-0">
                  <svg className="w-3 h-3 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-slate-300 text-sm">{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom crypto badge */}
        <div className="relative">
          <p className="text-xs font-mono text-slate-600 tracking-widest uppercase">
            PBKDF2 · AES-256-GCM · RSA-OAEP
          </p>
        </div>
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
            <h1 className="text-3xl font-bold text-white">Welcome back</h1>
            <p className="text-slate-400 mt-1.5 text-sm">
              Sign in to access your encrypted notes
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

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3
                           text-white text-sm placeholder-slate-600
                           focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                           hover:border-slate-700 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3
                           text-white text-sm placeholder-slate-600
                           focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                           hover:border-slate-700 transition-all"
              />
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
                  Deriving keys…
                </>
              ) : (
                'Sign in'
              )}
            </button>

            {loading && (
              <p className="text-center text-slate-600 text-xs">
                Deriving encryption keys — this takes a moment
              </p>
            )}
          </form>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-slate-800/60 text-center">
            <p className="text-slate-500 text-sm">
              Don't have an account?{' '}
              <Link to="/register"
                className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}