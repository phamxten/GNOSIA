import { Link } from 'react-router';
import { useMe } from '../api/hooks';
import { homeFor } from '../app/common';
import { Nosi } from '../design/Nosi';

export default function NotFound() {
  const { data: me } = useMe();
  return (
    <main className="page t-center" style={{ paddingTop: 96 }}>
      <Nosi size="xl" mood="oops" force />
      <div className="eyebrow mt-6">404</div>
      <h1 className="big-serif mt-2" style={{ fontSize: 44 }}>Halaman ini <em>tidak ada</em>.</h1>
      <p className="t-muted mt-3">Mungkin tautannya salah ketik, atau halamannya sudah dipindah.</p>
      <Link className="btn btn-primary btn-xl btn-press mt-8" to={me ? homeFor(me.role) : '/'}>Kembali</Link>
    </main>
  );
}
