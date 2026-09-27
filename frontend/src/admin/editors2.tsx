import { Fragment, useState } from 'react';
import { Icon } from '../design/Icon';
import { cx } from '../design/ui';
import { Html } from '../lib/html';
import { Area, ConceptChips, Field, Num, StringList, Text } from './fields';

type Concept = { key: string; name: string };
type Q = { id: string; t: string; c?: string; o: string[]; a: number; e: string; trivia?: boolean; concepts?: string[] };
export type KuisCfg = { round_size: number; seconds: number; pass_pct: number; combo_max: number; bank: Q[] };
type Test = { id: string; name: string; kind: string; pattern?: string; expr?: string; equals?: string | number; line?: number; text?: string; trim?: boolean; fail?: string; hidden?: boolean; weight?: number };
export type ChallengeCfg = { title: string; minutes: number; difficulty: string; filename: string; story: string; steps: string[]; starter: string;
  art?: { kind: string; title: string; name: string; value: string }; tests: Test[]; concepts?: string[]; assist?: string; related_scene?: string };
type EQ = { id: string; label?: string; t: string; code?: string; type: 'choice' | 'short' | 'code'; o?: string[]; pts: number; answer?: number; accept?: string[]; tests?: Test[]; concepts?: string[] };
export type ExamCfg = { minutes: number; pass_mark: number; questions: EQ[] };

const nid = (p: string) => `${p}${Math.random().toString(36).slice(2, 7)}`;

export function KuisEditor({ k, onChange, concepts, stats }: { k: KuisCfg; onChange: (k: KuisCfg) => void; concepts: Concept[]; stats: Record<string, { n: number; wrong_pct: number }> }) {
  const [open, setOpen] = useState<string | null>(null);
  const setQ = (id: string, patch: Partial<Q>) => onChange({ ...k, bank: k.bank.map(q => (q.id === id ? { ...q, ...patch } : q)) });
  return (
    <div>
      <div className="row between"><span className="phase-tag" data-phase="kuis">Kuis · bank soal</span>
        <button className="btn btn-secondary btn-sm btn-press" onClick={() => { const q: Q = { id: nid('k'), t: 'Pertanyaan baru', o: ['A', 'B', 'C', 'D'], a: 0, e: '', concepts: [] }; onChange({ ...k, bank: [...k.bank, q] }); setOpen(q.id); }}><Icon name="plus" />Soal</button></div>
      <div className="b-sec form-grid">
        <Field label="Soal per ronde"><Num value={k.round_size} min={1} onChange={v => onChange({ ...k, round_size: v })} /></Field>
        <Field label="Waktu per soal (detik)"><Num value={k.seconds} min={5} onChange={v => onChange({ ...k, seconds: v })} /></Field>
        <Field label="Nilai lulus gerbang (%)"><Num value={k.pass_pct} min={1} max={100} onChange={v => onChange({ ...k, pass_pct: v })} /></Field>
        <Field label="Combo maksimum"><select className="select" value={k.combo_max} onChange={e => onChange({ ...k, combo_max: Number(e.target.value) })}><option value={3}>×3</option><option value={2}>×2</option><option value={1}>tanpa combo</option></select></Field>
      </div>
      {k.bank.length < k.round_size * 2 && <div className="callout callout-warning mt-4"><Icon name="triangle-alert" /><div className="t-sm">Bank sebaiknya minimal 2× ukuran ronde ({k.round_size * 2} soal) supaya kuis ulang terasa baru. Sekarang {k.bank.length}.</div></div>}
      <div className="card mt-6" style={{ overflow: 'hidden' }}><table className="table"><thead><tr><th>Soal</th><th>Tipe</th><th className="t-right">Benar</th><th /></tr></thead><tbody>
        {k.bank.map(q => {
          const st = stats[q.id];
          const right = st && st.n >= 3 ? 100 - st.wrong_pct : null;
          return (
            <Fragment key={q.id}>
              <tr>
                <td className="t-sm"><Html html={q.t} /></td>
                <td>{q.trivia ? <span className="badge badge-warning"><Icon name="sparkles" />trivia</span> : <span className="badge">{q.c ? 'tebak output' : 'konsep'}</span>}</td>
                <td className={cx('num', right !== null && right < 45 && 't-danger')}>{right === null ? '–' : `${right}%`}</td>
                <td>{right !== null && right <= 20 ? <span className="badge badge-danger">tinjau</span> : null}<button className="btn btn-ghost btn-icon btn-sm" aria-label="Ubah" onClick={() => setOpen(open === q.id ? null : q.id)}><Icon name="pencil" size={14} /></button></td>
              </tr>
              {open === q.id && (
                <tr><td colSpan={4} style={{ background: 'var(--surface-sunken)' }}>
                  <div className="form-grid">
                    <Field label="Pertanyaan" full><Text value={q.t} onChange={v => setQ(q.id, { t: v })} /></Field>
                    <Field label="Kode (opsional)" full><Area mono rows={2} value={q.c} onChange={v => setQ(q.id, { c: v || undefined })} /></Field>
                    {q.o.map((o, i) => <Field key={i} label={`Pilihan ${'ABCD'[i]}`}><div className="row gap-2"><input className="input grow" value={o} onChange={e => setQ(q.id, { o: q.o.map((x, j) => (j === i ? e.target.value : x)) })} /><label className="check t-xs"><input type="radio" checked={q.a === i} onChange={() => setQ(q.id, { a: i })} />benar</label></div></Field>)}
                    <Field label="Pembahasan" full><Area value={q.e} onChange={v => setQ(q.id, { e: v })} rows={2} /></Field>
                    <Field label="Fakta seru"><label className="check"><input type="checkbox" checked={!!q.trivia} onChange={e => setQ(q.id, { trivia: e.target.checked || undefined })} />Tandai sebagai trivia</label></Field>
                    <Field label="Konsep"><ConceptChips all={concepts} value={q.concepts || []} onChange={v => setQ(q.id, { concepts: v })} /></Field>
                  </div>
                  <div className="row between mt-3"><button className="btn btn-danger btn-sm" onClick={() => { onChange({ ...k, bank: k.bank.filter(x => x.id !== q.id) }); setOpen(null); }}><Icon name="trash-2" />Hapus soal</button><button className="btn btn-secondary btn-sm" onClick={() => setOpen(null)}>Selesai</button></div>
                </td></tr>
              )}
            </Fragment>
          );
        })}
      </tbody></table></div>
    </div>
  );
}

