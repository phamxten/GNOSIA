import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Icon } from '../design/Icon';
import { Avatar, Flame } from '../design/ui';
import { useApi, useMe } from '../api/hooks';
import { api } from '../api/client';
import { usePrefs } from '../state/prefs';
import type { Me } from '../api/types';

type NavItem = { id: string; icon: string; label: string; to: string; match?: (p: string) => boolean };

const LEARNER: NavItem[] = [
  { id: 'beranda', icon: 'house', label: 'Beranda', to: '/beranda' },
  { id: 'peta', icon: 'map', label: 'Peta', to: '/peta', match: p => p.startsWith('/peta') || /^\/bab\/\d+\/?$/.test(p) },
  { id: 'playground', icon: 'notebook-pen', label: 'Playground', to: '/playground' },
  { id: 'proyek', icon: 'folder-kanban', label: 'Proyek', to: '/proyek' },
  { id: 'progres', icon: 'sparkles', label: 'Progres', to: '/progres' },
];
const MENTOR: NavItem[] = [
  { id: 'mentor', icon: 'layout-dashboard', label: 'Ringkasan', to: '/mentor', match: p => p === '/mentor' },
  { id: 'siswa', icon: 'users', label: 'Siswa', to: '/mentor/siswa', match: p => p.startsWith('/mentor/siswa') },
  { id: 'review', icon: 'message-square-code', label: 'Antrian review', to: '/mentor/review' },
];

export function Logo({ to }: { to: string }) {
  return <Link className="logo" to={to}><span className="logo-glyph" /><span className="logo-word">gnosia</span></Link>;
}

/** Top navigation (learner / mentor) with the sliding pill, plus the mobile tab bar. */
export function AppNav({ role }: { role: 'learner' | 'mentor' }) {
  const { data: me } = useMe();
  const loc = useLocation();
  const items = role === 'mentor' ? MENTOR : LEARNER;
  const active = items.find(i => (i.match ? i.match(loc.pathname) : loc.pathname.startsWith(i.to)))?.id;
  const linksRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const place = (a: HTMLElement | null | undefined) => {
    const pill = pillRef.current;
    if (!pill) return;
    if (!a) { pill.style.width = '0'; return; }
    pill.style.left = a.offsetLeft + 'px';
    pill.style.width = a.offsetWidth + 'px';
  };
  const current = () => linksRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
  useLayoutEffect(() => { requestAnimationFrame(() => place(current())); }, [active]);
  useEffect(() => {
    const f = () => setScrolled(scrollY > 4);
    addEventListener('scroll', f, { passive: true });
    const r = () => place(current());
    addEventListener('resize', r);
    document.fonts?.ready.then(r);
    return () => { removeEventListener('scroll', f); removeEventListener('resize', r); };
  }, []);
  useEffect(() => { document.body.classList.add('has-tabbar'); return () => document.body.classList.remove('has-tabbar'); }, []);
  return (
    <>
      <header className={`nav${scrolled ? ' is-scrolled' : ''}`}>
        <Logo to={role === 'mentor' ? '/mentor' : '/beranda'} />
        <div className="nav-links" role="navigation" ref={linksRef} onPointerLeave={() => place(current())}>
          <span className="nav-pill" aria-hidden="true" ref={pillRef} />
          {items.map(i => (
            <NavLink key={i.id} className="nav-link" to={i.to} aria-current={i.id === active ? 'page' : undefined}
              onPointerEnter={e => place(e.currentTarget)}>
              <Icon name={i.icon} />{i.label}
            </NavLink>
          ))}
        </div>
        <div className="nav-right">
          {role === 'mentor' ? (
            <>
              <span className="badge badge-mono hide-sm">{me?.role === 'admin' ? 'ADMIN' : 'MENTOR'}</span>
              {me?.role === 'admin' && <Link className="btn btn-ghost btn-sm hide-sm" to="/admin"><Icon name="layout-dashboard" />Admin</Link>}
              <button className="btn btn-ghost btn-icon" data-palette-open aria-label="Cari"><Icon name="search" /></button>
              <AccountMenu me={me} />
            </>
          ) : (
            <>
              <span className="stat-chip" title={`Streak ${me?.streak ?? 0} hari`}><Flame /><span data-streak>{me?.streak ?? 0}</span></span>
              <span className="stat-chip hide-sm" title="XP minggu ini"><Icon name="zap" style={{ color: 'var(--xp)' }} /><span data-xp>{me?.xp_week ?? 0}</span></span>
              <button className="btn btn-ghost btn-icon hide-sm" data-palette-open aria-label="Cari (⌘K)"><Icon name="search" /></button>
              <AccountMenu me={me} />
            </>
          )}
        </div>
      </header>
      <nav className="tabbar" aria-label="Navigasi">
        {items.map(i => (
          <Link key={i.id} to={i.to} aria-current={i.id === active ? 'page' : undefined}><Icon name={i.icon} size={20} />{i.label}</Link>
        ))}
      </nav>
    </>
  );
}

