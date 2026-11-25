'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
export default function RecoverPasswordPage() {
  const [email, setEmail] = useState(''); const [message, setMessage] = useState('');
  async function submit(e: React.FormEvent) { e.preventDefault(); try { const result = await api.post<{ message: string }>('/auth/password/forgot', { email }); setMessage(result.message); } catch (err: any) { setMessage(err.message); } }
  return <main className="auth-page"><form className="auth-card" onSubmit={submit}><h1 className="page-title">Recuperar contraseña</h1><p>Escribe el correo registrado en tu cuenta.</p><div className="field"><label>Correo</label><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div><p role="status">{message}</p><button className="btn btn-primary">Enviar enlace</button></form></main>;
}
