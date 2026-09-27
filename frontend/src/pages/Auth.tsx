import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import './auth.css';
import { api, ApiError } from '../api/client';
import { useMe } from '../api/hooks';
import type { Me } from '../api/types';
import { Icon } from '../design/Icon';
import { toast } from '../design/toast';
import { usePrefs } from '../state/prefs';
import { Logo } from '../app/shell';
import { AuthOrbit } from './AuthOrbit';
import { Boot, homeFor } from '../app/common';

export function AuthFrame({ children }: { children: React.ReactNode }) {
  const toggleTheme = usePrefs(s => s.toggleTheme);
  return (
    <div className="auth">
      <div className="auth-left">
        <div className="row between"><Logo to="/" /><button className="btn btn-ghost btn-icon" onClick={toggleTheme} aria-label="Ganti tema"><Icon name="sun-moon" /></button></div>
        {children}
        <p className="t-xs t-faint">Dengan melanjutkan, kamu setuju dengan Ketentuan dan Kebijakan Privasi.</p>
      </div>
      <AuthOrbit />
    </div>
  );
}

const soon = () => toast({ kind: 'accent', icon: 'info', title: 'Segera hadir', body: 'Masuk dengan Google dan akun sekolah sedang disiapkan. Pakai email dulu, ya.' });

export default function Auth({ mode }: { mode: 'login' | 'register' }) {
  const { data: me, isLoading } = useMe();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  if (isLoading) return <Boot />;
  if (me) return <Navigate to={params.get('next') || homeFor(me.role)} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!pw) local.password = 'Kata sandi tidak boleh kosong.';
    if (mode === 'register' && !name.trim()) local.name = 'Nama panggilan tidak boleh kosong.';
    if (!email.trim()) local.email = 'Email tidak boleh kosong.';
    setErrors(local);
    if (Object.keys(local).length) return;
    setBusy(true);
    try {
      const u = mode === 'login'
        ? await api.post<Me>('/api/auth/login', { email, password: pw })
        : await api.post<Me>('/api/auth/register', { name, email, password: pw });
      qc.setQueryData(['/api/me'], u);
      nav(u.role === 'learner' && !u.onboarded ? '/mulai/tujuan' : params.get('next') || homeFor(u.role), { replace: true });
    } catch (err) {
      setErrors(err instanceof ApiError && Object.keys(err.fields).length ? err.fields : { password: err instanceof ApiError && err.offline ? 'Koneksi terputus. Coba lagi.' : 'Terjadi kesalahan. Coba lagi.' });
    } finally {
      setBusy(false);
    }
  };

  const field = (id: string, label: string, value: string, set: (v: string) => void, type = 'text', extra?: React.ReactNode, auto?: string) => (
    <div className="field">
      <div className="row between"><label className="field-label" htmlFor={id}>{label}</label>{extra}</div>
      <input id={id} className={`input input-lg${errors[id] ? ' is-invalid' : ''}`} type={type} value={value} onChange={e => set(e.target.value)} autoComplete={auto}
        aria-invalid={!!errors[id]} aria-describedby={errors[id] ? `${id}-err` : undefined} />
      {errors[id] && <span className="field-error" id={`${id}-err`}><Icon name="circle-alert" size={14} />{errors[id]}</span>}
    </div>
  );

  return (
    <AuthFrame>
      {mode === 'login' ? (
        <form className="auth-form" onSubmit={submit} noValidate>
          <h1 className="big-serif" style={{ fontSize: 40 }}>Selamat datang <em>kembali</em>.</h1>
          <p className="t-muted mt-2">Lanjutkan dari fase terakhirmu.</p>
          <div className="oauth mt-8"><button type="button" className="btn btn-secondary btn-lg btn-press" onClick={soon}><Icon name="chrome" />Google</button><button type="button" className="btn btn-secondary btn-lg btn-press" onClick={soon}><Icon name="school" />Akun sekolah</button></div>
          <div className="sep">atau dengan email</div>
          <div className="stack gap-4">
            {field('email', 'Email', email, setEmail, 'email', null, 'email')}
            {field('password', 'Kata sandi', pw, setPw, 'password', <button type="button" className="link t-xs" onClick={() => toast({ kind: 'accent', icon: 'info', title: 'Lupa kata sandi?', body: 'Minta admin sekolahmu untuk mengatur ulang kata sandi.' })}>Lupa?</button>, 'current-password')}
            <button className={`btn btn-primary btn-xl btn-press w-full mt-2${busy ? ' is-loading' : ''}`} type="submit">Masuk<Icon name="arrow-right" /></button>
          </div>
          <p className="t-sm t-muted mt-6 t-center">Belum punya akun? <Link className="link" to="/daftar">Daftar gratis</Link></p>
        </form>
      ) : (
        <form className="auth-form" onSubmit={submit} noValidate>
          <h1 className="big-serif" style={{ fontSize: 40 }}>Mulai perjalananmu.</h1>
          <p className="t-muted mt-2">Gratis untuk Bab 1–3. Tidak perlu kartu.</p>
          <div className="oauth mt-8"><button type="button" className="btn btn-secondary btn-lg btn-press" onClick={soon}><Icon name="chrome" />Google</button><button type="button" className="btn btn-secondary btn-lg btn-press" onClick={soon}><Icon name="school" />Akun sekolah</button></div>
          <div className="sep">atau</div>
          <div className="stack gap-4">
            {field('name', 'Nama panggilan', name, setName, 'text', null, 'nickname')}
            {field('email', 'Email', email, setEmail, 'email', null, 'email')}
            {field('password', 'Kata sandi', pw, setPw, 'password', null, 'new-password')}
            <button className={`btn btn-primary btn-xl btn-press w-full mt-2${busy ? ' is-loading' : ''}`} type="submit">Buat akun<Icon name="arrow-right" /></button>
          </div>
          <p className="t-sm t-muted mt-6 t-center">Sudah punya akun? <Link className="link" to="/masuk">Masuk</Link></p>
        </form>
      )}
    </AuthFrame>
  );
}
