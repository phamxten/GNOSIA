import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import { useMe } from '../api/hooks';
import type { Me } from '../api/types';
import { Icon } from '../design/Icon';
import { Nosi, type Mood } from '../design/Nosi';
import { toast } from '../design/toast';
import { Avatar, cx, Modal, Switch } from '../design/ui';
import { burst, confetti, pop, shake, sound, xpFloat, type MotionLevel } from '../fx';
import { usePrefs, type ThemeChoice } from '../state/prefs';

/* from mockups/settings.html */
const css = `
.set { display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: 40px; }
.set-nav { position: sticky; top: 88px; align-self: start; display: flex; flex-direction: column; gap: 2px; }
.set-nav a { padding: 8px 12px; border-radius: 10px; font-size: 14px; color: var(--text-muted); }
.set-nav a:hover { background: var(--surface-hover); color: var(--text); }
.set-nav a[aria-current] { background: var(--surface); box-shadow: inset 0 0 0 1px var(--border); color: var(--text); font-weight: 500; }
.set-sec { padding: 28px; border-radius: 22px; background: var(--surface); border: 1px solid var(--border); margin-bottom: 16px; scroll-margin-top: 88px; }
.set-sec h2 { font-family: var(--font-serif); font-weight: 400; font-size: 26px; margin: 0 0 4px; }
.set-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 20px; align-items: center; padding: 16px 0; border-top: 1px solid var(--divider); }
.set-row:first-of-type { border-top: 0; }
.theme-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 16px; }
.theme-card { border-radius: 16px; border: 1.5px solid var(--border); padding: 10px; text-align: left; transition: all var(--dur-200) var(--spring-bouncy); }
.theme-card[aria-pressed="true"] { border-color: var(--accent); box-shadow: 0 0 0 4px var(--accent-soft); }
.theme-card .prev { height: 70px; border-radius: 10px; margin-bottom: 8px; display: grid; grid-template-columns: 1fr 2fr; gap: 6px; padding: 8px; }
.theme-card .prev i { border-radius: 6px; }
.intensity { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 16px; }
.intensity button { padding: 16px; border-radius: 16px; border: 1.5px solid var(--border); border-bottom-width: 4px; text-align: left; display: flex; flex-direction: column; gap: 6px; transition: all var(--dur-200) var(--spring-bouncy); }
.intensity button[aria-pressed="true"] { border-color: var(--pahami-fill); background: var(--pahami-soft); }
.preview-zone { margin-top: 16px; padding: 22px; border-radius: 16px; background: var(--surface-sunken); display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
.set > * { min-width: 0; }
@media (max-width: 900px) { .set { grid-template-columns: 1fr; } .set-nav { display: none; } .theme-cards, .intensity { grid-template-columns: 1fr; } }
@media (max-width: 600px) { .set-sec { padding: 20px 16px; } .set-row { grid-template-columns: 1fr; } .set-sec .row { flex-wrap: wrap; } .segmented { flex-wrap: wrap; } }
`;

