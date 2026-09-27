import { Fragment, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useMe } from '../api/hooks';
import { homeFor } from '../app/common';
import { Icon } from '../design/Icon';
import { Nosi, type Mood } from '../design/Nosi';
import { cx } from '../design/ui';
import { burst, flyTo, motion, pop, shake } from '../fx';
import { usePrefs } from '../state/prefs';

/* from mockups/landing.html */
const css = `
.lp { max-width: 1200px; margin: 0 auto; padding: 0 32px; }
.mnav { position: sticky; top: 0; z-index: 20; background: color-mix(in srgb, var(--bg) 90%, transparent); border-bottom: 1px solid transparent; transition: border-color var(--dur-fast); }
.mnav.is-scrolled { border-bottom-color: var(--border); }
.mnav .lp { height: 68px; display: flex; align-items: center; gap: 28px; }
.mnav nav { display: flex; gap: 22px; font-size: 14px; color: var(--text-muted); }
.mnav nav a:hover { color: var(--text); }
.hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 540px); gap: 56px; align-items: center; padding-top: 72px; padding-bottom: 40px; }
.hero h1 { font-size: clamp(46px, 6vw, 78px); }
.hero-phases { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 26px; }
.demo { position: relative; border-radius: 28px; background: var(--surface); border: 1px solid var(--border); box-shadow: 0 30px 80px -40px rgba(31,30,27,.45); overflow: hidden; }
.demo-tabs { display: grid; grid-template-columns: repeat(4, 1fr); border-bottom: 1px solid var(--divider); }
.demo-tab { position: relative; padding: 14px 8px 12px; font-size: 13px; font-weight: 600; color: var(--text-faint); display: flex; flex-direction: column; align-items: center; gap: 4px; transition: color var(--dur-200), background var(--dur-200); }
.demo-tab:hover { color: var(--text); }
.demo-tab[aria-selected="true"] { color: var(--ph-ink); background: var(--ph-soft); }
.demo-tab .tprog { position: absolute; left: 0; bottom: -1px; height: 3px; width: 0; background: var(--ph-fill); }
.demo-body { padding: 28px; min-height: 380px; position: relative; }
.demo-pane { animation: scene-in var(--dur-600) var(--spring-gentle) both; }
.demo-foot { display: flex; align-items: center; gap: 10px; padding: 14px 20px; border-top: 1px solid var(--divider); background: var(--surface-sunken); font-size: 12px; color: var(--text-faint); }
.sec { padding-top: 130px; }
.sec h2 { font-size: clamp(34px, 4.4vw, 54px); max-width: 18ch; }
.lead-lg { font-size: 18px; line-height: 1.6; color: var(--text-muted); max-width: 58ch; margin-top: 16px; }
.story { display: grid; grid-template-columns: 1fr 1fr; gap: 64px; margin-top: 56px; }
.story-sticky { position: sticky; top: 110px; align-self: start; height: 460px; border-radius: 28px; border: 1px solid var(--border); background: var(--ph-soft); display: grid; place-items: center; overflow: hidden; transition: background var(--dur-600) var(--ease-out); }
.story-sticky .big-ic { width: 120px; height: 120px; border-radius: 36px; display: grid; place-items: center; background: var(--surface); color: var(--ph-ink); box-shadow: 0 20px 40px -24px rgba(31,30,27,.4); transition: transform var(--dur-600) var(--spring-bouncy); }
.story-sticky .big-ic svg.lucide { width: 52px; height: 52px; stroke-width: 1.5; }
.story-sticky .big-num { position: absolute; left: 28px; top: 20px; font-family: var(--font-serif); font-size: 120px; line-height: 1; color: var(--ph-fill); opacity: .25; }
.story-sticky .nosi { position: absolute; right: 28px; bottom: 24px; }
.story-steps { display: flex; flex-direction: column; gap: 44vh; padding: 12vh 0 30vh; }
.sstep { opacity: .35; transition: opacity var(--dur-320); }
.sstep.is-on { opacity: 1; }
.sstep h3 { font-family: var(--font-serif); font-weight: 400; font-size: 40px; margin: 12px 0 10px; }
.sstep p { font-size: 17px; line-height: 1.65; color: var(--text-muted); }
.vs { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 44px; }
.vs > div { padding: 26px; border-radius: 22px; border: 1px solid var(--border); background: var(--surface); }
.vs .flow { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 14px; font-size: 13px; }
.vs .flow span { padding: 6px 12px; border-radius: 999px; background: var(--surface-sunken); }
.moods { display: flex; gap: 22px; flex-wrap: wrap; margin-top: 28px; }
.moods button { display: flex; flex-direction: column; align-items: center; gap: 8px; font-size: 12px; color: var(--text-muted); padding: 14px; border-radius: 18px; border: 1px solid var(--border); background: var(--surface); transition: transform var(--dur-320) var(--spring-bouncy); }
.moods button:hover { transform: translateY(-4px); }
.roles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 44px; }
.role { padding: 26px; border-radius: 22px; border: 1px solid var(--border); background: var(--surface); display: flex; flex-direction: column; gap: 10px; }
.foot { margin-top: 140px; border-top: 1px solid var(--border); padding: 36px 0 80px; font-size: 13px; color: var(--text-muted); }
[data-reveal] { opacity: 0; transform: translateY(24px); transition: opacity 700ms var(--ease-out), transform 700ms var(--spring-gentle); }
[data-reveal].is-in { opacity: 1; transform: none; }
html[data-motion="off"] [data-reveal] { opacity: 1; transform: none; }
@media (max-width: 1000px) { .hero, .story, .vs, .roles { grid-template-columns: 1fr; } .story-sticky { position: relative; top: 0; height: 280px; } .story-steps { gap: 60px; padding: 20px 0; } .sstep { opacity: 1; } .mnav nav { display: none; } .lp { padding: 0 16px; } .hero { padding-top: 36px; } .sec { padding-top: 90px; } }
`;

