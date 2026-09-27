import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useApi } from '../api/hooks';
import type { ChapterRef } from '../api/types';
import { CodeEditor } from '../code/CodeEditor';
import { runLocal, type LocalRun } from '../code/runLocal';
import { Icon } from '../design/Icon';
import { Nosi } from '../design/Nosi';
import { cx, LoadError, Modal, SaveState, Skel } from '../design/ui';
import { pop, shake } from '../fx';
import { Html, clean } from '../lib/html';
import { useAutosave, useHeartbeat } from '../lib/hooks';

type Cell = { id: string; type: 'code' | 'note'; src: string };
type Notebook = { id: number; title: string; cells: Cell[]; updated: string; attached: ChapterRef | null };
type List = { items: { id: number; title: string; updated: string }[]; attachable: ChapterRef[]; assist_cap: number };
type Diag = { available: boolean; text?: string; fix?: { label: string; code: string }; line?: number | null; reason?: string };
type CellRun = LocalRun & { n: number; diag?: Diag | null; shown: string[] };

/* from mockups/playground.html */
const css = `
.pg { display: grid; grid-template-columns: 240px minmax(0, 820px); gap: 40px; justify-content: center; }
.nb-list { position: sticky; top: 88px; align-self: start; display: flex; flex-direction: column; gap: 4px; }
.nb-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; font-size: 14px; color: var(--text-muted); }
.nb-item:hover { background: var(--surface-hover); color: var(--text); }
.nb-item[aria-current] { background: var(--surface); color: var(--text); box-shadow: inset 0 0 0 1px var(--border); font-weight: 500; }
.ctx-chip { display: inline-flex; align-items: center; gap: 8px; height: 34px; padding: 0 12px; border-radius: 999px; border: 1.5px dashed var(--border-strong); color: var(--text-muted); font-size: 13px; transition: all var(--dur-200) var(--spring-bouncy); }
.ctx-chip:hover { border-color: var(--pahami-fill); color: var(--pahami-ink); }
.ctx-chip.is-attached { border-style: solid; border-color: var(--pahami-line); background: var(--pahami-soft); color: var(--pahami-ink); }
.nb-title { font-family: var(--font-serif); font-size: 40px; border: 0; background: none; outline: none; width: 100%; color: var(--text); letter-spacing: -0.015em; }
.cell .codecard { width: 100%; }
.cell .cc-out:empty { display: none; }
.diag { display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; border-top: 1px dashed var(--kuis-line); background: var(--kuis-soft); }
.note-edit { padding: 6px 4px; font-size: 16px; line-height: 1.7; color: var(--text-muted); outline: none; border-radius: 10px; min-height: 30px; }
.note-edit:focus { background: var(--surface); box-shadow: 0 0 0 1px var(--border); padding: 6px 12px; }
.cell-tools { display: flex; gap: 2px; margin-top: 4px; opacity: 0; transition: opacity var(--dur-200); }
.cell:hover .cell-tools, .cell:focus-within .cell-tools { opacity: 1; }
.ctx-menu { position: absolute; z-index: 20; top: 40px; left: 0; }
.add-cell { padding-left: 44px; }
@media (max-width: 1000px) { .pg { grid-template-columns: 1fr; } .nb-list { display: none; } }
`;

const newId = () => Math.random().toString(16).slice(2, 10);

