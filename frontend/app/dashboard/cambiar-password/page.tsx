'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
export default function ChangePasswordPage() {
  const { logout } = useAuth(); const router = useRouter();
  const [currentPassword, setCurrent] = useState(''); const [password, setPassword] = useState(''); const [confirmPassword, setConfirmPassword] = useState(''); const [message, setMessage] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setMessage('');
    if (password !== confirmPassword) { setMessage('La nueva contraseña y su confirmación no coinciden.'); return; }
    try { await api.post('/auth/password/change', { currentPassword, password, confirmPassword }); logout(); router.push('/login'); }
    catch (err: any) { setMessage(err.message); }
  }
  return <main className="content"><div className="auth-card"><h1 className="page-title">Cambiar contraseña</h1><p>Usa 12 caracteres, mayúscula, minúscula, número y símbolo.</p><form onSubmit={submit}><div className="field"><label htmlFor="current-password">Contraseña actual</label><input id="current-password" className="input" type="password" required autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} /></div><div className="field"><label htmlFor="new-password">Nueva contraseña</label><input id="new-password" className="input" type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div><div className="field"><label htmlFor="confirm-password">Confirma la nueva contraseña</label><input id="confirm-password" className="input" type="password" required autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></div><p role="status">{message}</p><button className="btn btn-primary">Guardar</button></form></div></main>;
}
