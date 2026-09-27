import { Nosi } from '../design/Nosi';

export function Boot() {
  return <div className="boot" aria-busy="true"><Nosi mood="think" size="lg" force /></div>;
}

export const homeFor = (role?: string) => (role === 'admin' ? '/admin' : role === 'mentor' ? '/mentor' : '/beranda');