function AccountMenu({ me }: { me: Me | null | undefined }) {
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const qc = useQueryClient();
  const toggleTheme = usePrefs(s => s.toggleTheme);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const f = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', f);
    return () => document.removeEventListener('mousedown', f);
  }, [open]);
  const logout = async () => { await api.post('/api/auth/logout'); qc.clear(); nav('/masuk'); };
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="avatar-btn" aria-label="Akun" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <Avatar p={me} />
        {!!me?.unread && <span className="unread-dot" aria-label={`${me.unread} notifikasi baru`} />}
      </button>
      {open && (
        <div className="menu account-menu" role="menu">
          <div className="t-sm t-medium" style={{ padding: '6px 8px 2px' }}>{me?.name}</div>
          <div className="t-xs t-faint" style={{ padding: '0 8px 6px' }}>{me?.email}</div>
          <Link className="menu-item" to="/pengaturan" onClick={() => setOpen(false)}><Icon name="settings" />Pengaturan</Link>
          {me?.role === 'learner' && <Link className="menu-item" to="/progres#feedback" onClick={() => setOpen(false)}><Icon name="bell" />Notifikasi{me.unread ? <span className="badge badge-accent" style={{ marginLeft: 'auto' }}>{me.unread}</span> : null}</Link>}
          {me?.role !== 'learner' && <Link className="menu-item" to={me?.role === 'admin' ? '/admin' : '/mentor'} onClick={() => setOpen(false)}><Icon name="layout-dashboard" />{me?.role === 'admin' ? 'Admin' : 'Mentor'}</Link>}
          <button className="menu-item w-full" onClick={() => { toggleTheme(); setOpen(false); }}><Icon name="sun-moon" />Ganti tema</button>
          <button className="menu-item w-full" onClick={logout}><Icon name="log-out" />Keluar</button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- admin
type AdminCounts = { chapters: number; perkuat: number; kuis: number; challenge: number; ulangan: number; proyek: number };
const fmt = (n?: number) => (n === undefined ? '' : n >= 1000 ? (n / 1000).toFixed(1).replace('.', ',') + 'k' : String(n));

export function AdminSidebar() {
  const { data: me } = useMe();
  const { data: c } = useApi<AdminCounts>('/api/admin/counts');
  const loc = useLocation();
  const toggleTheme = usePrefs(s => s.toggleTheme);
  const groups: [string, [string, string, string, string, string?][]][] = [
    ['Ringkasan', [['admin', 'layout-dashboard', 'Dashboard', '/admin'], ['mentor', 'chart-no-axes-column', 'Tampilan mentor', '/mentor']]],
    ['Konten', [['bab', 'blocks', 'Bab & Scene', '/admin/bab', fmt(c?.chapters)], ['perkuat', 'list-checks', 'Bank soal Perkuat', '/admin/bab?fokus=perkuat', fmt(c?.perkuat)],
      ['kuis', 'zap', 'Bank soal Kuis', '/admin/bab?fokus=kuis', fmt(c?.kuis)], ['challenge', 'swords', 'Challenge', '/admin/bab?fokus=challenge', fmt(c?.challenge)],
      ['ulangan', 'timer', 'Ulangan', '/admin/bab?fokus=ulangan', fmt(c?.ulangan)], ['proyek', 'folder-kanban', 'Proyek', '/admin/bab?fokus=proyek', fmt(c?.proyek)]]],
    ['Orang', [['users', 'users', 'Pengguna', '/admin/pengguna'], ['mentors', 'graduation-cap', 'Mentor', '/admin/pengguna?peran=mentor'], ['org', 'building-2', 'Kelas', '/admin/pengguna?tab=kelas']]],
    ['Sistem', [['settings', 'settings', 'Pengaturan', '/pengaturan']]],
  ];
  const full = loc.pathname + loc.search;
  const isActive = (to: string) => (to.includes('?') ? full === to : loc.pathname === to && (!loc.search || to !== '/admin/bab' || !loc.search.includes('fokus')));
  return (
    <aside className="sidebar">
      <div className="row between" style={{ padding: '4px 6px 12px' }}><Logo to="/admin" /><span className="badge badge-mono">ADMIN</span></div>
      {groups.map(([g, items]) => (
        <div className="sidebar-group" key={g}>
          <span className="t-label">{g}</span>
          {items.map(([id, ic, label, to, n]) => (
            <Link key={id} className="nav-item" to={to} aria-current={isActive(to) ? 'page' : undefined}><Icon name={ic} />{label}{n ? <span className="count">{n}</span> : null}</Link>
          ))}
        </div>
      ))}
      <div style={{ flex: 1 }} />
      <div className="row" style={{ padding: '10px 6px 0', borderTop: '1px solid var(--divider)', marginTop: 12 }}>
        <Avatar p={me} size="sm" />
        <div className="grow"><div className="t-sm t-medium">{me?.name}</div><div className="t-xs t-faint">{me?.title}</div></div>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={toggleTheme} aria-label="Ganti tema"><Icon name="sun-moon" /></button>
      </div>
    </aside>
  );
}

export function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="app"><AdminSidebar /><main className="main">{children}</main></div>;
}

// ---------------------------------------------------------------- palette ⌘K
type PalItem = { icon: string; title: string; hint?: string; href?: string; kbd?: string; action?: () => void };
type PaletteData = { continue: PalItem[]; chapters: PalItem[]; concepts: PalItem[] };

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const { data: me } = useMe();
  // Disabled inside Kuis and Uji to protect assessment integrity.
  const blocked = /\/(kuis|uji)(\/|$)/.test(loc.pathname) || loc.pathname.startsWith('/kuis-harian');
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (!blocked && me) setOpen(o => !o);
      }
    };
    const c = (e: MouseEvent) => { if ((e.target as Element)?.closest?.('[data-palette-open]') && !blocked) setOpen(true); };
    document.addEventListener('keydown', k);
    document.addEventListener('click', c);
    return () => { document.removeEventListener('keydown', k); document.removeEventListener('click', c); };
  }, [blocked, me]);
  useEffect(() => setOpen(false), [loc.pathname]);
  if (!open || !me) return null;
  return createPortal(<Palette me={me} close={() => setOpen(false)} />, document.body);
}

