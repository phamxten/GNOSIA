import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { api, ApiError } from '../api/client';
import { useApi } from '../api/hooks';
import type { Person } from '../api/types';
import { Icon } from '../design/Icon';
import { toast } from '../design/toast';
import { Avatar, LoadError, Modal, Skel } from '../design/ui';

type Users = { items: (Person & { email: string; class: string; active: string; xp: number })[]; classes: { id: number; name: string; mentor: Person | null }[] };
const ROLE: Record<string, string> = { learner: 'Siswa', mentor: 'Mentor', admin: 'Admin' };

export default function PeoplePage() {
  const [params, setParams] = useSearchParams();
  const role = params.get('peran') || '';
  const tab = params.get('tab') || 'pengguna';
  const q = useApi<Users>(`/api/admin/users${role ? `?role=${role}` : ''}`, { staleTime: 0 });
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [addClass, setAddClass] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'learner', class_id: '' });
  const [err, setErr] = useState<Record<string, string>>({});
  const [cls, setCls] = useState({ name: '', mentor_id: '' });
  if (q.error) return <div className="page page-wide"><LoadError onRetry={() => q.refetch()} /></div>;
  const rows = (q.data?.items || []).filter(u => !search || (u.name + u.email).toLowerCase().includes(search.toLowerCase()));
  const mentors = (q.data?.items || []).filter(u => u.role === 'mentor');
  const patch = async (uid: number, body: object) => {
    try { await api.patch(`/api/admin/users/${uid}`, body); q.refetch(); toast({ kind: 'success', icon: 'check', title: 'Disimpan' }); }
    catch (e) { toast({ kind: 'danger', icon: 'circle-alert', title: e instanceof ApiError ? e.message : 'Gagal menyimpan' }); }
  };
  const create = async () => {
    try {
      await api.post('/api/admin/users', { ...form, class_id: form.class_id ? Number(form.class_id) : null });
      setAdding(false); setForm({ name: '', email: '', password: '', role: 'learner', class_id: '' }); setErr({}); q.refetch();
      toast({ kind: 'success', icon: 'user-plus', title: 'Pengguna dibuat', body: 'Bagikan email dan kata sandi awalnya secara langsung.' });
    } catch (e) { setErr(e instanceof ApiError ? { ...e.fields, _: Object.keys(e.fields).length ? '' : e.message } : { _: 'Gagal membuat pengguna' }); }
  };
  const createClass = async () => {
    await api.post('/api/admin/classes', { name: cls.name, mentor_id: cls.mentor_id ? Number(cls.mentor_id) : null });
    setAddClass(false); setCls({ name: '', mentor_id: '' }); q.refetch();
  };
  return (
    <div className="page page-wide">
      <div className="page-head"><div><div className="eyebrow">Orang</div><h1 className="big-serif mt-2" style={{ fontSize: 40 }}>Pengguna &amp; <em>kelas</em></h1></div>
        <div className="row gap-2">{tab === 'kelas' ? <button className="btn btn-primary btn-press" onClick={() => setAddClass(true)}><Icon name="plus" />Kelas baru</button> : <button className="btn btn-primary btn-press" onClick={() => setAdding(true)}><Icon name="user-plus" />Tambah pengguna</button>}</div></div>
      <div className="tabs mb-4" role="tablist">
        <button className="tab" role="tab" aria-selected={tab === 'pengguna'} onClick={() => setParams({})}>Pengguna <span className="count">{q.data?.items.length ?? ''}</span></button>
        <button className="tab" role="tab" aria-selected={tab === 'kelas'} onClick={() => setParams({ tab: 'kelas' })}>Kelas <span className="count">{q.data?.classes.length ?? ''}</span></button>
      </div>
      {!q.data ? <Skel h={320} r={16} /> : tab === 'kelas' ? (
        <section className="card" style={{ overflow: 'hidden' }}><table className="table"><thead><tr><th>Kelas</th><th>Mentor</th><th className="t-right">Siswa</th></tr></thead><tbody>
          {q.data.classes.map(c => <tr key={c.id}><td className="t-medium">{c.name}</td><td>{c.mentor ? <span className="row"><Avatar p={c.mentor} size="sm" />{c.mentor.name}</span> : <span className="t-faint">–</span>}</td>
            <td className="num">{q.data!.items.filter(u => u.class === c.name && u.role === 'learner').length}</td></tr>)}
        </tbody></table></section>
      ) : (
        <section className="card" style={{ overflow: 'hidden' }}>
          <div className="p-5 row between wrap gap-3">
            <div className="input-group" style={{ width: 260 }}><Icon name="search" /><input placeholder="Cari nama atau email" value={search} onChange={e => setSearch(e.target.value)} aria-label="Cari pengguna" /></div>
            <div className="row gap-1">{([['', 'Semua'], ['learner', 'Siswa'], ['mentor', 'Mentor'], ['admin', 'Admin']] as const).map(([r, l]) => <button key={r} className="chip" aria-pressed={role === r} onClick={() => setParams(r ? { peran: r } : {})}>{l}</button>)}</div>
          </div>
          <div style={{ overflowX: 'auto' }}><table className="table"><thead><tr><th>Nama</th><th>Email</th><th>Peran</th><th>Kelas</th><th>Aktif</th><th className="t-right">XP</th></tr></thead><tbody>
            {rows.map(u => (
              <tr key={u.id}>
                <td><span className="row"><Avatar p={u} size="sm" />{u.name}</span></td><td className="t-sm t-muted">{u.email}</td>
                <td><select className="select" style={{ width: 110 }} value={u.role} onChange={e => patch(u.id, { role: e.target.value })} aria-label={`Peran ${u.name}`}>{Object.entries(ROLE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></td>
                <td><select className="select" style={{ width: 130 }} value={q.data!.classes.find(c => c.name === u.class)?.id ?? ''} onChange={e => patch(u.id, { class_id: Number(e.target.value) || 0 })} aria-label={`Kelas ${u.name}`}><option value="">–</option>{q.data!.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></td>
                <td className="t-sm t-muted">{u.active}</td><td className="num">{u.xp}</td>
              </tr>
            ))}
          </tbody></table></div>
        </section>
      )}
      <Modal open={adding} onClose={() => setAdding(false)} title="Tambah pengguna"
        foot={<><button className="btn btn-ghost" onClick={() => setAdding(false)}>Batal</button><button className="btn btn-primary btn-press" onClick={create}>Buat</button></>}>
        <div className="stack gap-3">
          {([['name', 'Nama', 'text'], ['email', 'Email', 'email'], ['password', 'Kata sandi awal', 'password']] as const).map(([k, l, t]) => (
            <div className="field" key={k}><label className="field-label" htmlFor={`u-${k}`}>{l}</label><input id={`u-${k}`} className={`input${err[k] ? ' is-invalid' : ''}`} type={t} value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} autoComplete="off" />{err[k] && <span className="field-error">{err[k]}</span>}</div>
          ))}
          <div className="grid grid-2">
            <div className="field"><label className="field-label" htmlFor="u-role">Peran</label><select id="u-role" className="select" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>{Object.entries(ROLE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
            <div className="field"><label className="field-label" htmlFor="u-class">Kelas</label><select id="u-class" className="select" value={form.class_id} onChange={e => setForm({ ...form, class_id: e.target.value })}><option value="">–</option>{q.data?.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          </div>
          {err._ && <span className="field-error">{err._}</span>}
        </div>
      </Modal>
      <Modal open={addClass} onClose={() => setAddClass(false)} title="Kelas baru"
        foot={<><button className="btn btn-ghost" onClick={() => setAddClass(false)}>Batal</button><button className="btn btn-primary btn-press" disabled={!cls.name.trim()} onClick={createClass}>Buat kelas</button></>}>
        <div className="stack gap-3">
          <div className="field"><label className="field-label" htmlFor="c-n">Nama kelas</label><input id="c-n" className="input" value={cls.name} onChange={e => setCls({ ...cls, name: e.target.value })} placeholder="XI RPL 2" /></div>
          <div className="field"><label className="field-label" htmlFor="c-m">Mentor</label><select id="c-m" className="select" value={cls.mentor_id} onChange={e => setCls({ ...cls, mentor_id: e.target.value })}><option value="">–</option>{mentors.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
        </div>
      </Modal>
    </div>
  );
}