export default function Pengaturan() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const nav = useNavigate();
  const loc = useLocation();
  const p = usePrefs();
  const [active, setActive] = useState('tampilan');
  const [editName, setEditName] = useState(false);
  const [name, setName] = useState('');
  const [del, setDel] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [delErr, setDelErr] = useState('');
  const [mood, setMood] = useState<Mood>('happy');
  const [bump, setBump] = useState(0);
  const okRef = useRef<HTMLButtonElement>(null), noRef = useRef<HTMLButtonElement>(null);
  const learner = me?.role === 'learner';

  useEffect(() => { if (loc.hash) { setActive(loc.hash.slice(1)); document.querySelector(loc.hash)?.scrollIntoView({ behavior: 'smooth' }); } }, [loc.hash]);

  const patch = async (body: Partial<{ name: string; daily_goal_min: number; prefs: Record<string, unknown> }>) => {
    try { const u = await api.patch<Me>('/api/me', body); qc.setQueryData(['/api/me'], u); return true; }
    catch { toast({ kind: 'danger', icon: 'circle-alert', title: 'Gagal menyimpan', body: 'Coba lagi.' }); return false; }
  };
  const setIntensity = (m: MotionLevel, label: string) => { p.setMotion(m); toast({ kind: 'accent', icon: 'wind', title: `Intensitas animasi: ${label}`, body: 'Coba tombol di bawah untuk merasakannya.' }); };
  const themeNow: ThemeChoice = p.theme;
  const deleteAccount = async () => {
    try { await api.del('/api/me', { confirm: confirmText }); qc.clear(); nav('/', { replace: true }); }
    catch (e) { setDelErr(e instanceof ApiError ? e.fields.confirm || e.message : 'Gagal menghapus akun.'); }
  };
  if (!me) return null;
  const sections = [['akun', 'Akun'], ['tampilan', 'Tampilan'], ['motion', 'Animasi & suara'], ...(learner ? [['belajar', 'Belajar'], ['privasi', 'Privasi']] : [])];

  return (
    <main className="page" style={{ maxWidth: 1040 }}>
      <style>{css}</style>
      <div className="page-head"><div><div className="eyebrow">Pengaturan</div><h1 className="big-serif mt-2" style={{ fontSize: 44 }}>Atur GNOSIA <em>sesukamu</em>.</h1></div></div>
      <div className="set">
        <nav className="set-nav" aria-label="Bagian pengaturan">{sections.map(([id, l]) => <a key={id} href={`#${id}`} aria-current={active === id ? 'true' : undefined} onClick={() => setActive(id)}>{l}</a>)}</nav>
        <div>
          <section className="set-sec" id="akun">
            <h2>Akun</h2>
            <div className="row gap-4 mt-4"><Avatar p={me} size="lg" style={{ width: 64, height: 64, fontSize: 20 }} />
              <div className="grow"><div className="t-h4">{me.name}</div><div className="t-sm t-muted">{me.email}{me.class ? ` · ${me.class.name}` : ''}{me.org ? ` · ${me.org}` : ''}</div></div>
              <button className="btn btn-secondary btn-press" onClick={() => { setName(me.name); setEditName(true); }}>Ubah</button></div>
          </section>

          <section className="set-sec" id="tampilan">
            <h2>Tampilan</h2><p className="t-sm t-muted">Tema berlaku untuk semua halaman dan kode.</p>
            <div className="theme-cards" role="radiogroup">
              {([['paper', 'Paper', 'terang, hangat'], ['ink', 'Ink', 'gelap, lembut'], ['system', 'Ikuti perangkat', 'otomatis']] as const).map(([t, l, s]) => (
                <button key={t} className="theme-card" role="radio" aria-checked={themeNow === t} aria-pressed={themeNow === t} onClick={e => { p.setTheme(t); pop(e.currentTarget); }}>
                  {t === 'system'
                    ? <div className="prev" style={{ background: 'linear-gradient(90deg,#F7F6F2 50%,#16171B 50%)', border: '1px solid var(--border)' }} />
                    : <div className="prev" data-theme={t} style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}><i style={{ background: 'var(--surface-sunken)' }} /><i style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} /></div>}
                  <b className="t-sm">{l}</b><div className="t-xs t-faint">{s}</div>
                </button>
              ))}
            </div>
          </section>

          <section className="set-sec" id="motion">
            <h2>Animasi &amp; suara</h2><p className="t-sm t-muted">Animasi di GNOSIA selalu menandakan sesuatu. Pilih seberapa ramai yang nyaman untukmu.</p>
            <div className="intensity" role="radiogroup">
              {([['full', 'sparkles', 'Penuh', 'Partikel, konfeti, tilt, Nosi bergerak'], ['calm', 'wind', 'Kalem', 'Transisi halus saja, tanpa efek ramai'], ['off', 'pause', 'Mati', 'Hanya warna dan teks. Mengikuti “kurangi gerakan”.']] as const).map(([m, ic, l, s]) => (
                <button key={m} role="radio" aria-checked={p.motion === m} aria-pressed={p.motion === m} onClick={() => setIntensity(m, l)}><Icon name={ic} className="t-accent" /><b>{l}</b><span className="t-xs t-muted">{s}</span></button>
              ))}
            </div>
            <div className="preview-zone">
              <Nosi mood={mood} bump={bump} force />
              <button ref={okRef} className="btn btn-ok btn-lg btn-press" onClick={() => { burst(okRef.current); pop(okRef.current); setMood('happy'); setBump(b => b + 1); xpFloat(okRef.current, '+10 XP'); sound('ok'); }}>Coba: jawaban benar</button>
              <button ref={noRef} className="btn btn-secondary btn-lg btn-press" onClick={() => { shake(noRef.current); setMood('oops'); setBump(b => b + 1); sound('no'); }}>Coba: jawaban salah</button>
              <button className="btn btn-ghost btn-lg" onClick={() => { confetti(); setMood('cheer'); setBump(b => b + 1); sound('done'); }}>Coba: fase selesai</button>
            </div>
            <div className="set-row mt-2"><div><div className="t-h4">Suara efek</div><div className="t-sm t-muted">Bunyi pendek saat benar, salah, dan selesai.</div></div>
              <Switch checked={p.sound} label="Suara efek" onChange={v => { p.setSound(v); if (v) sound('ok'); }} /></div>
            <div className="set-row"><div><div className="t-h4">Tampilkan Nosi</div><div className="t-sm t-muted">Maskot di pelajaran. Petunjuk tetap tersedia walau Nosi disembunyikan.</div></div>
              <Switch checked={p.nosi} label="Tampilkan Nosi" onChange={v => { p.setNosi(v); patch({ prefs: { nosi: v } }); }} /></div>
          </section>

          {learner && (
            <section className="set-sec" id="belajar">
              <h2>Belajar</h2>
              <div className="set-row"><div><div className="t-h4">Target harian</div><div className="t-sm t-muted">Dipakai untuk streak dan pengingat.</div></div>
                <div className="segmented" role="radiogroup">{[5, 10, 20, 30].map(m => <button key={m} role="radio" aria-checked={me.daily_goal_min === m} aria-pressed={me.daily_goal_min === m} onClick={() => patch({ daily_goal_min: m })}>{m} mnt</button>)}</div></div>
              <div className="set-row"><div><div className="t-h4">Bahasa antarmuka</div><div className="t-sm t-muted">Kode dan istilah teknis tetap dalam bahasa aslinya.</div></div>
                <select className="select" style={{ width: 180 }} value="id" onChange={() => toast({ kind: 'accent', icon: 'info', title: 'English segera hadir' })} aria-label="Bahasa"><option value="id">Bahasa Indonesia</option><option value="en">English (segera)</option></select></div>
              <div className="set-row"><div><div className="t-h4">Pengingat belajar</div><div className="t-sm t-muted">Notifikasi pukul 19.00 jika target belum tercapai.</div></div>
                <Switch checked={me.prefs.reminders !== false} label="Pengingat" onChange={v => patch({ prefs: { reminders: v } })} /></div>
            </section>
          )}

          {learner && (
            <section className="set-sec" id="privasi">
              <h2>Privasi</h2>
              <div className="set-row"><div><div className="t-h4">Mentor dapat melihat jawaban salah</div><div className="t-sm t-muted">Membantu mentor tahu di mana kamu macet.</div></div>
                <Switch checked={me.prefs.mentor_sees_wrong !== false} label="Mentor melihat jawaban" onChange={v => patch({ prefs: { mentor_sees_wrong: v } })} /></div>
              <div className="set-row"><div><div className="t-h4" style={{ color: 'var(--danger)' }}>Hapus akun</div><div className="t-sm t-muted">Progres, proyek, dan notebook dihapus permanen.</div></div>
                <button className="btn btn-danger" onClick={() => { setConfirmText(''); setDelErr(''); setDel(true); }}>Hapus…</button></div>
            </section>
          )}
        </div>
      </div>

      <Modal open={editName} onClose={() => setEditName(false)} title="Ubah nama panggilan"
        foot={<><button className="btn btn-ghost" onClick={() => setEditName(false)}>Batal</button><button className="btn btn-primary btn-press" onClick={async () => { if (name.trim() && await patch({ name })) { setEditName(false); toast({ kind: 'success', icon: 'check', title: 'Nama disimpan' }); } }}>Simpan</button></>}>
        <div className="field"><label className="field-label" htmlFor="nm">Nama panggilan</label><input id="nm" className="input input-lg" value={name} onChange={e => setName(e.target.value)} autoFocus /></div>
      </Modal>
      <Modal open={del} onClose={() => setDel(false)} title="Hapus akun?" role="alertdialog"
        foot={<><button className="btn btn-ghost" onClick={() => setDel(false)}>Batal</button><button className={cx('btn btn-no btn-press')} disabled={!confirmText} onClick={deleteAccount}>Hapus permanen</button></>}>
        <p>Semua progres, XP, proyek, dan notebook akan dihapus dan tidak bisa dikembalikan. Ketik email akunmu (<b>{me.email}</b>) untuk konfirmasi.</p>
        <input className={cx('input input-lg mt-3 w-full', delErr && 'is-invalid')} value={confirmText} onChange={e => setConfirmText(e.target.value)} aria-label="Konfirmasi email" />
        {delErr && <span className="field-error mt-2"><Icon name="circle-alert" size={14} />{delErr}</span>}
      </Modal>
    </main>
  );
}
