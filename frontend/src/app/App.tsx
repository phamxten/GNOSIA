import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient, useMe } from '../api/hooks';
import { AdminLayout, AppNav, CommandPalette } from './shell';
import { ToastStack } from '../design/toast';
import { Boot, homeFor } from './common';

const Landing = lazy(() => import('../pages/Landing'));
const Auth = lazy(() => import('../pages/Auth'));
const Onboarding = lazy(() => import('../pages/Onboarding'));
const Beranda = lazy(() => import('../pages/Beranda'));
const Peta = lazy(() => import('../pages/Peta'));
const Bab = lazy(() => import('../pages/Bab'));
const Progres = lazy(() => import('../pages/Progres'));
const Pengaturan = lazy(() => import('../pages/Pengaturan'));
const Playground = lazy(() => import('../pages/Playground'));
const Proyek = lazy(() => import('../pages/Proyek'));
const Pahami = lazy(() => import('../pahami/PahamiPage'));
const Perkuat = lazy(() => import('../perkuat/PerkuatPage'));
const Kuis = lazy(() => import('../kuis/KuisPage'));
const Ulangan = lazy(() => import('../uji/UlanganPage'));
const Challenge = lazy(() => import('../uji/ChallengePage'));
const Mentor = lazy(() => import('../mentor/MentorPage'));
const Siswa = lazy(() => import('../mentor/SiswaPage'));
const Roster = lazy(() => import('../mentor/RosterPage'));
const ReviewQueue = lazy(() => import('../mentor/ReviewQueue'));
const Admin = lazy(() => import('../admin/AdminPage'));
const Builder = lazy(() => import('../admin/BuilderPage'));
const ChapterList = lazy(() => import('../admin/ChapterList'));
const People = lazy(() => import('../admin/PeoplePage'));
const NotFound = lazy(() => import('../pages/NotFound'));

function RequireAuth({ roles, children }: { roles?: string[]; children: ReactNode }) {
  const { data: me, isLoading } = useMe();
  const loc = useLocation();
  if (isLoading) return <Boot />;
  if (!me) return <Navigate to={`/masuk?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (me.role === 'learner' && !me.onboarded && !loc.pathname.startsWith('/mulai')) return <Navigate to="/mulai/tujuan" replace />;
  if (roles && !roles.includes(me.role)) return <Navigate to={homeFor(me.role)} replace />;
  return <>{children}</>;
}

function LearnerLayout() {
  return <RequireAuth roles={['learner', 'mentor', 'admin']}><AppNav role="learner" /><Suspense fallback={<Boot />}><Outlet /></Suspense></RequireAuth>;
}
function MentorLayout() {
  return <RequireAuth roles={['mentor', 'admin']}><AppNav role="mentor" /><Suspense fallback={<Boot />}><Outlet /></Suspense></RequireAuth>;
}
function AdminShell() {
  return <RequireAuth roles={['admin']}><AdminLayout><Suspense fallback={<Boot />}><Outlet /></Suspense></AdminLayout></RequireAuth>;
}
function PlayerLayout() {
  return <RequireAuth><Suspense fallback={<Boot />}><Outlet /></Suspense></RequireAuth>;
}

function SessionWatcher() {
  const nav = useNavigate();
  useEffect(() => {
    const f = () => {
      queryClient.setQueryData(['/api/me'], null);
      if (!/^\/(masuk|daftar)?$/.test(location.pathname)) nav(`/masuk?next=${encodeURIComponent(location.pathname)}`);
    };
    addEventListener('gnosia:unauthorized', f);
    return () => removeEventListener('gnosia:unauthorized', f);
  }, [nav]);
  return null;
}

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => { if (!location.hash) scrollTo(0, 0); }, [pathname]);
  return null;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SessionWatcher />
        <ScrollTop />
        <Suspense fallback={<Boot />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/masuk" element={<Auth mode="login" />} />
            <Route path="/daftar" element={<Auth mode="register" />} />
            <Route path="/mulai/:step" element={<RequireAuth roles={['learner']}><Onboarding /></RequireAuth>} />

            <Route element={<LearnerLayout />}>
              <Route path="/beranda" element={<Beranda />} />
              <Route path="/peta" element={<Navigate to="/peta/js-dasar" replace />} />
              <Route path="/peta/:pathId" element={<Peta />} />
              <Route path="/bab/:id" element={<Bab />} />
              <Route path="/playground" element={<Playground />} />
              <Route path="/playground/:notebookId" element={<Playground />} />
              <Route path="/proyek" element={<Proyek />} />
              <Route path="/proyek/:projectId" element={<Proyek />} />
              <Route path="/progres" element={<Progres />} />
              <Route path="/pengaturan" element={<Pengaturan />} />
            </Route>

            <Route element={<PlayerLayout />}>
              <Route path="/bab/:id/pahami" element={<Pahami />} />
              <Route path="/bab/:id/perkuat" element={<Perkuat />} />
              <Route path="/bab/:id/kuis" element={<Kuis />} />
              <Route path="/kuis-harian" element={<Kuis daily />} />
              <Route path="/bab/:id/uji/ulangan" element={<Ulangan />} />
              <Route path="/bab/:id/uji/challenge" element={<Challenge />} />
            </Route>

            <Route element={<MentorLayout />}>
              <Route path="/mentor" element={<Mentor />} />
              <Route path="/mentor/siswa" element={<Roster />} />
              <Route path="/mentor/siswa/:userId" element={<Siswa />} />
              <Route path="/mentor/review" element={<ReviewQueue />} />
            </Route>

            <Route element={<AdminShell />}>
              <Route path="/admin" element={<Admin />} />
              <Route path="/admin/bab" element={<ChapterList />} />
              <Route path="/admin/bab/:id" element={<Builder />} />
              <Route path="/admin/pengguna" element={<People />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        <CommandPalette />
        <ToastStack />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
