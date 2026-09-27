import type { Exercise, Scene, Visual } from '../api/types';
import { Icon } from '../design/Icon';
import { cx } from '../design/ui';
import { Area, ConceptChips, Field, JsonArea, Num, StringList, Text } from './fields';

type Concept = { key: string; name: string };
type AnyItem = Exercise & { answer?: unknown; hints?: { l3?: string; l4?: string; l5?: string }; l6?: string; explain?: string; similar_id?: string; diagnosis?: string };

export const VISUALS: [Visual['type'], string, string][] = [
  ['intro', 'box', 'Pengantar'], ['tokens', 'hand', 'Token diklik'], ['livecode', 'code-xml', 'Kode hidup'], ['trychange', 'lock', 'let vs const'],
  ['cards', 'layout-grid', 'Kartu contoh'], ['knobcalc', 'calculator', 'Dua knob'], ['code', 'terminal', 'Kode + output'], ['shelf', 'layout-list', 'Rak array'], ['summary', 'list-checks', 'Ringkasan'],
];

export const VISUAL_TEMPLATE: Record<Visual['type'], Visual> = {
  intro: { type: 'intro', side: { kind: 'box', tag: 'nama', val: '"Ana"', type: 'string' }, objectives_label: 'Setelah bagian ini kamu bisa', objectives: ['Tujuan pertama'] },
  tokens: { type: 'tokens', tokens: [{ text: 'let', cls: 'k', key: 'kw', explain: 'Kata kunci.', effect: 'pop' }, { text: 'x', key: 'name', explain: 'Nama kotak.', effect: 'tag' }, { text: '=', cls: 'pn', key: 'eq', explain: 'Masukkan nilai.', effect: 'fly' }, { text: '1', cls: 'n', key: 'val', explain: 'Nilainya.', effect: 'fly' }], suffix: ';', target: { kind: 'box', tag: 'x', val: '1', type: 'kotak baru' }, start: 'Mulai dari kiri.' },
  livecode: { type: 'livecode', file: 'kode.js', lines: ['let x = {{knob}};', 'console.log(x);'], lit: [1], knob: { min: 0, max: 10, step: 1, value: 3, label: 'nilai x' }, outputs: ['{{v}}'] },
  trychange: { type: 'trychange', boxes: [{ tag: 'a', val: '1', alt: '2', kind: 'let', button: 'a = 2' }, { tag: 'b', val: '1', kind: 'const', button: 'b = 2' }], error: 'TypeError: Assignment to constant variable.' },
  cards: { type: 'cards', cards: [{ label: 'Boleh', code: 'contoh', tone: 'ok', note: 'Kenapa boleh.' }, { label: 'Tidak boleh', code: 'contoh', tone: 'bad', note: 'Kenapa tidak.' }] },
  knobcalc: { type: 'knobcalc', file: 'hitung.js', lines: ['const a = {{a}};', 'const b = {{b}};', 'const hasil = a * b;'], lit: [3], knobs: { a: { min: 1, max: 10, step: 1, value: 2 }, b: { min: 1, max: 10, step: 1, value: 3 } }, formula: { a: 'a', op: '*', b: 'b' }, result: 'hasil', output_prefix: '' },
  code: { type: 'code', file: 'kode.js', lines: ['console.log("Halo");'], outputs: ['Halo'] },
  shelf: { type: 'shelf', name: 'nilai', items: [80, 72, 91], hot: 1 },
  summary: { type: 'summary', cards: [{ icon: 'box', title: 'Poin penting', body: 'Penjelasan singkat.' }], callout: { icon: 'arrow-right-circle', html: '<b>Berikutnya: Perkuat.</b>' } },
};

export const TYPES: [Exercise['type'], string, string][] = [
  ['choice', 'list', 'Pilih'], ['fill', 'puzzle', 'Lengkapi'], ['predict', 'terminal', 'Tebak output'], ['parsons', 'arrow-down-up', 'Susun baris'],
  ['bug', 'bug', 'Temukan bug'], ['slider', 'sliders-horizontal', 'Atur nilai'], ['match', 'link', 'Pasangkan'],
];

