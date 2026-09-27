import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import '../player/player.css';
import { api, ApiError } from '../api/client';
import { useApi } from '../api/hooks';
import type { Exercise, Scene } from '../api/types';
import { Icon } from '../design/Icon';
import { iconNames } from '../design/Icon';
import { toast } from '../design/toast';
import { cx, LoadError, Modal, Skel } from '../design/ui';
import { burst } from '../fx';
import { Html } from '../lib/html';
import { highlightLine } from '../lib/highlight';
import { useAutosave } from '../lib/hooks';
import { SceneView } from '../pahami/Scene';
import { ExerciseBody, TYPE_CHIP } from '../perkuat/exercises';
import { ConceptChips, Field, Num, Text, Area } from './fields';
import { ItemEditor, itemTemplate, SceneEditor, VISUAL_TEMPLATE, VISUALS } from './editors';
import { ChallengeEditor, ExamEditor, KuisEditor, type ChallengeCfg, type ExamCfg, type KuisCfg } from './editors2';

type AnyItem = Exercise & { answer?: unknown; hints?: Record<string, string>; l6?: string; explain?: string; similar_id?: string; diagnosis?: string };
type Draft = {
  minutes: Record<string, number>; concepts: string[]; cheatsheet: string;
  pahami: { scenes: Scene[] }; perkuat: { items: AnyItem[] }; kuis: KuisCfg; ulangan: ExamCfg; challenge: ChallengeCfg | null; uji_mode: string;
};
type Data = {
  id: number; kind: string; number: number; title: string; subtitle: string; description: string; icon: string; status: string; version: number; path: string;
  draft: Draft; draft_saved: string | null; dirty: boolean; problems: string[];
  stats: { perkuat: Record<string, { n: number; wrong_pct: number }>; kuis: Record<string, { n: number; wrong_pct: number }>; scenes: Record<string, { stopped_pct: number }>; wrong_lines: Record<string, Record<string, number>> };
  concepts: { key: string; name: string }[];
};
type Meta = { title: string; subtitle: string; description: string; icon: string };

const css = `
.b-top { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; gap: 12px; height: 60px; padding: 0 24px; border-bottom: 1px solid var(--border); background: color-mix(in srgb, var(--bg) 92%, transparent); }
.b-grid { display: grid; grid-template-columns: 280px minmax(0, 1fr) 400px; min-height: calc(100vh - 60px); }
.b-outline { border-right: 1px solid var(--border); padding: 16px; overflow-y: auto; }
.b-edit { padding: 24px 28px 80px; overflow-y: auto; min-width: 0; }
.b-prev { border-left: 1px solid var(--border); background: var(--surface-sunken); padding: 20px; position: sticky; top: 60px; height: calc(100vh - 60px); overflow-y: auto; }
.o-phase { margin-top: 14px; }
.o-phase > .o-head { display: flex; align-items: center; gap: 8px; padding: 6px 8px; font-size: 13px; font-weight: 600; color: var(--ph-ink); }
.o-phase > .o-head .dot { background: var(--ph-fill); }
.o-item { display: flex; align-items: center; gap: 8px; min-height: 32px; padding: 4px 8px 4px 24px; border-radius: 8px; font-size: 13px; color: var(--text-muted); cursor: pointer; width: 100%; text-align: left; }
.o-item:hover { background: var(--surface-hover); color: var(--text); }
.o-item.is-sel { background: var(--surface); color: var(--text); box-shadow: inset 0 0 0 1px var(--ph-line), inset 3px 0 0 var(--ph-fill); font-weight: 500; }
.o-item .ty { margin-left: auto; font-family: var(--font-mono); font-size: 10px; color: var(--text-faint); flex: none; }
.o-item .nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.step { display: grid; grid-template-columns: 22px 30px minmax(0, 1fr) 150px 32px; gap: 10px; align-items: center; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--border); background: var(--surface); margin-bottom: 8px; }
.step .sn { width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center; background: var(--pahami-soft); color: var(--pahami-ink); font-family: var(--font-mono); font-size: 12px; font-weight: 700; }
.types { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.types button { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 12px; border-radius: 14px; border: 1.5px solid var(--border); background: var(--surface); font-size: 12px; text-align: left; transition: all var(--dur-200) var(--spring-bouncy); }
.types button svg.lucide { width: 18px; height: 18px; color: var(--perkuat-ink); }
.types button[aria-pressed="true"] { border-color: var(--perkuat-fill); background: var(--perkuat-soft); }
.pl-row { display: grid; grid-template-columns: 0 28px minmax(0, 1fr) 90px; gap: 10px; align-items: center; margin-bottom: 6px; }
.pl-row .input { font-family: var(--font-mono); }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.b-sec { margin-top: 26px; }
.b-sec > .eyebrow { display: block; margin-bottom: 10px; }
.prev-frame { border-radius: 20px; border: 1px solid var(--border); background: var(--bg); overflow: hidden; margin: 0 auto; transition: width var(--dur-320) var(--spring-gentle); }
.prev-frame .pbar { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; padding: 12px; }
.prev-frame .pbar i { height: 5px; border-radius: 3px; background: var(--viz-track); }
.prev-frame .pscene { margin: 0 12px 12px; }
.prev-frame .scene { padding: 18px; box-shadow: none; }
.prev-frame .scene h1 { font-size: 22px; }
.prev-frame .bigcode { font-size: 18px; }
.prev-frame .q-title { font-size: 20px; }
.prev-frame .viz { padding: 16px; }
.prev-frame .vbox .box { width: 96px; height: 70px; }
.prev-frame .grid-2 { grid-template-columns: 1fr; }
.tc-table td .input { height: 30px; font-family: var(--font-mono); font-size: 12px; }
@media (max-width: 1280px) { .b-grid { grid-template-columns: 240px minmax(0, 1fr); } .b-prev { display: none; } }
@media (max-width: 860px) { .b-grid { grid-template-columns: 1fr; } .b-outline { display: none; } .types { grid-template-columns: 1fr 1fr; } .form-grid { grid-template-columns: 1fr; } }
`;

