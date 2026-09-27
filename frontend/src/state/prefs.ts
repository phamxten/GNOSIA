import { create } from 'zustand';
import { motion, setMotion, setSound, soundOn, type MotionLevel } from '../fx';

export type ThemeChoice = 'paper' | 'ink' | 'system';

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };
const systemTheme = () => (matchMedia('(prefers-color-scheme: dark)').matches ? 'ink' : 'paper');

function applyTheme(choice: ThemeChoice) {
  document.documentElement.dataset.theme = choice === 'system' ? systemTheme() : choice;
}

type Prefs = {
  theme: ThemeChoice;
  motion: MotionLevel;
  sound: boolean;
  nosi: boolean;
  setTheme: (t: ThemeChoice) => void;
  toggleTheme: () => void;
  setMotion: (m: MotionLevel) => void;
  setSound: (on: boolean) => void;
  setNosi: (on: boolean) => void;
};

export const usePrefs = create<Prefs>((set, get) => ({
  theme: (read('gnosia-theme') as ThemeChoice) || 'system',
  motion: motion(),
  sound: soundOn(),
  nosi: read('gnosia-nosi') !== 'off',
  setTheme: t => { write('gnosia-theme', t); applyTheme(t); set({ theme: t }); },
  toggleTheme: () => {
    const cur = document.documentElement.dataset.theme === 'ink' ? 'ink' : 'paper';
    get().setTheme(cur === 'ink' ? 'paper' : 'ink');
  },
  setMotion: m => { setMotion(m); set({ motion: m }); },
  setSound: on => { setSound(on); set({ sound: on }); },
  setNosi: on => { write('gnosia-nosi', on ? 'on' : 'off'); set({ nosi: on }); },
}));

matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (usePrefs.getState().theme === 'system') applyTheme('system');
});
