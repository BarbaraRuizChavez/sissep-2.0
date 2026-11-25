'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
export default function ResetPasswordPage() {
  const [token, setToken] = useState(''); const [password, setPassword] = useState(''); const [message, setMessage] = useState('');
  useEffect(() => { setToken(new URLSearchParams(window.location.search).get('token') || ''); }, []);
  async function submit(e: React.FormEvent) { e.preventDefault(); try { await api.post('/auth/password/reset', { token, password }); setMessage('Contraseña actualizada. Ya puedes iniciar sesión.'); } catch (err: any) { setMessage(err.message); } }
  return <main className="auth-page"><form className="auth-card" onSubmit={submit}><h1 className="page-title">Crear contraseña nueva</h1><p>Usa 12 caracteres, mayúscula, minúscula, número y símbolo. El enlace vence a los 30 minutos.</p><div className="field"><label>Nueva contraseña</label><input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div><p role="status">{message}</p><button className="btn btn-primary">Guardar contraseña</button></form></main>;
}