type Ph = 'pahami' | 'perkuat' | 'kuis' | 'uji';
const ORDER: Ph[] = ['pahami', 'perkuat', 'kuis', 'uji'];
const TABS: [Ph, string, string][] = [['pahami', 'book-open', 'Pahami'], ['perkuat', 'dumbbell', 'Perkuat'], ['kuis', 'zap', 'Kuis'], ['uji', 'swords', 'Uji']];
const SAY: Record<Ph, string> = { pahami: 'Klik “Putar” dan lihat nilainya masuk ke kotak.', perkuat: 'Pilih satu. Kalau salah, kamu dapat petunjuk, bukan hukuman.', kuis: 'Cepat! Jawaban cepat memberi combo.', uji: 'Robot penguji mengecek kodemu satu per satu.' };

function Demo() {
  const [cur, setCur] = useState<Ph>('pahami');
  const [auto, setAuto] = useState(motion() !== 'off');
  const [say, setSay] = useState('Ini contoh asli dari Bab 2 · Variabel. Coba klik!');
  const [mood, setMood] = useState<Mood>('think');
  const [bump, setBump] = useState(0);
  const progRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const nosi = (m: Mood) => { setMood(m); setBump(b => b + 1); };
  useEffect(() => {
    setSay(SAY[cur]); nosi('think');
    ORDER.forEach(p => { const el = progRefs.current[p]; if (el) { el.getAnimations().forEach(a => a.cancel()); el.style.width = auto && ORDER.indexOf(p) < ORDER.indexOf(cur) ? '100%' : '0'; } });
    if (!auto) return;
    progRefs.current[cur]?.animate([{ width: '0%' }, { width: '100%' }], { duration: 7000, easing: 'linear', fill: 'forwards' });
    const t = setTimeout(() => setCur(ORDER[(ORDER.indexOf(cur) + 1) % 4]), 7000);
    return () => clearTimeout(t);
  }, [cur, auto]);
  const stop = () => { if (auto) { setAuto(false); ORDER.forEach(p => progRefs.current[p]?.getAnimations().forEach(a => a.cancel())); } };
  return (
    <div className="demo" data-phase={cur} aria-label="Coba mini-lesson" onClickCapture={stop}>
      <div className="demo-tabs" role="tablist">
        {TABS.map(([p, ic, l]) => (
          <button key={p} className="demo-tab" role="tab" data-phase={p} aria-selected={cur === p} onClick={() => setCur(p)}><Icon name={ic} size={14} />{l}<span className="tprog" ref={el => { progRefs.current[p] = el; }} /></button>
        ))}
      </div>
      <div className="demo-body">
        {cur === 'pahami' && <DemoPahami key="p" auto={auto} onDone={() => nosi('happy')} />}
        {cur === 'perkuat' && <DemoChoice key="pk" tag="Perkuat" title="Skor akan bertambah. Baris mana yang tepat?" choices={[['1', 'const skor = 0;', false], ['2', 'let skor = 0;', true]]} code
          onAnswer={ok => { nosi(ok ? 'happy' : 'oops'); setSay(ok ? 'Tepat! Begitu rasanya di Perkuat dan Kuis.' : 'Petunjuk: nilainya akan berubah. Kotak mana yang tidak digembok?'); }} />}
        {cur === 'kuis' && <DemoChoice key="k" tag="Kuis" timer title="JavaScript pertama dibuat dalam…" choices={[['A', '10 hari', true], ['B', '2 tahun', false]]} cols
          onAnswer={ok => { nosi(ok ? 'happy' : 'oops'); setSay(ok ? 'Tepat! Begitu rasanya di Perkuat dan Kuis.' : 'Hampir! Jawabannya sekitar 10 hari.'); }} />}
        {cur === 'uji' && <DemoUji key="u" auto={auto} onDone={() => { nosi('cheer'); setSay('Lulus! Di aplikasi, momen ini diikuti konfeti dan bab selesai.'); }} />}
      </div>
      <div className="demo-foot"><Nosi size="sm" mood={mood} bump={bump} force /><span>{say}</span></div>
    </div>
  );
}

