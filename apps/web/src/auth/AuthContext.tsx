import { createContext, useContext, useState, type ReactNode } from 'react';

const API_BASE = 'http://localhost:3001';

interface AuthContextValue {
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));

  async function handleAuthResponse(res: Response) {
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(typeof body.error === 'string' ? body.error : `Request failed (${res.status})`);
    }
    const data = await res.json();
    setToken(data.token);
    localStorage.setItem('token', data.token);
  }

  async function login(email: string, password: string) {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    await handleAuthResponse(res);
  }

  async function register(email: string, password: string, displayName: string) {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName }),
    });
    await handleAuthResponse(res);
  }

  function logout() {
    setToken(null);
    localStorage.removeItem('token');
  }

  return <AuthContext.Provider value={{ token, login, register, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}