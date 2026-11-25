'use client';
import { useState } from 'react';
import { api } from '@/lib/api';

export default function SetupPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [message, setMessage] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setMessage('');
    try { await api.post('/auth/setup', form); setMessage('Encargado creado. Ya puedes iniciar sesión.'); }
    catch (error: any) { setMessage(error.message); }
  }
  return <main className="auth-container"><form className="auth-card" onSubmit={submit}>
    <h1 className="auth-title">Configuración inicial</h1><p className="auth-subtitle">Crea la única cuenta de encargado para comenzar.</p>
    {(['name', 'email', 'password'] as const).map((key) => <div className="field" key={key}><label>{key === 'name' ? 'Nombre del encargado' : key === 'email' ? 'Correo para iniciar sesión y recuperar contraseña' : 'Contraseña (mínimo 12 caracteres)'}</label><input className="input" required type={key === 'password' ? 'password' : key === 'email' ? 'email' : 'text'} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></div>)}
    {message && <p role="status">{message}</p>}<button className="btn btn-primary" type="submit">Crear encargado</button>
  </form></main>;
}
