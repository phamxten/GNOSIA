import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import { toast } from '../design/toast';

/** If an API call answered 409 with a redirect (locked phase, unpublished chapter), show a toast and go there. */
export function useLockRedirect(error: unknown) {
  const nav = useNavigate();
  useEffect(() => {
    if (error instanceof ApiError && error.status === 409 && error.redirect) {
      toast({ kind: 'accent', icon: 'lock', title: error.message, body: error.info });
      nav(error.redirect, { replace: true });
    }
  }, [error, nav]);
}

/** Counts active time while the page is visible and the learner interacts; sends it every 30 s. */
export function useHeartbeat(chapterId?: number | null) {
  const qc = useQueryClient();
  useEffect(() => {
    let active = 0;
    let lastInput = Date.now();
    const mark = () => { lastInput = Date.now(); };
    const tick = window.setInterval(() => {
      if (document.visibilityState === 'visible' && Date.now() - lastInput < 90_000) active += 5;
    }, 5000);
    const send = window.setInterval(async () => {
      if (active < 5) return;
      const seconds = active;
      active = 0;
      try {
        await api.post('/api/activity/heartbeat', { seconds, chapter_id: chapterId ?? null });
        qc.invalidateQueries({ queryKey: ['/api/me'] });
      } catch { /* offline: this bit of time is simply not counted */ }
    }, 30_000);
    const evs = ['pointerdown', 'keydown', 'scroll', 'pointermove'] as const;
    evs.forEach(e => addEventListener(e, mark, { passive: true }));
    return () => { clearInterval(tick); clearInterval(send); evs.forEach(e => removeEventListener(e, mark)); };
  }, [chapterId, qc]);
}

/** Debounced autosave (600 ms): returns [state, schedule]. */
export function useAutosave<T>(save: (v: T) => Promise<unknown>, delay = 600) {
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'offline' | 'error'>('idle');
  const timer = useRef<number>(0);
  const latest = useRef<T | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;
  const schedule = (v: T) => {
    latest.current = v;
    setState('saving');
    clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      try { await saveRef.current(latest.current as T); setState('saved'); }
      catch (e) { setState(e instanceof ApiError && e.offline ? 'offline' : 'error'); }
    }, delay);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  return [state, schedule] as const;
}

export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    addEventListener('online', on); addEventListener('offline', off);
    return () => { removeEventListener('online', on); removeEventListener('offline', off); };
  }, []);
  return online;
}

export const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
export const todayLabel = () => { const d = new Date(); return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
export const greeting = () => { const h = new Date().getHours(); return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 19 ? 'Selamat sore' : 'Selamat malam'; };