const TEST_KINDS: [string, string][] = [['source_regex', 'kode cocok pola'], ['source_absent', 'kode TIDAK memuat'], ['expr', 'ekspresi bernilai true'], ['stdout_last', 'output terakhir persis'], ['stdout_line', 'output baris ke-n persis'], ['stdout_count', 'jumlah baris output'], ['stdout_includes', 'output memuat teks'], ['no_error', 'tanpa error']];

function TestRow({ t, onChange, onRemove }: { t: Test; onChange: (t: Test) => void; onRemove: () => void }) {
  const spec = t.kind === 'source_regex' || t.kind === 'source_absent' ? <input className="input" value={t.pattern || ''} placeholder="regex, mis. const\s+skor" onChange={e => onChange({ ...t, pattern: e.target.value })} />
    : t.kind === 'expr' ? <input className="input" value={t.expr || ''} placeholder="skor === 6" onChange={e => onChange({ ...t, expr: e.target.value })} />
      : t.kind === 'stdout_line' ? <div className="row gap-1"><input className="input" style={{ width: 54 }} type="number" value={t.line || 1} onChange={e => onChange({ ...t, line: Number(e.target.value) })} /><input className="input grow" value={String(t.equals ?? '')} onChange={e => onChange({ ...t, equals: e.target.value })} /></div>
        : t.kind === 'stdout_count' ? <input className="input" type="number" value={Number(t.equals ?? 1)} onChange={e => onChange({ ...t, equals: Number(e.target.value) })} />
          : t.kind === 'stdout_includes' ? <input className="input" value={t.text || ''} onChange={e => onChange({ ...t, text: e.target.value })} />
            : t.kind === 'stdout_last' ? <input className="input" value={String(t.equals ?? '')} onChange={e => onChange({ ...t, equals: e.target.value })} /> : <span className="t-xs t-faint">–</span>;
  return (
    <tr>
      <td><input className="input" value={t.name} onChange={e => onChange({ ...t, name: e.target.value })} aria-label="Nama untuk siswa" /></td>
      <td><select className="select" value={t.kind} onChange={e => onChange({ ...t, kind: e.target.value })}>{TEST_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select><div className="mt-1">{spec}</div></td>
      <td><input className="input" value={t.fail || ''} placeholder="skor akhir ${skor}" onChange={e => onChange({ ...t, fail: e.target.value })} aria-label="Pesan gagal" /></td>
      <td><label className="switch"><input type="checkbox" checked={!!t.hidden} onChange={e => onChange({ ...t, hidden: e.target.checked })} aria-label="Tersembunyi" /></label></td>
      <td><button className="btn btn-ghost btn-icon btn-sm" aria-label="Hapus tes" onClick={onRemove}><Icon name="x" /></button></td>
    </tr>
  );
}

export function TestsTable({ tests, onChange }: { tests: Test[]; onChange: (t: Test[]) => void }) {
  return (
    <>
      <div className="card mt-2" style={{ overflow: 'auto' }}><table className="table tc-table"><thead><tr><th>Nama untuk siswa</th><th>Pemeriksaan</th><th>Pesan jika gagal</th><th>Tersembunyi</th><th /></tr></thead><tbody>
        {tests.map((t, i) => <TestRow key={t.id} t={t} onChange={n => onChange(tests.map((x, j) => (j === i ? n : x)))} onRemove={() => onChange(tests.filter((_, j) => j !== i))} />)}
      </tbody></table></div>
      <button className="btn btn-ghost btn-sm mt-2" onClick={() => onChange([...tests, { id: nid('t'), name: 'Tes baru', kind: 'stdout_last', equals: '', fail: 'output "${last}"' }])}><Icon name="plus" />Tes</button>
      <p className="t-xs t-faint mt-2">Pesan gagal boleh memakai <span className="t-mono">{'${ekspresi}'}</span> yang dihitung dari program siswa, dan <span className="t-mono">{'${last}'}</span> untuk baris output terakhir. Output dibandingkan tanpa spasi di akhir baris.</p>
    </>
  );
}

export function ChallengeEditor({ c, onChange, concepts }: { c: ChallengeCfg | null; onChange: (c: ChallengeCfg | null) => void; concepts: Concept[] }) {
  if (!c) return (
    <div><span className="phase-tag" data-phase="uji">Uji · Challenge</span>
      <div className="card mt-4"><div className="empty"><div className="empty-glyph"><Icon name="swords" /></div><div className="t-h4">Belum ada challenge</div><p>Challenge adalah tugas coding dengan robot penguji.</p>
        <button className="btn btn-primary btn-press" onClick={() => onChange({ title: 'Challenge baru', minutes: 10, difficulty: 'sedang', filename: 'main.js', story: '', steps: [''], starter: '// tulis kodemu di sini\n', tests: [], concepts: [], assist: 'L1', art: { kind: 'board', title: 'CHALLENGE', name: 'program', value: '?' } })}><Icon name="plus" />Buat challenge</button></div></div>
    </div>
  );
  const set = (p: Partial<ChallengeCfg>) => onChange({ ...c, ...p });
  return (
    <div>
      <div className="row between"><span className="phase-tag" data-phase="uji">Uji · Challenge</span><button className="btn btn-danger btn-sm" onClick={() => onChange(null)}><Icon name="trash-2" />Hapus challenge</button></div>
      <div className="b-sec form-grid">
        <Field label="Judul"><Text value={c.title} onChange={v => set({ title: v })} /></Field>
        <Field label="Tingkat"><div className="segmented">{['mudah', 'sedang', 'sulit'].map(d => <button key={d} aria-pressed={c.difficulty === d} onClick={() => set({ difficulty: d })}>{d[0].toUpperCase() + d.slice(1)}</button>)}</div></Field>
        <Field label="Cerita" full><Area value={c.story} onChange={v => set({ story: v })} rows={3} /></Field>
        <Field label="Langkah" full><StringList items={c.steps} onChange={v => set({ steps: v })} addLabel="Langkah" /></Field>
        <Field label="Perkiraan waktu (menit)"><Num value={c.minutes} onChange={v => set({ minutes: v })} /></Field>
        <Field label="Nama file"><Text mono value={c.filename} onChange={v => set({ filename: v })} /></Field>
        <Field label="Bantuan maksimum"><select className="select" value={c.assist || 'L1'} onChange={e => set({ assist: e.target.value })}><option value="L1">L1 · penanda baris</option><option value="L0">L0 · tanpa bantuan</option></select></Field>
        <Field label="Gambar cerita (judul · nama · angka)"><div className="row gap-1"><Text value={c.art?.title} onChange={v => set({ art: { kind: 'board', name: c.art?.name || '', value: c.art?.value || '', title: v } })} /><Text value={c.art?.name} onChange={v => set({ art: { kind: 'board', title: c.art?.title || '', value: c.art?.value || '', name: v } })} /><Text value={c.art?.value} onChange={v => set({ art: { kind: 'board', title: c.art?.title || '', name: c.art?.name || '', value: v } })} /></div></Field>
      </div>
      <div className="b-sec"><span className="eyebrow">Kode awal</span><Area mono rows={6} value={c.starter} onChange={v => set({ starter: v })} /></div>
      <div className="b-sec"><span className="eyebrow">Tes (robot penguji)</span><TestsTable tests={c.tests} onChange={v => set({ tests: v })} /></div>
      <div className="b-sec"><span className="eyebrow">Konsep yang diuji</span><ConceptChips all={concepts} value={c.concepts || []} onChange={v => set({ concepts: v })} /></div>
    </div>
  );
}

export function ExamEditor({ ex, onChange, concepts }: { ex: ExamCfg; onChange: (e: ExamCfg) => void; concepts: Concept[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const total = ex.questions.reduce((a, q) => a + (q.pts || 0), 0);
  const setQ = (id: string, p: Partial<EQ>) => onChange({ ...ex, questions: ex.questions.map(q => (q.id === id ? { ...q, ...p } : q)) });
  return (
    <div>
      <div className="row between"><span className="phase-tag" data-phase="uji">Uji · Ulangan</span>
        <button className="btn btn-secondary btn-sm btn-press" onClick={() => { const q: EQ = { id: nid('u'), t: 'Pertanyaan baru', type: 'choice', o: ['A', 'B', 'C', 'D'], answer: 0, pts: 10, concepts: [] }; onChange({ ...ex, questions: [...ex.questions, q] }); setOpen(q.id); }}><Icon name="plus" />Soal</button></div>
      <div className="b-sec form-grid">
        <Field label="Durasi (menit)"><Num value={ex.minutes} onChange={v => onChange({ ...ex, minutes: v })} /></Field>
        <Field label="Nilai lulus (dari 100)"><Num value={ex.pass_mark} onChange={v => onChange({ ...ex, pass_mark: v })} /></Field>
      </div>
      {total !== 100 && ex.questions.length > 0 && <div className="callout mt-3"><Icon name="info" /><div className="t-sm">Total poin {total}. Nilai akhir tetap dihitung sebagai persentase dari total.</div></div>}
      <div className="stack gap-2 mt-4">
        {ex.questions.map((q, i) => (
          <div className="card" key={q.id}>
            <div className="p-4 row between" style={{ cursor: 'pointer' }} onClick={() => setOpen(open === q.id ? null : q.id)}>
              <div className="row gap-2"><span className="t-mono t-xs t-faint">{i + 1}</span><span className="badge">{q.type === 'choice' ? 'pilihan' : q.type === 'short' ? 'isian' : 'kode'}</span><Html className="t-sm" html={q.label || q.t} /></div>
              <span className="t-mono t-xs">{q.pts} poin</span>
            </div>
            {open === q.id && (
              <div className="p-4" style={{ borderTop: '1px solid var(--divider)' }}>
                <div className="form-grid">
                  <Field label="Tipe"><select className="select" value={q.type} onChange={e => setQ(q.id, { type: e.target.value as EQ['type'] })}><option value="choice">Pilihan ganda</option><option value="short">Isian singkat</option><option value="code">Tulis kode</option></select></Field>
                  <Field label="Poin"><Num value={q.pts} onChange={v => setQ(q.id, { pts: v })} /></Field>
                  <Field label="Pertanyaan" full><Text value={q.t} onChange={v => setQ(q.id, { t: v })} /></Field>
                  <Field label="Label di hasil"><Text value={q.label} onChange={v => setQ(q.id, { label: v })} /></Field>
                  <Field label="Kode di soal (opsional)"><Area mono rows={2} value={q.code} onChange={v => setQ(q.id, { code: v || undefined })} /></Field>
                  {q.type === 'choice' && (q.o || ['', '', '', '']).map((o, j) => <Field key={j} label={`Pilihan ${'ABCD'[j]}`}><div className="row gap-2"><input className="input grow" value={o} onChange={e => setQ(q.id, { o: (q.o || ['', '', '', '']).map((x, k) => (k === j ? e.target.value : x)) })} /><label className="check t-xs"><input type="radio" checked={q.answer === j} onChange={() => setQ(q.id, { answer: j })} />benar</label></div></Field>)}
                  {q.type === 'short' && <Field label="Jawaban yang diterima (satu per baris)" full><Area mono rows={2} value={(q.accept || []).join('\n')} onChange={v => setQ(q.id, { accept: v.split('\n').map(x => x.trim()).filter(Boolean) })} /></Field>}
                  <Field label="Konsep" full><ConceptChips all={concepts} value={q.concepts || []} onChange={v => setQ(q.id, { concepts: v })} /></Field>
                </div>
                {q.type === 'code' && <div className="mt-3"><span className="eyebrow">Tes otomatis setelah dikumpulkan</span><TestsTable tests={q.tests || []} onChange={v => setQ(q.id, { tests: v })} /></div>}
                <button className="btn btn-danger btn-sm mt-3" onClick={() => onChange({ ...ex, questions: ex.questions.filter(x => x.id !== q.id) })}><Icon name="trash-2" />Hapus soal</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