const plain = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"');

export default function BuilderPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const q = useApi<Data>(`/api/admin/chapters/${id}`, { staleTime: 0 });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [showProblems, setShowProblems] = useState(false);
  const [play, setPlay] = useState(0);
  const [phone, setPhone] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const pubBtn = useRef<HTMLButtonElement>(null);
  const [save, schedule] = useAutosave<{ draft: Draft; meta: Meta }>(async v => {
    const r = await api.put<{ problems: string[] }>(`/api/admin/chapters/${id}/draft`, { draft: v.draft, ...v.meta });
    setProblems(r.problems);
  }, 900);
  useEffect(() => { if (q.data) { setDraft(q.data.draft); setMeta({ title: q.data.title, subtitle: q.data.subtitle, description: q.data.description, icon: q.data.icon }); setProblems(q.data.problems); } }, [q.data?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const change = (d: Draft, m: Meta | null = meta) => { setDraft(d); schedule({ draft: d, meta: m! }); };
  const changeMeta = (m: Meta) => { setMeta(m); if (draft) schedule({ draft, meta: m }); };

  // selection: ?edit=scene:n | item:<n or id> | kuis | challenge | ulangan | info
  const edit = params.get('edit') || 'scene:1';
  const [kind, ref] = edit.split(':');
  const scenes = draft?.pahami.scenes || [];
  const items = draft?.perkuat.items || [];
  const sceneIdx = kind === 'scene' ? Math.max(0, Math.min(scenes.length - 1, Number(ref || 1) - 1)) : -1;
  const itemIdx = kind === 'item' ? (/^\d+$/.test(ref || '') ? Number(ref) - 1 : items.findIndex(i => i.id === ref)) : -1;
  const select = (e: string) => setParams({ edit: e }, { replace: true });

  const addScene = () => { if (!draft) return; const s: Scene = { id: `s${Date.now().toString(36)}`, kicker: '', title: 'Scene baru', visual: structuredClone(VISUAL_TEMPLATE.code), advance: 'free', concepts: [] }; change({ ...draft, pahami: { scenes: [...scenes, s] } }); select(`scene:${scenes.length + 1}`); };
  const addItem = () => { if (!draft) return; const it = itemTemplate('choice', `q${Date.now().toString(36)}`); change({ ...draft, perkuat: { items: [...items, it] } }); select(`item:${it.id}`); };
  const moveScene = (i: number, d: -1 | 1) => { if (!draft) return; const s = [...scenes]; const j = i + d; if (j < 0 || j >= s.length) return; [s[i], s[j]] = [s[j], s[i]]; change({ ...draft, pahami: { scenes: s } }); select(`scene:${j + 1}`); };
  const removeScene = (i: number) => { if (!draft || scenes.length <= 1) return; change({ ...draft, pahami: { scenes: scenes.filter((_, k) => k !== i) } }); select(`scene:${Math.max(1, i)}`); };
  const removeItem = (i: number) => { if (!draft) return; const gone = items[i].id; change({ ...draft, perkuat: { items: items.filter((_, k) => k !== i).map(x => (x.similar_id === gone ? { ...x, similar_id: undefined } : x)) } }); select('item:1'); };

  const publish = async () => {
    setPublishing(true);
    try {
      if (draft && meta) await api.put(`/api/admin/chapters/${id}/draft`, { draft, ...meta });
      const r = await api.post<{ version: number }>(`/api/admin/chapters/${id}/publish`);
      burst(pubBtn.current);
      toast({ kind: 'success', icon: 'upload', title: `Bab ${q.data?.number} v${r.version} diterbitkan`, body: 'Siswa yang sedang di tengah fase tetap memakai versi lama sampai fase selesai.' });
      q.refetch(); qc.invalidateQueries({ queryKey: ['/api/admin/chapters'] });
    } catch (e) {
      if (e instanceof ApiError && typeof e.detail === 'object' && e.detail.problems) { setProblems(e.detail.problems); setShowProblems(true); }
      else toast({ kind: 'danger', icon: 'circle-alert', title: 'Gagal menerbitkan' });
    } finally { setPublishing(false); }
  };

  const preview = useMemo(() => {
    if (!draft) return null;
    if (kind === 'scene' && scenes[sceneIdx]) return (
      <div className="prev-frame mt-3" data-phase="pahami" style={{ width: phone ? 340 : '100%' }}>
        <div className="pbar"><i style={{ background: 'var(--pahami-fill)' }} /><i /><i /><i /></div>
        <div className="pscene"><SceneView key={`${sceneIdx}-${play}`} scene={scenes[sceneIdx]} kicker={scenes[sceneIdx].kicker || `Bab ${q.data?.number} · ${meta?.title}`} setMood={() => undefined} /></div>
      </div>
    );
    if (kind === 'item' && items[itemIdx]) {
      const it = items[itemIdx];
      const [ic, label] = TYPE_CHIP[it.type];
      return (
        <div className="prev-frame mt-3" data-phase="perkuat" style={{ width: phone ? 340 : '100%' }}>
          <div className="pbar"><i style={{ background: 'var(--pahami-fill)' }} /><i style={{ background: 'var(--perkuat-fill)' }} /><i /><i /></div>
          <div className="pscene"><section className="scene">
            <div className="q-meta"><span className="phase-tag">Perkuat</span><span className="type-chip"><Icon name={ic} />{label}</span></div>
            <Html as="h2" className="q-title" html={it.title} />{it.help && <Html as="p" className="q-help" html={it.help} />}
            <ExerciseBody key={`${it.id}-${play}-${JSON.stringify(it).length}`} item={it} locked={false} marks={null} onChange={() => undefined} />
          </section></div>
        </div>
      );
    }
    if (kind === 'kuis' && draft.kuis.bank[0]) {
      const k = draft.kuis.bank[0];
      return (
        <div className="prev-frame mt-3" data-phase="kuis" style={{ width: phone ? 340 : '100%' }}><div className="pscene" style={{ marginTop: 12 }}><section className="scene">
          {k.trivia && <div className="trivia-tag mb-2"><Icon name="sparkles" size={14} />Fakta seru</div>}
          <Html as="h2" className="q-title" style={{ marginTop: 0 }} html={k.t} />
          {k.c && <div className="codecard mt-4"><div className="cc-body">{k.c.split('\n').map((l, j) => <div className="cc-line" key={j}><span className="cc-ln">{j + 1}</span><span dangerouslySetInnerHTML={{ __html: highlightLine(l) }} /></div>)}</div></div>}
          <div className="choices">{k.o.map((o, j) => <div key={j} className={cx('choice', j === k.a && 'is-right')}><span className="key abcd">{'ABCD'[j]}</span><span className="code">{o}</span></div>)}</div>
        </section></div></div>
      );
    }
    if (kind === 'challenge' && draft.challenge) {
      const c = draft.challenge;
      return (
        <div className="prev-frame mt-3" data-phase="uji" style={{ width: phone ? 340 : '100%' }}><div className="pscene" style={{ marginTop: 12 }}><aside className="brief" style={{ position: 'static' }}>
          <div className="row gap-2"><span className="phase-tag">Challenge</span><span className="badge badge-mono">±{c.minutes} menit</span></div>
          <h1 className="big-serif mt-3" style={{ fontSize: 26 }}>{c.title}</h1><Html as="p" className="t-muted mt-2" html={c.story} />
          <div className="brief-steps">{c.steps.map((s, i) => <div key={i}><Html html={s} /></div>)}</div>
        </aside></div></div>
      );
    }
    return <p className="t-sm t-faint mt-3">Pilih scene, soal, kuis, atau challenge untuk melihat pratinjau.</p>;
  }, [draft, kind, sceneIdx, itemIdx, play, phone, meta?.title]); // eslint-disable-line react-hooks/exhaustive-deps

  if (q.error) return <div className="page"><LoadError onRetry={() => q.refetch()} /></div>;
  if (!q.data || !draft || !meta) return <div className="page"><Skel h={40} w={400} /><Skel h={500} r={16} className="mt-4" /></div>;
  const d = q.data;
  const nextV = d.version + 1;
  const flagged = (iid: string) => (d.stats.perkuat[iid]?.n ?? 0) >= 5 && (d.stats.perkuat[iid]?.wrong_pct ?? 0) >= 40;

  return (
    <>
      <style>{css}</style>
      <div className="b-top">
        <div className="crumbs t-sm t-muted"><Link to="/admin/bab">Konten</Link> / {d.path} / <b style={{ color: 'var(--text)' }}>Bab {d.number} · {meta.title}</b></div>
        {d.version ? <span className="badge badge-success">Terbit · v{d.version}</span> : <span className="badge">Draft</span>}
        <span className="save-state hide-sm"><Icon name={save === 'saving' ? 'loader-circle' : save === 'error' || save === 'offline' ? 'circle-alert' : 'cloud-check'} size={14} className={save === 'saving' ? 'spin' : ''} />
          {save === 'saving' ? 'Menyimpan…' : save === 'error' || save === 'offline' ? 'Gagal menyimpan draft' : `Draft v${nextV} tersimpan`}</span>
        <div className="grow" />
        {problems.length > 0 && <button className="btn btn-ghost btn-sm" onClick={() => setShowProblems(true)}><Icon name="triangle-alert" style={{ color: 'var(--warning)' }} />{problems.length} masalah</button>}
        {d.version > 0 && <Link className="btn btn-secondary btn-press" to={`/bab/${d.id}/pahami`} target="_blank"><Icon name="eye" /><span className="hide-sm">Pratinjau sebagai siswa</span></Link>}
        <button ref={pubBtn} className={cx('btn btn-primary btn-press', publishing && 'is-loading')} onClick={publish}><Icon name="upload" />Terbitkan v{nextV}</button>
      </div>
      <div className="b-grid">
        <nav className="b-outline" aria-label="Struktur bab">
          <div className="eyebrow">Struktur bab</div>
          <button className={cx('o-item', kind === 'info' && 'is-sel')} style={{ paddingLeft: 8, marginTop: 8 }} onClick={() => select('info')}><Icon name="info" size={14} />Info bab &amp; konsep</button>
          <div className="o-phase" data-phase="pahami"><div className="o-head"><span className="dot" />1 · Pahami<span className="t-xs t-faint" style={{ marginLeft: 'auto', fontWeight: 400 }}>{scenes.length} scene</span></div>
            {scenes.map((s, i) => (
              <button key={s.id + i} className={cx('o-item', sceneIdx === i && 'is-sel')} onClick={() => select(`scene:${i + 1}`)}>
                <span className="nm">{plain(s.title) || 'Tanpa judul'}</span><span className="ty">{VISUALS.find(v => v[0] === s.visual?.type)?.[2].toLowerCase() || 'scene'}</span></button>
            ))}
            <button className="o-item" style={{ color: 'var(--text-faint)' }} onClick={addScene}><Icon name="plus" size={14} />Tambah scene</button>
          </div>
          <div className="o-phase" data-phase="perkuat"><div className="o-head"><span className="dot" />2 · Perkuat<span className="t-xs t-faint" style={{ marginLeft: 'auto', fontWeight: 400 }}>{items.filter(i => !i.adaptive).length} + {items.filter(i => i.adaptive).length} serupa</span></div>
            {items.map((it, i) => (
              <button key={it.id} className={cx('o-item', itemIdx === i && 'is-sel')} onClick={() => select(`item:${it.id}`)}>
                {flagged(it.id) && <Icon name="triangle-alert" size={14} style={{ color: 'var(--uji-ink)' }} />}
                {it.adaptive && <Icon name="repeat" size={14} />}
                <span className="nm">{it.label || plain(it.title)}</span><span className="ty">{TYPE_CHIP[it.type]?.[1].split(' ')[0].toLowerCase()}</span></button>
            ))}
            <button className="o-item" style={{ color: 'var(--text-faint)' }} onClick={addItem}><Icon name="plus" size={14} />Tambah soal</button>
          </div>
          <div className="o-phase" data-phase="kuis"><div className="o-head"><span className="dot" />3 · Kuis<span className="t-xs t-faint" style={{ marginLeft: 'auto', fontWeight: 400 }}>bank {draft.kuis.bank.length}</span></div>
            <button className={cx('o-item', kind === 'kuis' && 'is-sel')} onClick={() => select('kuis')}><span className="nm">Bank soal · {draft.kuis.round_size} per ronde</span><span className="ty">kuis</span></button></div>
          <div className="o-phase" data-phase="uji"><div className="o-head"><span className="dot" />4 · Uji</div>
            <button className={cx('o-item', kind === 'challenge' && 'is-sel')} onClick={() => select('challenge')}><span className="nm">Challenge{draft.challenge ? ` · ${draft.challenge.title}` : ' · belum ada'}</span><span className="ty">kode</span></button>
            <button className={cx('o-item', kind === 'ulangan' && 'is-sel')} onClick={() => select('ulangan')}><span className="nm">Ulangan · {draft.ulangan.questions.length} soal</span><span className="ty">ujian</span></button></div>
        </nav>

        <section className="b-edit">
          {kind === 'info' && (
            <div>
              <span className="phase-tag">Info bab</span>
              <div className="b-sec form-grid">
                <Field label="Judul"><Text value={meta.title} onChange={v => changeMeta({ ...meta, title: v })} /></Field>
                <Field label="Subjudul (di peta)"><Text value={meta.subtitle} onChange={v => changeMeta({ ...meta, subtitle: v })} /></Field>
                <Field label="Deskripsi" full><Area value={meta.description} onChange={v => changeMeta({ ...meta, description: v })} rows={3} /></Field>
                <Field label="Ikon"><select className="select" value={meta.icon} onChange={e => changeMeta({ ...meta, icon: e.target.value })}>{iconNames.map(n => <option key={n}>{n}</option>)}</select></Field>
                <Field label="Mode Uji"><select className="select" value={draft.uji_mode} onChange={e => change({ ...draft, uji_mode: e.target.value })}><option value="any">Siswa memilih Ulangan atau Challenge</option><option value="ulangan">Wajib Ulangan</option><option value="challenge">Wajib Challenge</option></select></Field>
                {(['pahami', 'perkuat', 'kuis', 'uji'] as const).map(p => <Field key={p} label={`Perkiraan menit · ${p}`}><Num value={draft.minutes[p]} onChange={v => change({ ...draft, minutes: { ...draft.minutes, [p]: v } })} /></Field>)}
              </div>
              <div className="b-sec"><span className="eyebrow">Konsep bab ini (untuk penguasaan &amp; konstelasi)</span><ConceptChips all={d.concepts} value={draft.concepts} onChange={v => change({ ...draft, concepts: v })} /></div>
              <div className="b-sec"><span className="eyebrow">Catatan ringkas (terbuka setelah Pahami)</span><Area mono rows={5} value={draft.cheatsheet} onChange={v => change({ ...draft, cheatsheet: v })} /></div>
            </div>
          )}
          {kind === 'scene' && scenes[sceneIdx] && (
            <>
              <div className="row gap-1" style={{ justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost btn-sm" disabled={sceneIdx === 0} onClick={() => moveScene(sceneIdx, -1)}>Naik</button>
                <button className="btn btn-ghost btn-sm" disabled={sceneIdx === scenes.length - 1} onClick={() => moveScene(sceneIdx, 1)}>Turun</button>
                <button className="btn btn-ghost btn-sm" disabled={scenes.length <= 1} onClick={() => removeScene(sceneIdx)}><Icon name="trash-2" />Hapus</button>
              </div>
              <SceneEditor s={scenes[sceneIdx]} concepts={d.concepts} stat={d.stats.scenes[String(sceneIdx + 1)]?.stopped_pct} onPlay={() => setPlay(p => p + 1)}
                onChange={s => change({ ...draft, pahami: { scenes: scenes.map((x, i) => (i === sceneIdx ? s : x)) } })} />
            </>
          )}
          {kind === 'item' && items[itemIdx] && (
            <>
              <div className="row gap-1" style={{ justifyContent: 'flex-end' }}><button className="btn btn-ghost btn-sm" onClick={() => removeItem(itemIdx)}><Icon name="trash-2" />Hapus soal</button></div>
              <ItemEditor it={items[itemIdx]} items={items} concepts={d.concepts} stat={d.stats.perkuat[items[itemIdx].id]} wrongLines={d.stats.wrong_lines[items[itemIdx].id]}
                onChange={it => change({ ...draft, perkuat: { items: items.map((x, i) => (i === itemIdx ? it : x)) } })} />
            </>
          )}
          {kind === 'kuis' && <KuisEditor k={draft.kuis} concepts={d.concepts} stats={d.stats.kuis} onChange={k => change({ ...draft, kuis: k })} />}
          {kind === 'challenge' && <ChallengeEditor c={draft.challenge} concepts={d.concepts} onChange={c => change({ ...draft, challenge: c })} />}
          {kind === 'ulangan' && <ExamEditor ex={draft.ulangan} concepts={d.concepts} onChange={e => change({ ...draft, ulangan: e })} />}
        </section>

        <aside className="b-prev" aria-label="Pratinjau">
          <div className="row between"><span className="eyebrow">Pratinjau langsung</span>
            <div className="segmented"><button aria-pressed={!phone} onClick={() => setPhone(false)} aria-label="Desktop"><Icon name="monitor" size={14} /></button><button aria-pressed={phone} onClick={() => setPhone(true)} aria-label="Ponsel"><Icon name="smartphone" size={14} /></button></div></div>
          {preview}
          {(kind === 'scene' || kind === 'item') && <button className="btn btn-secondary btn-press w-full mt-3" onClick={() => setPlay(p => p + 1)}><Icon name="play" />Putar ulang</button>}
          <div className="callout mt-4"><Icon name="info" /><div className="t-xs">Pratinjau memakai komponen yang sama dengan aplikasi siswa, jadi yang kamu lihat di sini sama dengan yang dilihat siswa.</div></div>
        </aside>
      </div>
      <Modal open={showProblems} onClose={() => setShowProblems(false)} title="Belum bisa diterbitkan" foot={<button className="btn btn-primary" onClick={() => setShowProblems(false)}>Oke</button>}>
        <ul className="problems">{problems.map((p, i) => <li key={i}>{p}</li>)}</ul>
      </Modal>
    </>
  );
}
