/* =========================================================================
   GNOSIA v2 mockups — shell & shared behaviour (vanilla JS, no build step)
   Theme · navigation (learner / mentor / admin) · command palette · toasts ·
   tabs · page-state switcher (mockup only) · mockup flow navigator.
   Effects live in motion.js (window.G).
   ========================================================================= */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} },
  };
  const page = (location.pathname.split('/').pop() || 'index.html').replace('.html', '');
  const params = new URLSearchParams(location.search);
  const icons = () => window.lucide && window.lucide.createIcons({ attrs: { 'stroke-width': 1.75 } });
  window.gnosiaIcons = icons;

  /* ---------- Theme ---------------------------------------------------------- */
  function setTheme(t) { document.documentElement.dataset.theme = t; store.set('gnosia-theme', t); $$('[data-theme-label]').forEach(el => (el.textContent = t === 'ink' ? 'Ink' : 'Paper')); }
  document.addEventListener('click', e => { if (e.target.closest('[data-theme-toggle]')) setTheme(document.documentElement.dataset.theme === 'ink' ? 'paper' : 'ink'); });

  /* ---------- Navigation ------------------------------------------------------ */
  const FLAME = '<svg class="flame" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2c1 3.5 5 6 5 11a5 5 0 0 1-10 0c0-2.2 1-3.6 2.2-4.8.3 1.5 1 2.5 2 3C11 8.5 11.5 5 12 2z"/></svg>';
  const NAV = {
    learner: [
      ['dashboard', 'house', 'Beranda', 'dashboard.html'],
      ['peta', 'map', 'Peta', 'peta.html'],
      ['playground', 'notebook-pen', 'Playground', 'playground.html'],
      ['proyek', 'folder-kanban', 'Proyek', 'proyek.html'],
      ['progress', 'sparkles', 'Progres', 'progress.html'],
    ],
    mentor: [
      ['mentor', 'layout-dashboard', 'Ringkasan', 'mentor.html'],
      ['siswa', 'users', 'Siswa', 'siswa.html'],
      ['review', 'message-square-code', 'Antrian review', 'siswa.html#review'],
    ],
  };
  function renderNav(el) {
    const role = el.dataset.nav, active = el.dataset.active || page, items = NAV[role];
    const right = role === 'mentor'
      ? `<span class="badge badge-mono hide-sm">MENTOR</span><button class="btn btn-ghost btn-icon" data-palette-open aria-label="Cari"><i data-lucide="search"></i></button><span class="avatar a2">DR</span>`
      : `<span class="stat-chip" title="Streak 12 hari">${FLAME}<span data-streak>12</span></span>
         <span class="stat-chip hide-sm" title="XP minggu ini"><i data-lucide="zap" style="color:var(--xp)"></i><span data-xp>340</span></span>
         <button class="btn btn-ghost btn-icon hide-sm" data-palette-open aria-label="Cari (⌘K)"><i data-lucide="search"></i></button>
         <a href="settings.html" class="avatar" aria-label="Akun">NA</a>`;
    el.className = 'nav';
    el.innerHTML = `<a class="logo" href="${role === 'mentor' ? 'mentor.html' : 'dashboard.html'}"><span class="logo-glyph"></span><span class="logo-word">gnosia</span></a>
      <div class="nav-links" role="navigation"><span class="nav-pill" aria-hidden="true"></span>
      ${items.map(([id, ic, label, href]) => `<a class="nav-link" href="${href}" ${id === active ? 'aria-current="page"' : ''}><i data-lucide="${ic}"></i>${label}</a>`).join('')}</div>
      <div class="nav-right">${right}</div>`;
    // Mobile tab bar
    const tb = document.createElement('nav'); tb.className = 'tabbar'; tb.setAttribute('aria-label', 'Navigasi');
    tb.innerHTML = items.map(([id, ic, label, href]) => `<a href="${href}" ${id === active ? 'aria-current="page"' : ''}><i data-lucide="${ic}" class="i-20"></i>${label}</a>`).join('');
    document.body.appendChild(tb); document.body.classList.add('has-tabbar');
    // Sliding pill under the active link (animates on hover as preview)
    const pill = $('.nav-pill', el), links = $$('.nav-link', el);
    const place = a => { if (!a) { pill.style.width = '0'; return; } pill.style.left = a.offsetLeft + 'px'; pill.style.width = a.offsetWidth + 'px'; };
    const cur = links.find(a => a.getAttribute('aria-current'));
    requestAnimationFrame(() => place(cur));
    links.forEach(a => a.addEventListener('pointerenter', () => place(a)));
    $('.nav-links', el).addEventListener('pointerleave', () => place(cur));
    addEventListener('scroll', () => el.classList.toggle('is-scrolled', scrollY > 4), { passive: true });
  }

  const ADMIN_NAV = [
    ['Ringkasan', [['admin', 'layout-dashboard', 'Dashboard', 'admin.html'], ['analitik', 'chart-no-axes-column', 'Analitik', '#']]],
    ['Konten', [['builder', 'blocks', 'Bab & Scene', 'builder.html', '42'], ['soal', 'list-checks', 'Bank soal Perkuat', 'builder.html#perkuat', '1.2k'], ['kuis', 'zap', 'Bank soal Kuis', 'builder.html#kuis', '860'], ['challenge', 'swords', 'Challenge', 'builder.html#challenge', '187'], ['ulangan', 'timer', 'Ulangan', '#', '38'], ['proyek', 'folder-kanban', 'Proyek', '#', '24']]],
    ['Orang', [['users', 'users', 'Pengguna', '#'], ['mentor', 'graduation-cap', 'Mentor', '#'], ['org', 'building-2', 'Sekolah', '#']]],
    ['Sistem', [['langganan', 'credit-card', 'Langganan', '#'], ['izin', 'shield-check', 'Hak akses', '#'], ['settings', 'settings', 'Pengaturan', 'settings.html']]],
  ];
  function renderAdminSidebar(el) {
    const active = el.dataset.active || page;
    el.innerHTML = `<div class="row between" style="padding:4px 6px 12px"><a class="logo" href="admin.html"><span class="logo-glyph"></span><span class="logo-word">gnosia</span></a><span class="badge badge-mono">ADMIN</span></div>
      ${ADMIN_NAV.map(([g, items]) => `<div class="sidebar-group"><span class="t-label">${g}</span>${items.map(([id, ic, label, href, n]) => `<a class="nav-item" href="${href}" ${id === active ? 'aria-current="page"' : ''}><i data-lucide="${ic}"></i>${label}${n ? `<span class="count">${n}</span>` : ''}</a>`).join('')}</div>`).join('')}
      <div style="flex:1"></div>
      <div class="row" style="padding:10px 6px 0;border-top:1px solid var(--divider);margin-top:12px"><span class="avatar avatar-sm a3">SR</span><div class="grow"><div class="t-sm t-medium">Sekar Rahma</div><div class="t-xs t-faint">Kurikulum · SMK SIG</div></div><button class="btn btn-ghost btn-icon btn-sm" data-theme-toggle aria-label="Ganti tema"><i data-lucide="sun-moon"></i></button></div>`;
  }

  /* ---------- Mockup flow navigator (not product UI) ------------------------- */
  const FLOWS = {
    siswa: ['landing', 'login', 'dashboard', 'peta', 'bab', 'pahami', 'perkuat', 'kuis', 'ulangan', 'challenge', 'playground', 'proyek', 'progress', 'settings'],
    mentor: ['mentor', 'siswa'],
    admin: ['admin', 'builder'],
  };
  function renderMockNav() {
    if (page === 'index' || params.has('clean')) return;
    let flow, i;
    for (const [name, list] of Object.entries(FLOWS)) { const k = list.indexOf(page); if (k > -1) { flow = name; i = k; } }
    if (!flow) return;
    const list = FLOWS[flow], nav = document.createElement('nav');
    nav.className = 'mock-nav'; nav.setAttribute('aria-label', 'Navigasi mockup');
    nav.innerHTML = `<a href="index.html" title="Semua layar"><i data-lucide="layout-grid"></i></a>
      ${i > 0 ? `<a href="${list[i - 1]}.html"><i data-lucide="arrow-left"></i></a>` : ''}
      <span class="mock-title">${flow} · ${i + 1}/${list.length} · ${page}</span>
      ${i < list.length - 1 ? `<a href="${list[i + 1]}.html">${list[i + 1]}<i data-lucide="arrow-right"></i></a>` : ''}
      <button data-theme-toggle title="Paper / Ink"><i data-lucide="sun-moon"></i></button>`;
    document.body.appendChild(nav);
  }

  /* ---------- Command palette (⌘K) ------------------------------------------ */
  const PALETTE = [
    ['Lanjutkan', [['play', 'Lanjut: Parameter Fungsi', 'Fungsi · Perkuat 3/8', 'perkuat.html'], ['zap', 'Kuis harian', '5 soal · 2 menit', 'kuis.html']]],
    ['Pergi ke', [['house', 'Beranda', '', 'dashboard.html', 'G B'], ['map', 'Peta belajar', '', 'peta.html', 'G P'], ['notebook-pen', 'Playground', 'Ngoding bebas', 'playground.html', 'G N'], ['sparkles', 'Progres', '', 'progress.html']]],
    ['Aksi', [['plus', 'Notebook baru', 'Tanpa pelajaran', 'playground.html'], ['sun-moon', 'Ganti tema', 'Paper / Ink', 'theme'], ['wind', 'Intensitas animasi', 'Penuh · Kalem · Mati', 'settings.html#motion']]],
  ];
  let pal = null;
  function openPalette() {
    if (pal) return;
    pal = document.createElement('div');
    pal.innerHTML = `<div class="scrim" data-palette-close></div><div class="palette" role="dialog" aria-modal="true" aria-label="Perintah">
      <div class="palette-input"><i data-lucide="search" class="i-20" style="color:var(--text-faint)"></i><input placeholder="Cari bab, konsep, perintah…" aria-label="Cari"/><kbd>esc</kbd></div>
      <div class="palette-list" role="listbox"></div>
      <div class="palette-foot"><span><kbd>↑</kbd><kbd>↓</kbd> pilih</span><span><kbd>↵</kbd> buka</span><span><kbd>esc</kbd> tutup</span></div></div>`;
    document.body.appendChild(pal);
    const input = $('input', pal), list = $('.palette-list', pal); let idx = 0;
    const draw = () => {
      const q = input.value.toLowerCase().trim(); let n = 0;
      list.innerHTML = PALETTE.map(([g, items]) => { const hit = items.filter(it => !q || (it[1] + it[2]).toLowerCase().includes(q)); if (!hit.length) return '';
        return `<div class="palette-group t-label">${g}</div>` + hit.map(([ic, t, h, href, k]) => `<a class="palette-item ${n++ === idx ? 'is-active' : ''}" href="${href === 'theme' ? '#' : href}" ${href === 'theme' ? 'data-theme-toggle' : ''}><i data-lucide="${ic}"></i><span>${t}</span>${h ? `<span class="hint">${h}</span>` : ''}${k ? `<span class="kbd">${k}</span>` : ''}</a>`).join(''); }).join('')
        || `<div class="empty" style="padding:32px"><p>Tidak ada hasil untuk “${input.value}”.</p></div>`;
      icons();
    };
    input.addEventListener('input', () => { idx = 0; draw(); });
    input.addEventListener('keydown', e => { const it = $$('.palette-item', list);
      if (e.key === 'ArrowDown') { idx = Math.min(idx + 1, it.length - 1); draw(); e.preventDefault(); }
      if (e.key === 'ArrowUp') { idx = Math.max(idx - 1, 0); draw(); e.preventDefault(); }
      if (e.key === 'Enter' && it[idx]) it[idx].click(); });
    draw(); input.focus();
  }
  const closePalette = () => { if (pal) { pal.remove(); pal = null; } };
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); pal ? closePalette() : openPalette(); }
    if (e.key === 'Escape') closePalette();
  });
  document.addEventListener('click', e => { if (e.target.closest('[data-palette-open]')) openPalette(); if (e.target.closest('[data-palette-close]')) closePalette(); });

  /* ---------- Toast ------------------------------------------------------------ */
  function toast({ kind = 'accent', icon = 'info', title = '', body = '', ms = 4200 }) {
    let st = $('.toast-stack'); if (!st) { st = document.createElement('div'); st.className = 'toast-stack'; st.setAttribute('aria-live', 'polite'); document.body.appendChild(st); }
    const t = document.createElement('div'); t.className = `toast is-${kind}`; t.setAttribute('role', 'status');
    t.innerHTML = `<i data-lucide="${icon}" class="toast-icon"></i><div class="grow"><div class="t-medium">${title}</div>${body ? `<div class="t-muted t-sm mt-1">${body}</div>` : ''}</div><button class="btn btn-ghost btn-icon btn-sm" aria-label="Tutup"><i data-lucide="x"></i></button>`;
    st.appendChild(t); icons();
    const kill = () => { t.classList.add('is-leaving'); setTimeout(() => t.remove(), 160); };
    $('button', t).onclick = kill; setTimeout(kill, ms);
  }
  window.gnosiaToast = toast;
  document.addEventListener('click', e => { const b = e.target.closest('[data-toast]'); if (b) { const [kind, icon, title, body] = b.dataset.toast.split('|'); toast({ kind, icon, title, body }); } });

  /* ---------- Generic interactions ------------------------------------------- */
  document.addEventListener('click', e => {
    let tab = e.target.closest('[data-tab]');
    if (tab && tab.getAttribute('role') !== 'tab') tab = document.querySelector(`[role="tab"][data-tab="${tab.dataset.tab}"]`) || tab;
    if (tab) { const [g] = tab.dataset.tab.split(':');
      $$(`[data-tab^="${g}:"]`).forEach(t => t.setAttribute('aria-selected', String(t === tab)));
      $$(`[data-tab-panel^="${g}:"]`).forEach(p => (p.hidden = p.dataset.tabPanel !== tab.dataset.tab)); icons(); }
    const tg = e.target.closest('[data-toggle]');
    if (tg) { const [sel, cls] = tg.dataset.toggle.split('|'); $$(sel).forEach(el => el.classList.toggle(cls)); }
    const seg = e.target.closest('.segmented button'); if (seg) $$('button', seg.parentElement).forEach(b => b.setAttribute('aria-pressed', String(b === seg)));
    // Toggle chips; inside [data-single] exactly one child is pressed
    const single = e.target.closest('[data-single] > [aria-pressed]');
    if (single) { $$(':scope > [aria-pressed]', single.parentElement).forEach(c => c.setAttribute('aria-pressed', String(c === single))); window.G && G.pop(single); }
    else { const chip = e.target.closest('button.chip[aria-pressed]'); if (chip) chip.setAttribute('aria-pressed', String(chip.getAttribute('aria-pressed') !== 'true')); }
    const rv = e.target.closest('.reveal'); if (rv) rv.classList.toggle('is-open');
  });

  /* ---------- Page-state switcher (mockup) ----------------------------------- */
  function initPageStates() {
    const bar = $('[data-page-states]'); if (!bar) return;
    const apply = s => {
      $$('[data-show-in]').forEach(el => (el.hidden = !el.dataset.showIn.split(' ').includes(s)));
      $$('[data-page-state]', bar).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.pageState === s)));
      document.body.dataset.state = s; icons();
      document.dispatchEvent(new CustomEvent('gnosia:state', { detail: s }));
    };
    window.gnosiaState = apply;
    bar.addEventListener('click', e => { const b = e.target.closest('[data-page-state]'); if (b) apply(b.dataset.pageState); });
    apply(params.get('state') || $('[data-page-state]', bar).dataset.pageState);
  }

  /* ---------- Countdown ([data-countdown="seconds"]) ------------------------- */
  function initCountdowns() {
    // Pages may set el._left to jump the clock (mockup states)
    $$('[data-countdown]').forEach(el => { el._left = +el.dataset.countdown; const out = $('.tval', el) || el;
      const tick = () => { const left = el._left, m = Math.floor(left / 60), s = left % 60; out.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        el.classList.toggle('is-low', left <= 300 && left > 60); el.classList.toggle('is-critical', left <= 60); if (left > 0) el._left--; };
      tick(); setInterval(tick, 1000); });
  }

  /* ---------- Boot ----------------------------------------------------------- */
  function boot() {
    if (params.has('clean')) document.documentElement.classList.add('is-clean');
    $$('[data-nav]').forEach(renderNav);
    $$('[data-admin-sidebar]').forEach(renderAdminSidebar);
    renderMockNav(); initPageStates(); initCountdowns();
    $$('[data-theme-label]').forEach(el => (el.textContent = document.documentElement.dataset.theme === 'ink' ? 'Ink' : 'Paper'));
    icons();
    document.dispatchEvent(new CustomEvent('gnosia:ready'));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
