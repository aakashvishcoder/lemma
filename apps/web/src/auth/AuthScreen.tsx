import { useState, type FormEvent } from 'react';
import { useAuth } from './AuthContext';
import { Mark } from '../ui/Mark';
import './auth.css';

type Mode = 'sign-in' | 'register';

export function AuthScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isRegister = mode === 'register';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (isRegister) {
        await register(email, password, displayName);
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <form className="auth-panel" onSubmit={handleSubmit}>
        <Mark size={36} />
        <h1>{isRegister ? 'Create an account' : 'Sign in'}</h1>
        <p className="auth-lede">
          {isRegister
            ? 'You will join a shared room straight away. Open a second tab to see how it feels.'
            : 'Welcome back. Your room is waiting.'}
        </p>

        <label>
          Email
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>

        <label>
          Password
          <input
            type="password"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            minLength={isRegister ? 8 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {isRegister && <span className="auth-hint">At least 8 characters.</span>}
        </label>

        {isRegister && (
          <label>
            Display name
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          </label>
        )}

        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}

        <button className="auth-submit" type="submit" disabled={busy}>
          {busy ? 'One moment...' : isRegister ? 'Create account' : 'Sign in'}
        </button>

        <button type="button" className="auth-switch" onClick={() => setMode(isRegister ? 'sign-in' : 'register')}>
          {isRegister ? 'Already have an account? Sign in' : 'New here? Create an account'}
        </button>
      </form>
    </main>
  );
}