function Palette({ me, close }: { me: Me; close: () => void }) {
  const nav = useNavigate();
  const toggleTheme = usePrefs(s => s.toggleTheme);
  const { data } = useApi<PaletteData>('/api/palette');
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const groups = useMemo<[string, PalItem[]][]>(() => {
    const learner = me.role === 'learner';
    const go: PalItem[] = learner
      ? [{ icon: 'house', title: 'Beranda', href: '/beranda', kbd: 'G B' }, { icon: 'map', title: 'Peta belajar', href: '/peta', kbd: 'G P' },
         { icon: 'notebook-pen', title: 'Playground', hint: 'Ngoding bebas', href: '/playground', kbd: 'G N' }, { icon: 'sparkles', title: 'Progres', href: '/progres' },
         { icon: 'folder-kanban', title: 'Proyek', href: '/proyek' }]
      : [{ icon: 'layout-dashboard', title: 'Ringkasan kelas', href: '/mentor' }, { icon: 'message-square-code', title: 'Antrian review', href: '/mentor/review' },
         ...(me.role === 'admin' ? [{ icon: 'blocks', title: 'Builder bab', href: '/admin/bab' }, { icon: 'users', title: 'Pengguna', href: '/admin/pengguna' }] : [])];
    const actions: PalItem[] = [
      ...(learner ? [{ icon: 'plus', title: 'Notebook baru', hint: 'Tanpa pelajaran', href: '/playground?baru=1' }] : []),
      { icon: 'sun-moon', title: 'Ganti tema', hint: 'Paper / Ink', action: toggleTheme },
      { icon: 'wind', title: 'Intensitas animasi', hint: 'Penuh · Kalem · Mati', href: '/pengaturan#motion' },
    ];
    return [['Lanjutkan', data?.continue || []], ['Pergi ke', go], ['Bab', data?.chapters || []], ['Konsep', data?.concepts || []], ['Aksi', actions]];
  }, [data, me.role, toggleTheme]);
  const needle = q.toLowerCase().trim();
  const filtered = groups.map(([g, items]) => [g, items.filter(i => !needle || (i.title + (i.hint || '')).toLowerCase().includes(needle))] as [string, PalItem[]])
    .filter(([g, items]) => items.length && (needle || !['Bab', 'Konsep'].includes(g)));
  const flat = filtered.flatMap(([, items]) => items);
  const choose = (i: PalItem) => { close(); if (i.action) i.action(); else if (i.href) nav(i.href); };
  let n = 0;
  return (
    <div>
      <div className="scrim" onClick={close} />
      <div className="palette" role="dialog" aria-modal="true" aria-label="Perintah">
        <div className="palette-input">
          <Icon name="search" size={20} style={{ color: 'var(--text-faint)' }} />
          <input autoFocus placeholder="Cari bab, konsep, perintah…" aria-label="Cari" value={q}
            onChange={e => { setQ(e.target.value); setIdx(0); }}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { setIdx(i => Math.min(i + 1, flat.length - 1)); e.preventDefault(); }
              if (e.key === 'ArrowUp') { setIdx(i => Math.max(i - 1, 0)); e.preventDefault(); }
              if (e.key === 'Enter' && flat[idx]) choose(flat[idx]);
              if (e.key === 'Escape') close();
            }} />
          <kbd>esc</kbd>
        </div>
        <div className="palette-list" role="listbox">
          {filtered.length ? filtered.map(([g, items]) => (
            <div key={g}>
              <div className="palette-group t-label">{g}</div>
              {items.map(i => {
                const my = n++;
                return (
                  <div key={g + i.title} role="option" aria-selected={my === idx} className={`palette-item${my === idx ? ' is-active' : ''}`}
                    onMouseEnter={() => setIdx(my)} onClick={() => choose(i)}>
                    <Icon name={i.icon} /><span>{i.title}</span>{i.hint && <span className="hint">{i.hint}</span>}{i.kbd && <span className="kbd">{i.kbd}</span>}
                  </div>
                );
              })}
            </div>
          )) : <div className="empty" style={{ padding: 32 }}><p>Tidak ada hasil untuk “{q}”.</p></div>}
        </div>
        <div className="palette-foot"><span><kbd>↑</kbd><kbd>↓</kbd> pilih</span><span><kbd>↵</kbd> buka</span><span><kbd>esc</kbd> tutup</span></div>
      </div>
    </div>
  );
}
