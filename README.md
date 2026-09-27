# GNOSIA

Platform belajar ngoding (JavaScript) dengan 4 fase per bab: **Pahami → Perkuat → Kuis → Uji**.
Tampilan dibangun ulang dari paket desain di `design/` (18 layar) dengan React + Vite + TypeScript,
dan backend-nya FastAPI + PostgreSQL.

```
gnosia/
  design/     paket desain asli (mockup HTML, spesifikasi, token). Referensi, tidak di-build.
  backend/    FastAPI · SQLAlchemy · PostgreSQL · runner kode (Node sandbox)
  frontend/   React 19 · Vite · TypeScript · React Query · CodeMirror 6
  dev.ps1     jalankan backend + frontend sekaligus
```

## Menjalankan (development)

Yang dibutuhkan: Python 3.12+, Node.js 20+ (dipakai Vite **dan** untuk menjalankan kode siswa di sandbox), PostgreSQL 15+.

1. Siapkan `backend/.env` (salin dari `backend/.env.example`):
   ```
   GNOSIA_DATABASE_URL=postgresql+psycopg://gnosia:PASSWORD@localhost:5432/gnosia
   GNOSIA_SECRET_KEY=string-acak-yang-panjang
   GNOSIA_PG_SUPERUSER_PASSWORD=password-user-postgres   # hanya untuk membuat role & database
   ```
2. Setup pertama kali (venv, paket, role + database PostgreSQL, data demo, paket npm):
   ```powershell
   .\dev.ps1 -Setup
   ```
3. Jalankan:
   ```powershell
   .\dev.ps1
   ```
   Buka http://localhost:5173. API ada di http://localhost:8000/api (dokumentasi: http://localhost:8000/docs).

Reset data demo: `.\dev.ps1 -Reseed`.

Kalau PowerShell menolak menjalankan skrip ("running scripts is disabled"), pakai:
`powershell -ExecutionPolicy Bypass -File .\dev.ps1`

### PostgreSQL di laptop ini

PostgreSQL 17 terpasang sebagai service Windows `postgresql-x64-17` (jalan otomatis saat Windows menyala, port 5432,
pgAdmin 4 ikut terpasang). Database `gnosia` dipakai aplikasi dan `gnosia_test` untuk tes. Password user `postgres` dan
`gnosia` dibuat acak saat setup dan hanya tersimpan di `backend/.env` (file itu tidak untuk dibagikan / di-commit).

## Docker + URL publik sementara (Cloudflare Tunnel)

Satu perintah menjalankan PostgreSQL, aplikasi (API + tampilan), dan tunnel Cloudflare, lalu mencetak URL publik
`https://<acak>.trycloudflare.com` yang bisa dibuka dari HP atau dibagikan. Tidak perlu akun Cloudflare dan tidak perlu
Python/Node/PostgreSQL di komputer, cukup Docker.

