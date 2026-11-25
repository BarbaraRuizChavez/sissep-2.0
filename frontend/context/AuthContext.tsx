'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@/types';
import { api }  from '@/lib/api';

interface AuthContextValue {
  user:   User | null;
  token:  string | null;
  hydrated: boolean;
  login:  (controlNumber: string, password: string) => Promise<void>;
  getUser: () => User | null;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,  setUser]  = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Restaurar sesion desde localStorage al cargar la app
  useEffect(() => {
    const savedToken = localStorage.getItem('sissep_token');
    const savedUser  = localStorage.getItem('sissep_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setHydrated(true);
  }, []);

  async function login(controlNumber: string, password: string): Promise<void> {
    const data = await api.post<{ token: string; user: User }>(
      '/auth/login',
      { controlNumber, password },
    );
    localStorage.setItem('sissep_token', data.token);
    localStorage.setItem('sissep_user',  JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
  }

  function getUser(): User | null { return user; }

  function logout(): void {
    localStorage.removeItem('sissep_token');
    localStorage.removeItem('sissep_user');
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, hydrated, login, logout, getUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