export function itemTemplate(type: Exercise['type'], id: string): AnyItem {
  const base = { id, type, title: 'Pertanyaan baru', hints: { l3: '' }, explain: '', concepts: [] as string[], has_hints: [], has_solution: false } as AnyItem;
  switch (type) {
    case 'choice': return { ...base, choices: ['A', 'B', 'C', 'D'], answer: 0 };
    case 'predict': return { ...base, title: 'Apa yang dicetak?', code: 'console.log(1 + 1);', choices: ['2', '11', '1 + 1', 'error'], cols: 2, answer: 0 };
    case 'fill': return { ...base, code: '{{slot}} x = 1;', tray: [{ val: 'let', label: 'let' }, { val: 'const', label: 'const' }], answer: ['let'] };
    case 'parsons': return { ...base, lines: [{ id: '2', code: 'console.log(x);' }, { id: '1', code: 'let x = 1;' }], answer: ['1', '2'] };
    case 'bug': return { ...base, title: 'Program ini error. Ketuk baris penyebabnya.', lines: ['const a = 1;', 'a = 2;'], error: 'TypeError: Assignment to constant variable.', answer: 2 };
    case 'slider': return { ...base, code: 'const harga = 2000;\nlet jumlah = {{v}};\nconst total = harga * jumlah;', lit: [2], min: 1, max: 10, value: 1, var: 'jumlah', result: { label: 'total', mul: 2000 }, target: 10000, answer: 5 };
    case 'match': return { ...base, left: [{ key: 'a', text: 'Maksud A' }, { key: 'b', text: 'Maksud B' }], right: [{ key: 'b', text: 'kode B' }, { key: 'a', text: 'kode A' }], right_code: true };
  }
}