**Windows** (PowerShell, dari folder proyek; butuh [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/) yang sedang berjalan):
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\tunnel.ps1
```

**Linux / macOS / WSL** (butuh Docker Engine + plugin compose):
```bash
chmod +x scripts/tunnel.sh
./scripts/tunnel.sh
```

Perintah lain (sama untuk `.ps1` dan `.sh`): `url` (tampilkan URL aktif), `logs`, `stop` (matikan, data tetap ada),
`reset` (hapus semua data dan mulai dari data demo baru).

- Pertama kali, skrip membuat `.env` di folder proyek berisi password acak (database, secret key, dan **password akun demo**).
  Password demo dicetak di terminal. Karena URL-nya publik, akun demo tidak memakai `gnosia123`.
- URL berganti setiap kali tunnel dinyalakan ulang. Quick tunnel cocok untuk demo/uji coba, bukan untuk produksi
  (tidak ada jaminan uptime). Untuk alamat tetap, pakai named tunnel dengan akun Cloudflare dan domain sendiri.
- Kalau URL tidak kunjung muncul (jaringan memblokir UDP/QUIC), ubah `TUNNEL_PROTOCOL=http2` di `.env` lalu jalankan lagi.
- Tanpa tunnel, cukup `docker compose up -d --build` lalu buka http://localhost:8000.
- Data demo dibuat sekali saat database masih kosong. Ganti `DEMO_PASSWORD` setelah itu tidak mengubah akun yang sudah ada;
  pakai `reset` kalau ingin mengulang.

## Akun demo

Saat dijalankan lokal dengan `dev.ps1`, semua memakai kata sandi `gnosia123` (lihat `backend/app/seed/users.json`).
Di Docker, kata sandinya diambil dari `DEMO_PASSWORD` di `.env` (dibuat acak oleh skrip tunnel).

| Peran | Email | Yang bisa dicoba |
|---|---|---|
| Siswa | nadia@smksig.sch.id | Bab 1 selesai, Bab 2 di Perkuat 3/8, streak 12 hari, 3 konsep perlu diulang |
| Siswa | salsa@smksig.sch.id | Bab 2 selesai, proyek Kalkulator Uang Saku menunggu review |
| Siswa | alex@ · rizky@ · maya@ · bayu@smksig.sch.id | memicu sinyal mentor (salah 4×, gagal gerbang, buru-buru petunjuk, macet) |
| Mentor | dimas@smksig.sch.id | kelas XII RPL (32 siswa), antrian review, detail siswa |
| Admin | sekar@smksig.sch.id | ringkasan kurikulum, flag konten, builder, pengguna |

Atau daftar akun baru di `/daftar` untuk merasakan onboarding dari awal.

## Tes

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -q
```
Secara bawaan tes memakai SQLite sementara. Untuk menguji ke PostgreSQL:
`$env:GNOSIA_TEST_DATABASE_URL="postgresql+psycopg://gnosia:PASSWORD@localhost:5432/gnosia_test"` (database ini di-reset).

Frontend: `cd frontend; npm run typecheck`.

## Produksi

```powershell
cd frontend; npm run build          # hasil di frontend/dist
cd ..\backend; .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```
FastAPI menyajikan `frontend/dist` sekaligus API-nya, jadi cukup satu server. Set `GNOSIA_COOKIE_SECURE=true` di balik HTTPS,
dan ganti `GNOSIA_SECRET_KEY`.

## Cara kerjanya (singkat)

- **Konten** tiap bab disimpan sebagai dokumen JSON berversi (`chapters.draft` untuk Builder, `chapter_versions` untuk yang terbit).
  Siswa selalu membaca versi terbit; versi baru sampai ke siswa setelah fase yang sedang ia kerjakan selesai.
- **Kunci jawaban tidak pernah dikirim ke browser.** Perkuat, Kuis, dan Ulangan diperiksa di server.
- **Aturan belajar** (`backend/app/services/`): `unlock.py` (fase terbuka berurutan, gerbang Kuis 70%), `scoring.py` (skor kuis
  `100 × combo + sisa detik × 5`, XP), `learning.py` (mastery 5 tingkat, "Perlu diulang"), `activity.py` (target harian, streak),
  `signals.py` (sinyal mentor), `diagnostics.py` (penjelasan error L2 berbasis aturan).
- **Kode siswa** untuk Challenge, soal kode Ulangan, dan tes proyek dijalankan di server (`backend/runner/sandbox.mjs`, node:vm +
  permission model Node, batas waktu 1 detik). Hasil tes Challenge dikirim per robot lewat WebSocket. Playground dan demo Pahami
  (tidak dinilai) berjalan di Web Worker browser.
  Untuk layanan publik, pindahkan runner ke container terisolasi atau pakai `isolated-vm`.

## Belum ada / catatan

- Tombol masuk dengan Google dan "Akun sekolah" baru menampilkan pesan "segera hadir"; login memakai email + kata sandi.
- Bahasa antarmuka hanya Bahasa Indonesia (pilihan English ditandai "segera").
- Konten lengkap tersedia untuk Bab 1 dan Bab 2. Bab 3–8 tampil di peta sebagai "segera hadir" dan bisa ditulis lewat Builder
  (`/admin/bab`), lalu diterbitkan.
- Pengingat belajar (pukul 19.00) tersimpan sebagai preferensi, belum ada pengiriman notifikasi terjadwal.