function DemoPahami({ auto, onDone }: { auto: boolean; onDone: () => void }) {
  const val = useRef<HTMLSpanElement>(null), box = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  const play = () => { setShown(false); flyTo(val.current, box.current).then(() => { setShown(true); pop(box.current); onDone(); }); };
  useEffect(() => { if (auto) { const t = setTimeout(play, 1200); return () => clearTimeout(t); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="demo-pane"><div className="phase-tag">Pahami</div><h3 className="big-serif mt-3" style={{ fontSize: 28 }}>Variabel adalah kotak berlabel.</h3>
      <div className="row between mt-6 wrap gap-4" style={{ alignItems: 'center' }}>
        <div className="t-mono" style={{ fontSize: 22 }}><span className="k">let</span> skor <span className="pn">=</span> <span className="n" ref={val} style={{ display: 'inline-block' }}>10</span><span className="pn">;</span></div>
        <div className="vbox"><span className="tag">skor</span><div className="box" ref={box}><span className="val" style={{ opacity: shown ? 1 : 0 }}>10</span></div></div>
      </div>
      <button className="btn btn-phase btn-lg btn-press mt-6" onClick={play}><Icon name="play" />Putar animasi</button></div>
  );
}

function DemoChoice({ tag, title, choices, onAnswer, timer, cols, code }: { tag: string; title: string; choices: [string, string, boolean][]; onAnswer: (ok: boolean) => void; timer?: boolean; cols?: boolean; code?: boolean }) {
  const [state, setState] = useState<Record<number, 'is-right' | 'is-wrong'>>({});
  const [t, setT] = useState(20);
  useEffect(() => { if (!timer) return; const i = setInterval(() => setT(x => Math.max(0, x - 1)), 1000); return () => clearInterval(i); }, [timer]);
  return (
    <div className="demo-pane">
      <div className="row between"><span className="phase-tag">{tag}</span>
        {timer && <div className="qtimer" style={{ width: 48, height: 48 }}><svg width="48" height="48"><circle className="t-trk" cx="24" cy="24" r="20" /><circle className="t-arc" cx="24" cy="24" r="20" strokeDasharray="125.6" strokeDashoffset={125.6 * (1 - t / 20)} /></svg><span className="t-num" style={{ fontSize: 14 }}>{t}</span></div>}</div>
      <h3 className="big-serif mt-3" style={{ fontSize: 24 }}>{title}</h3>
      <div className={cx('choices', cols && 'cols-2')}>
        {choices.map(([k, text, ok], i) => (
          <button key={i} className={cx('choice', state[i])} onClick={e => { setState(s => ({ ...s, [i]: ok ? 'is-right' : 'is-wrong' })); if (ok) burst(e.currentTarget); else shake(e.currentTarget); onAnswer(ok); }}>
            <span className="key">{k}</span>{code ? <span className="code">{text}</span> : text}</button>
        ))}
      </div>
    </div>
  );
}

function DemoUji({ auto, onDone }: { auto: boolean; onDone: () => void }) {
  const [rows, setRows] = useState<('idle' | 'run' | 'pass')[]>(['idle', 'idle']);
  const btn = useRef<HTMLButtonElement>(null);
  const run = async () => {
    for (let i = 0; i < 2; i++) {
      setRows(r => r.map((x, j) => (j === i ? 'run' : x)));
      await new Promise(o => setTimeout(o, motion() === 'off' ? 0 : 450));
      setRows(r => r.map((x, j) => (j === i ? 'pass' : x)));
    }
    burst(btn.current); onDone();
  };
  useEffect(() => { if (auto) { const t = setTimeout(run, 1500); return () => clearTimeout(t); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="demo-pane"><div className="phase-tag">Uji · Challenge</div>
      <div className="codecard mt-4"><div className="cc-body" style={{ fontSize: 13 }}>
        <div className="cc-line"><span className="k">const</span> tim <span className="pn">=</span> <span className="s">"Garuda"</span><span className="pn">;</span></div>
        <div className="cc-line"><span className="k">let</span> skor <span className="pn">=</span> <span className="n">3</span> <span className="pn">+</span> <span className="n">3</span><span className="pn">;</span></div>
        <div className="cc-line"><span className="p">console</span>.<span className="f">log</span>(tim <span className="pn">+</span> <span className="s">": "</span> <span className="pn">+</span> skor);</div>
      </div></div>
      <div className="robots mt-4">
        {['tim memakai const', 'output “Garuda: 6”'].map((l, i) => (
          <div key={i} className={cx('robot', rows[i] === 'run' && 'is-run', rows[i] === 'pass' && 'is-pass')}><span className="rb"><Icon name={rows[i] === 'run' ? 'loader-circle' : rows[i] === 'pass' ? 'check' : 'bot'} /></span><span>{l}</span><span className="rmeta">{rows[i] === 'pass' ? 'lulus' : ''}</span></div>
        ))}
      </div>
      <button ref={btn} className="btn btn-phase btn-lg btn-press mt-4" onClick={run}><Icon name="play" />Jalankan tes</button></div>
  );
}

const STEPS: [Ph, string, string, Mood, string, string][] = [
  ['pahami', '1', 'book-open', 'think', 'Konsep dijelaskan, bukan ditebak.', 'Satu ide per layar. Animasi menunjukkan apa yang terjadi di dalam program, misalnya nilai masuk ke kotak variabel. Angka di kode bisa kamu geser, dan hasilnya langsung berubah.'],
  ['perkuat', '2', 'dumbbell', 'happy', 'Latihan yang menyesuaikan.', 'Susun baris kode, isi bagian kosong, ketuk baris yang bug. Kalau salah, kamu dapat petunjuk bertingkat dan satu soal serupa. Tidak ada nyawa yang hilang.'],
  ['kuis', '3', 'zap', 'cheer', 'Trivia cepat sebagai gerbang.', '10 soal, 20 detik per soal, dengan combo. Nilai 70% membuka tahap terakhir. Pembahasan selalu muncul di akhir.'],
  ['uji', '4', 'swords', 'happy', 'Buktikan: ulangan atau challenge.', 'Pilih ulangan berwaktu, atau challenge coding sungguhan yang dicek robot penguji satu per satu. Mentor kamu bisa melihat hasil dan kodenya.'],
];

export default function Landing() {
  const { data: me } = useMe();
  const toggleTheme = usePrefs(s => s.toggleTheme);
  const [scrolled, setScrolled] = useState(false);
  const [step, setStep] = useState(0);
  const [bigMood, setBigMood] = useState<Mood>('happy');
  const [bump, setBump] = useState(0);
  const icRef = useRef<HTMLSpanElement>(null);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => { document.title = 'GNOSIA · Pahami dulu, baru ngoding'; const f = () => setScrolled(scrollY > 4); addEventListener('scroll', f, { passive: true }); return () => { removeEventListener('scroll', f); document.title = 'GNOSIA'; }; }, []);
  useEffect(() => {
    const els = root.current!.querySelectorAll<HTMLElement>('[data-reveal]');
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { threshold: .15 });
    els.forEach((el, i) => { el.style.transitionDelay = (i % 4) * 80 + 'ms'; io.observe(el); });
    const so = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { setStep(Number((e.target as HTMLElement).dataset.i)); pop(icRef.current); } }), { rootMargin: '-45% 0px -45% 0px' });
    root.current!.querySelectorAll('.sstep').forEach(s => so.observe(s));
    return () => { io.disconnect(); so.disconnect(); };
  }, []);
  const s = STEPS[step];
  const start = me ? homeFor(me.role) : '/daftar';
  return (
    <div ref={root}>
      <style>{css}</style>
      <header className={cx('mnav', scrolled && 'is-scrolled')}><div className="lp">
        <Link className="logo" to="/"><span className="logo-glyph" /><span className="logo-word">gnosia</span></Link>
        <nav><a href="#cara">Cara belajar</a><a href="#beda">Bedanya</a><a href="#nosi">Nosi</a><a href="#sekolah">Untuk sekolah</a></nav>
        <div className="grow" />
        <button className="btn btn-ghost btn-icon" onClick={toggleTheme} aria-label="Ganti tema"><Icon name="sun-moon" /></button>
        {me ? <Link className="btn btn-primary btn-press" to={start}>Lanjut belajar</Link> : <><Link className="btn btn-ghost hide-sm" to="/masuk">Masuk</Link><Link className="btn btn-primary btn-press" to="/daftar">Mulai gratis</Link></>}
      </div></header>
      <main>
        <section className="lp hero">
          <div>
            <div className="eyebrow">Belajar ngoding · JavaScript untuk pemula</div>
            <h1 className="big-serif mt-4">Pahami dulu.<br /><em>Baru</em> ngoding.</h1>
            <p className="lead-lg">Di GNOSIA, setiap konsep dijelaskan dengan animasi dan kode hidup, lalu diperkuat dengan latihan, diuji lewat kuis singkat, dan terakhir dibuktikan lewat ulangan atau challenge.</p>
            <div className="hero-phases">{ORDER.map((p, i) => <span key={p} className="phase-tag" data-phase={p}>{i + 1} · {p[0].toUpperCase() + p.slice(1)}</span>)}</div>
            <div className="row gap-3 mt-8 wrap"><Link className="btn btn-primary btn-xl btn-press" to={start}>{me ? 'Lanjut belajar' : 'Mulai Bab 1, gratis'}<Icon name="arrow-right" /></Link><a className="btn btn-ghost btn-xl" href="#cara">Lihat caranya</a></div>
            <p className="t-sm t-faint mt-4">Tanpa instalasi. Langsung di browser, juga di HP.</p>
          </div>
          <Demo />
        </section>

        <section className="lp sec" id="cara">
          <div className="eyebrow" data-reveal>Cara belajar di GNOSIA</div>
          <h2 className="big-serif mt-3" data-reveal>Empat langkah, selalu berurutan.</h2>
          <p className="lead-lg" data-reveal>Kamu tidak dilempar ke soal sebelum paham. Kamu juga tidak diuji sebelum sempat berlatih.</p>
          <div className="story">
            <div className="story-sticky" data-phase={s[0]}><span className="big-num">{s[1]}</span><span className="big-ic" ref={icRef}><Icon name={s[2]} /></span><Nosi size="lg" mood={s[3]} bump={step} force /></div>
            <div className="story-steps">
              {STEPS.map(([p, , , , h, t], i) => <div key={p} className={cx('sstep', step === i && 'is-on')} data-i={i}><span className="phase-tag" data-phase={p}>{p[0].toUpperCase() + p.slice(1)}</span><h3>{h}</h3><p>{t}</p></div>)}
            </div>
          </div>
        </section>

        <section className="lp sec" id="beda">
          <div className="eyebrow" data-reveal>Bedanya</div>
          <h2 className="big-serif mt-3" data-reveal>Latihan tanpa fondasi itu menebak-nebak.</h2>
          <div className="vs">
            <div data-reveal><div className="t-label">Kebanyakan platform</div><div className="flow">{['Soal', 'Salah', 'Lihat jawaban', 'Lupa'].map((x, i) => <Fragment key={x}><span>{x}</span>{i < 3 && <Icon name="arrow-right" size={14} className="t-faint" />}</Fragment>)}</div><p className="t-sm t-muted mt-4">Praktik dulu tanpa pemahaman. Jawabannya bisa dihafal, tapi konsepnya tidak ikut.</p></div>
            <div data-reveal style={{ borderColor: 'var(--pahami-line)' }}><div className="t-label" style={{ color: 'var(--pahami-ink)' }}>GNOSIA</div>
              <div className="flow">{ORDER.map((p, i) => <Fragment key={p}><span style={{ background: `var(--${p}-soft)`, color: `var(--${p}-ink)` }}>{p[0].toUpperCase() + p.slice(1)}</span>{i < 3 && <Icon name="arrow-right" size={14} className="t-faint" />}</Fragment>)}</div>
              <p className="t-sm t-muted mt-4">Fondasi dulu, lalu penguatan, lalu pembuktian. Setiap langkah menyiapkan langkah berikutnya.</p></div>
          </div>
        </section>

        <section className="lp sec" id="nosi">
          <div className="row gap-12 wrap" style={{ alignItems: 'center' }}>
            <div data-reveal><Nosi mood={bigMood} bump={bump} style={{ width: 220, height: 220 }} force /></div>
            <div className="grow" style={{ minWidth: 280 }}>
              <div className="eyebrow" data-reveal>Teman belajar</div>
              <h2 className="big-serif mt-3" data-reveal>Ini <em>Nosi</em>. Sayapnya dari kurung kurawal.</h2>
              <p className="lead-lg" data-reveal>Nosi ikut bereaksi saat kamu belajar dan memberi petunjuk kalau kamu minta. Nosi tidak pernah langsung memberi jawaban.</p>
              <div className="moods" data-reveal>
                {([['think', 'Mikir'], ['happy', 'Senang'], ['cheer', 'Semangat'], ['oops', 'Ups']] as const).map(([m, l]) => <button key={m} onClick={() => { setBigMood(m); setBump(b => b + 1); }}><Nosi size="sm" mood={m} force />{l}</button>)}
              </div>
            </div>
          </div>
        </section>

        <section className="lp sec" id="sekolah">
          <div className="eyebrow" data-reveal>Untuk guru &amp; sekolah</div>
          <h2 className="big-serif mt-3" data-reveal>Guru melihat siapa yang macet, dan di fase mana.</h2>
          <div className="roles">
            <div className="role" data-reveal data-tilt><Icon name="graduation-cap" size={20} className="t-accent" /><div className="t-h3">Siswa</div><p className="t-sm t-muted">Jalur belajar bertahap, playground bebas, proyek portofolio.</p></div>
            <div className="role" data-reveal data-tilt><Icon name="users" size={20} style={{ color: 'var(--perkuat-ink)' }} /><div className="t-h3">Mentor</div><p className="t-sm t-muted">“Alex salah 4× di Perkuat” lebih berguna daripada “42 siswa terdaftar”.</p></div>
            <div className="role" data-reveal data-tilt><Icon name="blocks" size={20} style={{ color: 'var(--uji-ink)' }} /><div className="t-h3">Admin kurikulum</div><p className="t-sm t-muted">Susun bab, scene animasi, bank soal, dan challenge tanpa menulis kode frontend.</p></div>
          </div>
        </section>

        <section className="lp sec t-center">
          <h2 className="big-serif" style={{ margin: '0 auto' }} data-reveal>Baris kode pertamamu tinggal <em>90 detik</em> lagi.</h2>
          <div className="row center gap-3 mt-8" data-reveal><Link className="btn btn-primary btn-xl btn-press" to={start}>{me ? 'Lanjut belajar' : 'Mulai gratis'}</Link>{!me && <Link className="btn btn-ghost btn-xl" to="/masuk">Sudah punya akun</Link>}</div>
        </section>
        <footer className="lp foot"><div className="row between wrap gap-6"><Link className="logo" to="/"><span className="logo-glyph" /><span className="logo-word">gnosia</span></Link><div className="row gap-6 wrap"><a href="#cara">Cara belajar</a><a href="#sekolah">Sekolah</a></div><span className="t-faint">© {new Date().getFullYear()} GNOSIA</span></div></footer>
      </main>
    </div>
  );
}