export default function Playground() {
  const { notebookId } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const list = useApi<List>('/api/notebooks');
  const nbQ = useApi<Notebook>(notebookId ? `/api/notebooks/${notebookId}` : null, { staleTime: 0 });
  useHeartbeat(nbQ.data?.attached?.id ?? null);
  const [nb, setNb] = useState<Notebook | null>(null);
  const [runs, setRuns] = useState<Record<string, CellRun>>({});
  const [active, setActive] = useState<string | null>(null);
  const [ctxOpen, setCtxOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const counter = useRef(0);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [save, schedule] = useAutosave<Notebook>(n => api.put(`/api/notebooks/${n.id}`, { title: n.title, cells: n.cells }).then(() => qc.invalidateQueries({ queryKey: ['/api/notebooks'] })), 700);

  const create = async (template?: string) => {
    const n = await api.post<Notebook>('/api/notebooks', template ? { template } : {});
    qc.invalidateQueries({ queryKey: ['/api/notebooks'] });
    nav(`/playground/${n.id}`, { replace: true });
  };
  // /playground → open the latest notebook (or create one); ?baru=1 → new notebook
  const creating = useRef(false);
  useEffect(() => {
    if (notebookId || !list.data) return;
    if (params.get('baru') || !list.data.items.length) { if (!creating.current) { creating.current = true; create().finally(() => { creating.current = false; }); } }
    else nav(`/playground/${list.data.items[0].id}`, { replace: true });
  }, [list.data, notebookId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (nbQ.data) { setNb(nbQ.data); setRuns({}); counter.current = 0; } }, [nbQ.data]);
  useEffect(() => { // run existing code cells once, like the mockup (outputs visible on open)
    if (!nbQ.data) return;
    (async () => { for (const c of nbQ.data.cells) if (c.type === 'code' && c.src.trim()) await run(c.id, nbQ.data); })();
  }, [nbQ.data?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (next: Notebook) => { setNb(next); schedule(next); };
  const setCell = (id: string, src: string) => { if (!nb) return; update({ ...nb, cells: nb.cells.map(c => (c.id === id ? { ...c, src } : c)) }); };
  const addCell = (type: 'code' | 'note', after?: string) => {
    if (!nb) return;
    const cell: Cell = { id: newId(), type, src: type === 'note' ? 'Catatan baru…' : '' };
    const cells = [...nb.cells];
    const idx = after ? cells.findIndex(c => c.id === after) + 1 : cells.length;
    cells.splice(idx, 0, cell);
    update({ ...nb, cells });
    setActive(cell.id);
  };
  const removeCell = (id: string) => { if (nb) update({ ...nb, cells: nb.cells.filter(c => c.id !== id) }); };

  async function run(id: string, source: Notebook | null = nb) {
    if (!source) return;
    const codeCells = source.cells.filter(c => c.type === 'code');
    const idx = codeCells.findIndex(c => c.id === id);
    const cell = codeCells[idx];
    if (!cell) return;
    // notebook semantics: cells share scope, so previous code cells run first
    const prelude = codeCells.slice(0, idx).map(c => c.src).join('\n');
    const before = prelude ? (await runLocal(prelude)).logs.length : 0;
    const res = await runLocal(prelude ? `${prelude}\n${cell.src}` : cell.src);
    const preludeLines = prelude ? prelude.split('\n').length : 0;
    const line = res.error?.line ? res.error.line - preludeLines : null;
    const n = ++counter.current;
    const out: CellRun = { ...res, error: res.error ? { ...res.error, line: line && line > 0 ? line : null } : null, n, shown: res.logs.slice(before), diag: null };
    setRuns(r => ({ ...r, [id]: out }));
    if (res.error) {
      shake(cardRefs.current[id]);
      try {
        const d = await api.post<Diag>('/api/diagnose', { code: cell.src, error: out.error, scope_code: prelude, where: 'playground' });
        setRuns(r => ({ ...r, [id]: { ...out, diag: d, error: out.error && !out.error.line && d.line ? { ...out.error, line: d.line } : out.error } }));
      } catch { setRuns(r => ({ ...r, [id]: { ...out, diag: { available: false, reason: 'down' } } })); }
    }
  }

  const attach = async (chapterId: number | null) => {
    if (!nb) return;
    setCtxOpen(false);
    const r = await api.put<Notebook>(`/api/notebooks/${nb.id}`, chapterId ? { attached_chapter_id: chapterId } : { detach: true });
    setNb({ ...nb, attached: r.attached });
    pop(document.querySelector('.ctx-chip'));
  };
  const remove = async () => {
    if (!nb) return;
    await api.del(`/api/notebooks/${nb.id}`);
    setConfirmDel(false);
    qc.invalidateQueries({ queryKey: ['/api/notebooks'] });
    nav('/playground', { replace: true });
  };

  if (list.error || nbQ.error) return <main className="page"><LoadError onRetry={() => { list.refetch(); nbQ.refetch(); }} /></main>;

  return (
    <main className="page" style={{ maxWidth: 1160 }}>
      <style>{css}</style>
      <div className="pg">
        <aside className="nb-list" aria-label="Notebook">
          <button className="btn btn-primary btn-lg btn-press mb-4" onClick={() => create()}><Icon name="plus" />Notebook baru</button>
          {list.data?.items.map(n => (
            <Link key={n.id} className="nb-item" to={`/playground/${n.id}`} aria-current={String(n.id) === notebookId ? 'page' : undefined}>
              <Icon name={String(n.id) === notebookId ? 'notebook-pen' : 'notebook'} size={14} /><span className="grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</span>
            </Link>
          ))}
          <div className="eyebrow mt-6" style={{ padding: '0 12px' }}>Tentang playground</div>
          <p className="t-xs t-faint mt-2" style={{ padding: '0 12px', lineHeight: 1.6 }}>Ngoding bebas tanpa nilai. Semua bantuan Nosi terbuka. Kamu bisa melampirkan bab kalau ingin petunjuk yang nyambung.</p>
        </aside>

        {!nb ? <section><Skel h={34} w={260} /><Skel h={48} w="70%" className="mt-4" /><Skel h={160} r={16} className="mt-6" /></section> : (
          <section>
            <div className="row between wrap gap-3">
              <div style={{ position: 'relative' }}>
                <button className={cx('ctx-chip', nb.attached && 'is-attached')} aria-expanded={ctxOpen} onClick={() => setCtxOpen(o => !o)}>
                  <Icon name="link" size={14} />{nb.attached ? `Bab ${nb.attached.number} · ${nb.attached.title} · petunjuk mengikuti bab ini` : 'Tidak ada bab dilampirkan · lampirkan'}
                </button>
                {ctxOpen && (
                  <div className="menu ctx-menu" role="menu">
                    {list.data?.attachable.map(c => <button key={c.id} className="menu-item w-full" onClick={() => attach(c.id)}><Icon name="book-open" />Bab {c.number} · {c.title}</button>)}
                    {!list.data?.attachable.length && <div className="menu-item t-faint">Belum ada bab yang dibuka</div>}
                    {nb.attached && <button className="menu-item w-full" onClick={() => attach(null)}><Icon name="x" />Lepaskan bab</button>}
                  </div>
                )}
              </div>
              <div className="row gap-2"><SaveState state={save === 'saved' || save === 'idle' ? 'idle' : save} idle="Tersimpan otomatis" />
                <button className="btn btn-ghost btn-icon btn-sm" aria-label="Hapus notebook" onClick={() => setConfirmDel(true)}><Icon name="trash-2" /></button></div>
            </div>
            <input className="nb-title mt-4" value={nb.title} aria-label="Judul notebook" onChange={e => update({ ...nb, title: e.target.value })} />

            {!nb.cells.length ? (
              <div className="card mt-6"><div className="empty" style={{ padding: '56px 24px' }}>
                <Nosi size="lg" mood="happy" />
                <div className="t-h3 mt-3">Kertas kosong. Mau coba apa?</div>
                <p>Tulis kode apa saja lalu tekan jalankan. Tidak ada nilai, tidak ada yang salah.</p>
                <div className="row gap-2 mt-4 wrap center">
                  <button className="btn btn-secondary btn-press" onClick={() => addCell('code')}><Icon name="code-xml" />Sel kode pertama</button>
                  <button className="btn btn-ghost" onClick={() => create('tebak-angka')}>Mulai dari contoh: tebak angka</button>
                </div>
              </div></div>
            ) : (
              <div className="mt-6">
                {nb.cells.map(c => {
                  const r = runs[c.id];
                  return (
                    <div key={c.id}>
                      {c.type === 'note' ? (
                        <div className="cell is-note">
                          <div className="gut"><Icon name="text" size={14} className="t-faint" /><div className="cell-tools"><button className="btn btn-ghost btn-icon btn-sm" aria-label="Hapus catatan" onClick={() => removeCell(c.id)}><Icon name="trash-2" /></button></div></div>
                          <div className="note-edit" contentEditable suppressContentEditableWarning role="textbox" aria-label="Catatan"
                            dangerouslySetInnerHTML={{ __html: clean(c.src) }} onBlur={e => setCell(c.id, clean(e.currentTarget.innerHTML))} />
                        </div>
                      ) : (
                        <div className={cx('cell', active === c.id && 'is-active')} onFocus={() => setActive(c.id)}>
                          <div className="gut">
                            <button className="run" aria-label="Jalankan sel" title="Jalankan (⇧↵)" onClick={e => { pop(e.currentTarget); run(c.id); }}><Icon name="play" size={14} /></button>
                            <span className="cnt">[{r?.n ?? ' '}]</span>
                            <div className="cell-tools"><button className="btn btn-ghost btn-icon btn-sm" aria-label="Hapus sel" onClick={() => removeCell(c.id)}><Icon name="trash-2" /></button></div>
                          </div>
                          <div className="codecard" ref={el => { cardRefs.current[c.id] = el; }}>
                            <CodeEditor value={c.src} onChange={v => setCell(c.id, v)} onRun={() => run(c.id)} runKey="Shift-Enter" small badLine={r?.error?.line ?? null}
                              label="Sel kode" placeholder="// tulis kode, lalu Shift+Enter" />
                            {r && (r.shown.length > 0 || r.error) && (
                              <div className="cc-out">
                                {r.shown.map((l, i) => <span className="out-bubble" key={i + l} style={{ animationDelay: `${i * 90}ms` }}><span className="p">›</span>{l}</span>)}
                                {r.error && <span className="out-bubble is-err"><Icon name="circle-x" size={14} />{r.error.name}: {r.error.message}</span>}
                              </div>
                            )}
                            {r?.error && r.diag && (
                              <div className="diag">
                                <Nosi size="sm" mood="think" force />
                                <div className="t-sm">
                                  <span className="eyebrow" style={{ color: 'var(--kuis-ink)' }}>Nosi · penjelasan (L2)</span>
                                  {r.diag.available ? <Html as="div" className="mt-1" html={r.diag.text} />
                                    : <div className="mt-1">{r.diag.reason === 'capped' ? 'Mentormu membatasi penjelasan di playground. Pesan error di atas tetap akurat.' : 'Penjelasan belum tersedia saat ini. Pesan error di atas tetap akurat, dan petunjuk tertulis masih bisa dibuka.'}</div>}
                                  {r.diag.fix && (
                                    <div className="row gap-2 mt-2">
                                      <button className="btn btn-secondary btn-sm btn-press" onClick={() => { const fixed = r.diag!.fix!.code; const next = { ...nb, cells: nb.cells.map(x => (x.id === c.id ? { ...x, src: fixed } : x)) }; update(next); setTimeout(() => run(c.id, next), 0); }}>{r.diag.fix.label}</button>
                                      <button className="btn btn-ghost btn-sm" onClick={() => setRuns(x => ({ ...x, [c.id]: { ...r, diag: { ...r.diag!, fix: undefined } } }))}>Petunjuk saja</button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      <div className="add-cell"><button className="btn btn-ghost btn-sm" onClick={() => addCell('code', c.id)}><Icon name="code-xml" />Kode</button><button className="btn btn-ghost btn-sm" onClick={() => addCell('note', c.id)}><Icon name="text" />Catatan</button></div>
                    </div>
                  );
                })}
                <div className="row gap-2 mt-2" style={{ paddingLeft: 44 }}><button className="btn btn-secondary btn-sm btn-press" onClick={() => addCell('code')}><Icon name="plus" />Sel kode</button><button className="btn btn-ghost btn-sm" onClick={() => addCell('note')}><Icon name="text" />Catatan</button></div>
              </div>
            )}
          </section>
        )}
      </div>
      <Modal open={confirmDel} onClose={() => setConfirmDel(false)} title="Hapus notebook ini?" role="alertdialog"
        foot={<><button className="btn btn-ghost" onClick={() => setConfirmDel(false)}>Batal</button><button className="btn btn-no btn-press" onClick={remove}>Hapus</button></>}>
        <p>“{nb?.title}” dan semua selnya akan dihapus permanen.</p>
      </Modal>
    </main>
  );
}