// ---------------------------------------------------------------- scene
export function SceneEditor({ s, onChange, concepts, stat, onPlay }: { s: Scene; onChange: (s: Scene) => void; concepts: Concept[]; stat?: number; onPlay: () => void }) {
  const set = <K extends keyof Scene>(k: K, v: Scene[K]) => onChange({ ...s, [k]: v });
  const vtype = s.visual?.type;
  return (
    <div>
      <div className="row gap-2"><span className="phase-tag" data-phase="pahami">Pahami · scene</span>{stat !== undefined && <span className="t-xs t-faint">{stat}% siswa berhenti di scene ini</span>}</div>
      <div className="mt-3"><Text big value={s.title} onChange={v => set('title', v)} label="Judul scene" /></div>
      <div className="b-sec form-grid">
        <Field label="Kicker (label kecil)"><Text value={s.kicker} onChange={v => set('kicker', v)} placeholder="kosong = nama bab + durasi" /></Field>
        <Field label="Syarat lanjut"><select className="select" value={s.advance || 'free'} onChange={e => set('advance', e.target.value as Scene['advance'])}><option value="free">Bebas</option><option value="all_tokens">Semua token sudah diklik</option></select></Field>
        <Field label="Narasi" full><Area value={s.say} onChange={v => set('say', v || undefined)} rows={2} /></Field>
        <Field label="Lead (paragraf pembuka, opsional)" full><Area value={s.lead} onChange={v => set('lead', v || undefined)} rows={2} /></Field>
      </div>
      <div className="b-sec"><span className="eyebrow">Visual</span>
        <div className="types">
          {VISUALS.map(([t, ic, l]) => <button key={t} aria-pressed={vtype === t} onClick={() => set('visual', structuredClone(VISUAL_TEMPLATE[t]))}><Icon name={ic} style={{ color: 'var(--pahami-ink)' }} /><b>{l}</b></button>)}
        </div>
        {s.visual && <div className="mt-3"><Field label="Parameter visual (JSON)" help="Kode di baris memakai {{knob}} atau {{nama}} untuk angka yang bisa digeser. Teks boleh berisi <b>, <i>, <span class=&quot;ic&quot;>."><JsonArea value={s.visual} onChange={v => set('visual', v as Visual)} label="Parameter visual" /></Field></div>}
      </div>
      <div className="b-sec"><div className="row between"><span className="eyebrow" style={{ margin: 0 }}>Langkah animasi</span><button className="btn btn-ghost btn-sm" onClick={() => set('steps', [...(s.steps || []), { desc: '', trigger: 'next' }])}><Icon name="plus" />Langkah</button></div>
        <div className="mt-2">
          {(s.steps || []).map((st, i) => (
            <div className="step" key={i}>
              <span className="handle"><Icon name="grip-vertical" size={14} /></span><span className="sn">{i + 1}</span>
              <input className="input" value={st.desc} placeholder="Apa yang terjadi di langkah ini?" onChange={e => set('steps', s.steps!.map((x, j) => (j === i ? { ...x, desc: e.target.value } : x)))} />
              <select className="select" value={st.trigger} onChange={e => set('steps', s.steps!.map((x, j) => (j === i ? { ...x, trigger: e.target.value } : x)))}><option value="token">saat klik token</option><option value="auto">otomatis</option><option value="next">saat klik Lanjut</option></select>
              <button className="btn btn-ghost btn-icon btn-sm" aria-label="Putar di pratinjau" onClick={onPlay}><Icon name="play" /></button>
            </div>
          ))}
          {!(s.steps || []).length && <p className="t-xs t-faint">Belum ada langkah. Langkah membantu tim menjelaskan urutan animasi.</p>}
        </div>
      </div>
      <div className="b-sec"><span className="eyebrow">Cek cepat (tap untuk buka)</span>
        {(s.reveals || []).map((r, i) => (
          <div className="grid grid-2 mt-2" key={i} style={{ gap: 8 }}>
            <input className="input" value={r.q} placeholder="Pertanyaan" onChange={e => set('reveals', s.reveals!.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} />
            <div className="row gap-2"><input className="input grow" value={r.a} placeholder="Jawaban" onChange={e => set('reveals', s.reveals!.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} />
              <button className="btn btn-ghost btn-icon btn-sm" aria-label="Hapus" onClick={() => set('reveals', s.reveals!.filter((_, j) => j !== i))}><Icon name="x" /></button></div>
          </div>
        ))}
        <button className="btn btn-ghost btn-sm mt-2" onClick={() => set('reveals', [...(s.reveals || []), { q: '', a: '' }])}><Icon name="plus" />Cek cepat</button>
      </div>
      <div className="b-sec"><span className="eyebrow">Konsep yang diajarkan</span><ConceptChips all={concepts} value={s.concepts || []} onChange={v => set('concepts', v)} /></div>
    </div>
  );
}

// ---------------------------------------------------------------- exercise
export function ItemEditor({ it, onChange, items, concepts, stat, wrongLines }: {
  it: AnyItem; onChange: (it: AnyItem) => void; items: AnyItem[]; concepts: Concept[]; stat?: { n: number; wrong_pct: number }; wrongLines?: Record<string, number>;
}) {
  const set = (patch: Partial<AnyItem>) => onChange({ ...it, ...patch });
  const hints = it.hints || {};
  const top = wrongLines && Object.entries(wrongLines).sort((a, b) => b[1] - a[1])[0];
  const totalWrong = wrongLines ? Object.values(wrongLines).reduce((a, b) => a + b, 0) : 0;
  return (
    <div>
      <div className="row gap-2 wrap"><span className="phase-tag" data-phase="perkuat">Perkuat · {it.id}</span>
        {stat && stat.n >= 3 && <span className={cx('badge', stat.wrong_pct >= 40 ? 'badge-danger' : '')}>{stat.wrong_pct}% salah di percobaan 1 · {stat.n} siswa</span>}
        {it.adaptive && <span className="similar-chip"><Icon name="repeat" size={14} />soal serupa</span>}</div>
      <div className="b-sec"><span className="eyebrow">Tipe soal</span>
        <div className="types">{TYPES.map(([t, ic, l]) => <button key={t} aria-pressed={it.type === t} onClick={() => { if (t !== it.type) onChange({ ...itemTemplate(t, it.id), title: it.title, hints: it.hints, explain: it.explain, concepts: it.concepts, similar_id: it.similar_id, adaptive: it.adaptive, label: it.label }); }}><Icon name={ic} /><b>{l}</b></button>)}</div></div>
      <div className="b-sec form-grid">
        <Field label="Pertanyaan" full><Text value={it.title} onChange={v => set({ title: v })} /></Field>
        <Field label="Label singkat (untuk mentor & admin)"><Text value={it.label} onChange={v => set({ label: v })} placeholder="temukan bug const" /></Field>
        <Field label="Bantuan kecil di bawah judul"><Text value={it.help} onChange={v => set({ help: v || undefined })} /></Field>
      </div>
      <div className="b-sec"><span className="eyebrow">Jawaban</span><AnswerEditor it={it} set={set} /></div>
      <div className="b-sec"><span className="eyebrow">Petunjuk bertingkat</span>
        <div className="stack gap-2">
          {(['l3', 'l4', 'l5'] as const).map(l => <div className="row gap-2" key={l}><span className="badge badge-warning" style={{ width: 36, justifyContent: 'center' }}>{l.toUpperCase()}</span><input className="input grow" value={hints[l] || ''} placeholder={l === 'l5' ? 'Contoh terkait (opsional)' : ''} onChange={e => set({ hints: { ...hints, [l]: e.target.value } })} /></div>)}
          <div className="row gap-2"><span className="badge" style={{ width: 36, justifyContent: 'center' }}>L6</span><input className="input grow" value={it.l6 || ''} placeholder="Jawaban lengkap (muncul setelah 3 percobaan)" onChange={e => set({ l6: e.target.value || undefined })} /></div>
        </div></div>
      <div className="b-sec form-grid">
        <Field label="Penjelasan setelah benar"><Area value={it.explain} onChange={v => set({ explain: v })} /></Field>
        <Field label="Jika salah, sisipkan soal serupa" help="Adaptif: dimunculkan sekali, langsung setelah soal ini.">
          <select className="select" value={it.similar_id || ''} onChange={e => set({ similar_id: e.target.value || undefined })}><option value="">Tidak</option>{items.filter(x => x.id !== it.id).map(x => <option key={x.id} value={x.id}>{x.label || x.title.replace(/<[^>]+>/g, '').slice(0, 40)}{x.adaptive && !(x.label || '').includes('serupa') ? ' (serupa)' : ''}</option>)}</select></Field>
        <Field label="Hanya sebagai soal serupa"><label className="check"><input type="checkbox" checked={!!it.adaptive} onChange={e => set({ adaptive: e.target.checked || undefined })} />Tidak muncul di urutan utama</label></Field>
        <Field label="Diagnosis untuk mentor (opsional)"><Text value={it.diagnosis} onChange={v => set({ diagnosis: v || undefined })} placeholder="miskonsepsi yang sering muncul" /></Field>
      </div>
      <div className="b-sec"><span className="eyebrow">Konsep</span><ConceptChips all={concepts} value={it.concepts || []} onChange={v => set({ concepts: v })} /></div>
      {top && it.type === 'bug' && totalWrong >= 3 && (
        <div className="callout callout-warning mt-6"><Icon name="lightbulb" /><div className="t-sm"><b>Saran dari data:</b> {Math.round(100 * top[1] / totalWrong)}% siswa yang salah memilih baris {top[0]}. Mungkin mereka mengira bug ada di sana. Pertimbangkan memperjelas instruksi, misalnya “baris yang <i>memicu</i> error”.</div></div>
      )}
    </div>
  );
}

function AnswerEditor({ it, set }: { it: AnyItem; set: (p: Partial<AnyItem>) => void }) {
  if (it.type === 'choice' || it.type === 'predict') return (
    <div className="stack gap-2">
      {it.type === 'predict' && <Field label="Kode"><Area mono value={it.code} onChange={v => set({ code: v })} rows={3} /></Field>}
      {(it.choices || []).map((c, i) => (
        <div className="pl-row" key={i}><span /><span className="t-mono t-xs t-faint">{i + 1}</span><input className="input" value={c} style={it.answer === i ? { borderColor: 'var(--perkuat-fill)' } : undefined} onChange={e => set({ choices: it.choices!.map((x, j) => (j === i ? e.target.value : x)) })} /><label className="check t-xs"><input type="radio" checked={it.answer === i} onChange={() => set({ answer: i })} />benar</label></div>
      ))}
      <label className="check t-xs"><input type="checkbox" checked={it.cols === 2} onChange={e => set({ cols: e.target.checked ? 2 : undefined })} />Tampilkan 2 kolom</label>
    </div>
  );
  if (it.type === 'bug') return (
    <div className="stack gap-2">
      {((it.lines as string[]) || []).map((l, i) => (
        <div className="pl-row" key={i}><span /><span className="t-mono t-xs t-faint">{i + 1}</span><input className="input" value={l} style={it.answer === i + 1 ? { borderColor: 'var(--perkuat-fill)' } : undefined} onChange={e => set({ lines: (it.lines as string[]).map((x, j) => (j === i ? e.target.value : x)) })} /><label className="check t-xs"><input type="radio" checked={it.answer === i + 1} onChange={() => set({ answer: i + 1 })} />bug</label></div>
      ))}
      <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => set({ lines: [...((it.lines as string[]) || []), ''] })}><Icon name="plus" />Baris</button>
      <Field label="Pesan error yang ditampilkan (opsional)"><Text mono value={it.error} onChange={v => set({ error: v || undefined })} /></Field>
    </div>
  );
  if (it.type === 'fill') return (
    <div className="stack gap-3">
      <Field label="Kode" help="Tulis {{slot}} untuk setiap kotak kosong."><Area mono value={it.code} onChange={v => set({ code: v })} rows={3} /></Field>
      <Field label="Potongan di baki (satu per baris)"><Area mono value={(it.tray || []).map(t => t.val).join('\n')} rows={4} onChange={v => set({ tray: v.split('\n').filter(Boolean).map(x => ({ val: x, label: x })) })} /></Field>
      <Field label="Jawaban per kotak (urut, satu per baris)"><Area mono value={((it.answer as string[]) || []).join('\n')} rows={2} onChange={v => set({ answer: v.split('\n').filter(Boolean) })} /></Field>
    </div>
  );
  if (it.type === 'parsons') {
    const lines = (it.lines as { id: string; code: string }[]) || [];
    const byId = Object.fromEntries(lines.map(l => [l.id, l.code]));
    const correct = ((it.answer as string[]) || []).map(id => byId[id] ?? '');
    const write = (codes: string[]) => {
      const ids = codes.map((_, i) => String(i + 1));
      const shown = ids.map((id, i) => ({ id, code: codes[i] }));
      for (let i = shown.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [shown[i], shown[j]] = [shown[j], shown[i]]; }
      set({ lines: shown, answer: ids });
    };
    return <Field label="Baris dalam urutan BENAR" help="Siswa melihatnya teracak. Setiap perubahan mengacak ulang urutan tampil."><StringList mono items={correct} onChange={write} addLabel="Baris" /></Field>;
  }
  if (it.type === 'slider') return (
    <div className="form-grid">
      <Field label="Kode" help="{{v}} diganti nilai slider." full><Area mono value={it.code} onChange={v => set({ code: v })} rows={3} /></Field>
      <Field label="Nama variabel"><Text mono value={it.var} onChange={v => set({ var: v })} /></Field>
      <Field label="Min / maks / awal"><div className="row gap-2"><Num value={it.min} onChange={v => set({ min: v })} label="min" /><Num value={it.max} onChange={v => set({ max: v })} label="maks" /><Num value={it.value} onChange={v => set({ value: v })} label="awal" /></div></Field>
      <Field label="Hasil = nilai × faktor"><div className="row gap-2"><Text value={it.result?.label} onChange={v => set({ result: { mul: it.result?.mul ?? 1, label: v } })} label="label hasil" /><Num value={it.result?.mul} onChange={v => set({ result: { label: it.result?.label ?? 'hasil', mul: v } })} label="faktor" /></div></Field>
      <Field label="Target hasil"><Num value={it.target} onChange={v => set({ target: v, answer: it.result?.mul ? v / it.result.mul : v })} label="target" /></Field>
    </div>
  );
  if (it.type === 'match') {
    const pairs = (it.left || []).map(l => ({ key: l.key, left: l.text, right: (it.right || []).find(r => r.key === l.key)?.text || '' }));
    const write = (ps: typeof pairs) => {
      const right = ps.map(p => ({ key: p.key, text: p.right }));
      for (let i = right.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [right[i], right[j]] = [right[j], right[i]]; }
      set({ left: ps.map(p => ({ key: p.key, text: p.left })), right });
    };
    return (
      <div className="stack gap-2">
        {pairs.map((p, i) => (
          <div className="grid grid-2" style={{ gap: 8 }} key={p.key}>
            <input className="input" value={p.left} onChange={e => write(pairs.map((x, j) => (j === i ? { ...x, left: e.target.value } : x)))} aria-label="Kiri" />
            <div className="row gap-2"><input className="input grow" style={{ fontFamily: 'var(--font-mono)' }} value={p.right} onChange={e => write(pairs.map((x, j) => (j === i ? { ...x, right: e.target.value } : x)))} aria-label="Kanan" />
              <button className="btn btn-ghost btn-icon btn-sm" aria-label="Hapus" onClick={() => write(pairs.filter((_, j) => j !== i))}><Icon name="x" /></button></div>
          </div>
        ))}
        <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => write([...pairs, { key: Math.random().toString(36).slice(2, 6), left: '', right: '' }])}><Icon name="plus" />Pasangan</button>
      </div>
    );
  }
  return null;
}
