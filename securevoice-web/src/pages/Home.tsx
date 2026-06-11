import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const FEATURES = [
  { icon: 'ti-microphone',  title: 'Voice Powered',     desc: 'Dictate notes hands-free. Your voice, transcribed and encrypted instantly.' },
  { icon: 'ti-shield-lock', title: 'Zero Knowledge',    desc: 'Your keys never leave your device. Not even we can read your notes.' },
  { icon: 'ti-users',       title: 'Secure Sharing',    desc: 'Collaborate with RSA-encrypted key exchange. Guests only see what you share.' },
  { icon: 'ti-lock',        title: 'AES-256-GCM',       desc: 'Military-grade encryption on every note, every block, every character.' },
];

const STACK = ['PBKDF2', 'AES-256-GCM', 'RSA-OAEP', 'Argon2id'];

export default function Home() {
  const user = useAuthStore((s) => s.user);

  return (
    <div style={{ background: 'var(--sv-bg)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav style={{
        borderBottom: '0.5px solid var(--sv-border)',
        padding: '14px 40px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34,
            background: 'var(--sv-accent)', borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <i className="ti ti-microphone" style={{ fontSize: 17, color: 'var(--sv-bg)' }} aria-hidden="true" />
          </div>
          <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--sv-text)' }}>SecureVoice</span>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {user ? (
            <Link
              to="/notes"
              style={{
                padding: '9px 20px', borderRadius: 10,
                background: 'var(--sv-accent)', color: 'var(--sv-bg)',
                fontSize: 14, fontWeight: 500, textDecoration: 'none',
              }}
            >
              Open Notes →
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                style={{
                  padding: '9px 20px', borderRadius: 10,
                  border: '0.5px solid var(--sv-border-2)', color: 'var(--sv-text-2)',
                  fontSize: 14, textDecoration: 'none',
                }}
              >
                Sign In
              </Link>
              <Link
                to="/register"
                style={{
                  padding: '9px 20px', borderRadius: 10,
                  background: 'var(--sv-accent)', color: 'var(--sv-bg)',
                  fontSize: 14, fontWeight: 500, textDecoration: 'none',
                }}
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px 60px' }}>

        {/* Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '6px 16px', borderRadius: 20, marginBottom: 36,
          background: 'var(--sv-accent-dim)', border: '0.5px solid var(--sv-accent-border)',
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--sv-accent)' }} />
          <span style={{ fontSize: 12, color: 'var(--sv-accent)', fontFamily: 'var(--sv-mono)' }}>
            End-to-end encrypted · Zero-knowledge
          </span>
        </div>

        {/* Headline */}
        <h1 style={{
          fontSize: 58, fontWeight: 500, letterSpacing: '-1px',
          lineHeight: 1.1, textAlign: 'center', marginBottom: 22,
          color: 'var(--sv-text)', maxWidth: 700,
        }}>
          Voice notes that only<br />
          <span style={{ color: 'var(--sv-accent)' }}>you can read.</span>
        </h1>

        {/* Subhead */}
        <p style={{
          fontSize: 18, color: 'var(--sv-text-3)', lineHeight: 1.65,
          textAlign: 'center', marginBottom: 44, maxWidth: 500,
        }}>
          End-to-end encrypted voice-powered notes. Your encryption keys are
          generated locally and never leave your browser.
        </p>

        {/* CTAs */}
        {user ? (
          <Link
            to="/notes"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '15px 32px', borderRadius: 12,
              background: 'var(--sv-accent)', color: 'var(--sv-bg)',
              fontSize: 16, fontWeight: 500, textDecoration: 'none',
            }}
          >
            <i className="ti ti-notes" style={{ fontSize: 18 }} aria-hidden="true" />
            Open My Notes
          </Link>
        ) : (
          <div style={{ display: 'flex', gap: 12 }}>
            <Link
              to="/register"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '15px 32px', borderRadius: 12,
                background: 'var(--sv-accent)', color: 'var(--sv-bg)',
                fontSize: 16, fontWeight: 500, textDecoration: 'none',
              }}
            >
              Get Started — it's free
            </Link>
            <Link
              to="/login"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '15px 32px', borderRadius: 12,
                border: '0.5px solid var(--sv-border-2)', color: 'var(--sv-text-2)',
                fontSize: 16, textDecoration: 'none',
              }}
            >
              Sign In
            </Link>
          </div>
        )}
      </div>

      {/* ── Features grid ───────────────────────────────────────────────── */}
      <div style={{
        maxWidth: 900, margin: '0 auto', padding: '0 24px 80px',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14,
      }}>
        {FEATURES.map((f) => (
          <div key={f.title} style={{
            padding: '24px',
            borderRadius: 16,
            background: 'var(--sv-surface)',
            border: '0.5px solid var(--sv-border)',
          }}>
            <i
              className={`ti ${f.icon}`}
              style={{ fontSize: 26, color: 'var(--sv-accent)', display: 'block', marginBottom: 14 }}
              aria-hidden="true"
            />
            <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--sv-text)', marginBottom: 7 }}>{f.title}</p>
            <p style={{ fontSize: 13, color: 'var(--sv-text-3)', lineHeight: 1.55 }}>{f.desc}</p>
          </div>
        ))}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer style={{
        borderTop: '0.5px solid var(--sv-border)',
        padding: '18px 40px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 13, color: 'var(--sv-text-4)' }}>
          © {new Date().getFullYear()} SecureVoice
        </span>
        <span style={{ fontSize: 11, color: 'var(--sv-text-4)', fontFamily: 'var(--sv-mono)' }}>
          {STACK.join(' · ')}
        </span>
      </footer>
    </div>
  );
}