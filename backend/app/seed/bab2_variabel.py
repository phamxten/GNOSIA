"""Bab 2 · Variabel — content taken from the design mockups (pahami/perkuat/kuis/ulangan/challenge.html).

Text fields may contain a small set of inline HTML (b, i, em, span.ic, span.t-mono, kbd);
the frontend sanitizes everything before rendering.
"""

M = '<span class="t-mono">'
E = "</span>"


def ic(s: str) -> str:
    return f'<span class="ic">{s}</span>'


def mono(s: str) -> str:
    return f"{M}{s}{E}"


SCENES = [
    {
        "id": "s1", "kicker": "",
        "title": 'Variabel adalah <em>kotak berlabel</em> untuk menyimpan nilai.',
        "lead": "Program perlu mengingat sesuatu, misalnya skor, nama, atau harga. Variabel adalah cara memberi nama pada ingatan itu.",
        "visual": {
            "type": "intro", "side": {"kind": "box", "tag": "skor", "val": "10", "type": "number"},
            "objectives_label": "Setelah bagian ini kamu bisa",
            "objectives": [
                f"Membuat variabel dengan {ic('let')} dan {ic('const')}",
                "Mengubah isi variabel, dan tahu kapan tidak bisa",
                "Memakai variabel dalam hitungan",
            ],
        },
        "steps": [{"desc": "Objektif muncul satu per satu", "trigger": "auto"}],
        "advance": "free", "concepts": ["let"],
    },
    {
        "id": "s2", "kicker": "Membuat variabel", "title": "Satu baris, empat bagian.",
        "say": "Ketuk tiap bagian kode untuk melihat apa tugasnya. Perhatikan kotak di kanan.",
        "visual": {
            "type": "tokens",
            "tokens": [
                {"text": "let", "cls": "k", "key": "let", "explain": "Kata kunci: <b>buat kotak baru</b> yang isinya boleh diganti.", "effect": "pop"},
                {"text": "skor", "cls": "", "key": "name", "explain": "Nama atau <b>label</b> kotaknya. Dipakai untuk memanggil isinya nanti.", "effect": "tag"},
                {"text": "=", "cls": "pn", "key": "eq", "explain": "Bukan “sama dengan”. Artinya <b>masukkan</b> nilai di kanan ke kotak di kiri.", "effect": "fly"},
                {"text": "10", "cls": "n", "key": "val", "explain": "<b>Nilai</b> yang disimpan. Di sini sebuah angka (number).", "effect": "fly"},
            ],
            "suffix": ";", "target": {"kind": "box", "tag": "skor", "val": "10", "type": "kotak baru"},
            "start": "Mulai dari <b>let</b>.",
        },
        "steps": [
            {"desc": "Klik token let → kotak kosong muncul (pop)", "trigger": "token"},
            {"desc": "Klik skor → label “skor” menempel", "trigger": "token"},
            {"desc": "Klik 10 → nilai terbang masuk ke kotak", "trigger": "token"},
        ],
        "advance": "all_tokens", "concepts": ["let", "assign"],
    },
    {
        "id": "s3", "kicker": "Mengubah isi", "title": f'Isi kotak {ic("let")} boleh diganti.',
        "say": f"Tanpa {ic('let')} lagi. Cukup tulis nama, {ic('=')}, lalu nilai baru. Nilai lama dibuang. <b>Geser angka bergaris titik</b> ke kiri atau kanan.",
        "visual": {
            "type": "livecode", "file": "skor.js", "status": "live",
            "lines": ["let skor = 10;", "skor = {{knob}};", "console.log(skor);"], "lit": [2],
            "knob": {"min": 0, "max": 100, "step": 1, "value": 25, "label": "nilai skor baru"},
            "outputs": ["{{v}}"], "box": {"tag": "skor", "type": "number"},
            "note": f"Nilai {mono('10')} sudah diganti. Kotak hanya memegang <b>satu</b> nilai.",
        },
        "steps": [{"desc": "Geser angka → output dan kotak ikut berubah", "trigger": "auto"}],
        "advance": "free", "concepts": ["assign"],
    },
    {
        "id": "s4", "kicker": "let dan const", "title": f'{ic("const")} adalah kotak yang digembok.',
        "say": f"Pakai {ic('const')} untuk nilai yang tidak akan berubah, seperti nama sekolah. Coba ubah keduanya dan lihat apa yang terjadi.",
        "visual": {
            "type": "trychange",
            "boxes": [
                {"tag": "kelas", "val": '"XI"', "alt": '"XII"', "kind": "let", "button": 'kelas = "XII"'},
                {"tag": "sekolah", "val": '"SMK SIG"', "kind": "const", "button": 'sekolah = "SMA 1"'},
            ],
            "error": "TypeError: Assignment to constant variable.",
        },
        "reveals": [{"q": "Jadi kapan pakai yang mana?",
                     "a": "Mulai dengan <b>const</b>. Ganti ke <b>let</b> hanya kalau nilainya memang perlu berubah, misalnya skor yang bertambah. Dengan begitu kesalahan “tidak sengaja mengubah” tertangkap lebih awal."}],
        "advance": "free", "concepts": ["const"],
    },
    {
        "id": "s5", "kicker": "Memberi nama", "title": "Nama yang baik menjelaskan isinya.",
        "visual": {
            "type": "cards",
            "cards": [
                {"label": "Boleh", "code": "totalHarga", "tone": "ok", "note": f"Huruf, angka, {mono('_')} atau {mono('$')}. Gaya <i>camelCase</i>."},
                {"label": "Tidak boleh", "code": "2skor", "tone": "bad", "note": "Tidak boleh diawali angka."},
                {"label": "Tidak boleh", "code": "nama siswa", "tone": "bad", "note": "Tidak boleh ada spasi."},
            ],
        },
        "reveals": [{"q": f'Cek cepat: apakah {ic("let class = &quot;XI&quot;;")} boleh?',
                     "a": f"<b>Tidak.</b> {mono('class')} adalah <i>kata kunci</i> JavaScript, sama seperti {mono('let')} dan {mono('const')}. Pakai {mono('kelas')} atau {mono('namaKelas')}."}],
        "advance": "free", "concepts": ["penamaan"],
    },
    {
        "id": "s6", "kicker": "Variabel dalam hitungan", "title": "Variabel bisa dipakai untuk menghitung variabel lain.",
        "say": f"Geser <b>harga</b> atau <b>jumlah</b>. Perhatikan {ic('total')} ikut berubah.",
        "visual": {
            "type": "knobcalc", "file": "kantin.js",
            "lines": ["const harga = {{harga}};", "let jumlah = {{jumlah}};", "const total = harga * jumlah;", 'console.log("Bayar:", total);'],
            "lit": [3],
            "knobs": {"harga": {"min": 1000, "max": 20000, "step": 500, "value": 5000}, "jumlah": {"min": 1, "max": 12, "step": 1, "value": 3}},
            "formula": {"a": "harga", "op": "*", "b": "jumlah"}, "result": "total", "output_prefix": "Bayar: ",
        },
        "advance": "free", "concepts": ["hitung"],
    },
    {
        "id": "s7", "kicker": "Ringkasan", "title": "Yang perlu kamu ingat.",
        "visual": {
            "type": "summary",
            "cards": [
                {"icon": "box", "title": "Variabel = kotak berlabel", "body": "Punya nama dan menyimpan satu nilai."},
                {"icon": "pencil", "title": f"{mono('let')} bisa diubah", "body": f"{mono('skor = 25')} mengganti nilai lama."},
                {"icon": "lock", "title": f"{mono('const')} dikunci", "body": "Mengubahnya memunculkan TypeError."},
                {"icon": "calculator", "title": "Bisa dihitung", "body": f"{mono('harga * jumlah')} menghasilkan nilai baru."},
            ],
            "callout": {"icon": "arrow-right-circle", "html": "<b>Berikutnya: Perkuat.</b> 8 latihan pendek untuk mengikat pemahamanmu. Salah itu wajar, dan soal akan menyesuaikan."},
        },
        "advance": "free", "concepts": [],
    },
]

ITEMS = [
    {
        "id": "q1", "type": "choice", "label": "let untuk skor",
        "title": "Nilai <b>skor</b> akan bertambah selama permainan. Baris mana yang tepat?",
        "choices": ["const skor = 0;", "let skor = 0;", "skor let = 0;", "let 0 = skor;"], "answer": 1,
        "hints": {"l3": "Nilainya <b>akan berubah</b>. Kotak mana yang tidak digembok?",
                  "l4": f"Urutannya selalu: kata kunci, nama, {mono('=')}, nilai. Lalu pilih kata kunci yang isinya boleh diganti.",
                  "l5": f"Contoh mirip: {mono('let nyawa = 3;')} lalu {mono('nyawa = nyawa - 1;')} berhasil karena memakai {mono('let')}."},
        "l6": f"Jawabannya {mono('let skor = 0;')}. {mono('let')} membuat kotak yang isinya boleh diganti, jadi skor bisa bertambah.",
        "explain": f"Nilainya berubah, jadi pakai {mono('let')}. {mono('const')} akan error saat skor ditambah.",
        "concepts": ["let", "const"],
    },
    {
        "id": "q2", "type": "fill", "label": "Lengkapi umur",
        "title": "Lengkapi supaya umur bisa diganti di baris 2.",
        "help": "Seret potongan ke kotak kosong, atau ketuk potongan untuk mengisi kotak berikutnya.",
        "code": "{{slot}} umur {{slot}} 16;\numur = 17;",
        "tray": [{"val": "const", "label": "const"}, {"val": "=", "label": "="}, {"val": "let", "label": "let"}, {"val": "==", "label": "=="}, {"val": ":", "label": ":"}],
        "answer": ["let", "="],
        "hints": {"l3": "Baris 2 <b>mengganti</b> isi umur. Jadi kotaknya harus bisa diubah.",
                  "l4": f"Kotak pertama: kata kunci yang bisa diubah. Kotak kedua: tanda untuk memasukkan nilai (bukan {mono('==')}).",
                  "l5": f"Contoh: {mono('let kelas = 10;')} lalu {mono('kelas = 11;')}."},
        "l6": f"Isi {mono('let')} lalu {mono('=')}: {mono('let umur = 16;')}",
        "explain": f"{mono('let umur = 16;')} lalu {mono('umur = 17;')}. Tanda {mono('=')} berarti “masukkan”, bukan {mono('==')}.",
        "concepts": ["let", "const"], "diagnosis": f"Memilih {mono('const')} padahal nilainya diganti di baris 2.",
    },
    {
        "id": "q3", "type": "predict", "label": "Tebak output a + 2",
        "title": "Apa yang dicetak?", "code": "let a = 5;\na = a + 2;\nconsole.log(a);",
        "choices": ["5", "7", "a + 2", "52"], "cols": 2, "answer": 1, "similar_id": "q3b",
        "hints": {"l3": f"Baris 2 dibaca dari <b>kanan</b>: hitung {mono('a + 2')} dulu, lalu simpan ke {mono('a')}.",
                  "l4": f"Isi {mono('a')} saat baris 2 dijalankan adalah 5. Jadi kanan = 5 + 2.",
                  "l5": f"Contoh: {mono('let n = 1; n = n + 1;')} membuat n bernilai 2."},
        "l6": f"Jawabannya 7: {mono('5 + 2 = 7')}, lalu 7 dimasukkan ke {mono('a')}.",
        "explain": f"Kanan dihitung dulu: {mono('5 + 2 = 7')}, lalu 7 dimasukkan ke {mono('a')}.",
        "concepts": ["assign", "hitung"],
    },
    {
        "id": "q3b", "type": "predict", "adaptive": True, "label": "Tebak output (serupa)",
        "title": "Satu lagi. Apa yang dicetak?", "code": "let poin = 10;\npoin = poin - 3;\nconsole.log(poin);",
        "choices": ["10", "3", "7", "poin - 3"], "cols": 2, "answer": 2,
        "hints": {"l3": f"Hitung kanan dulu: {mono('poin - 3')} saat poin masih 10."},
        "explain": f"{mono('10 - 3 = 7')}, lalu 7 menggantikan isi lama.", "concepts": ["assign"],
    },
    {
        "id": "q4", "type": "parsons", "label": "Susun total belanja",
        "title": "Susun baris supaya program mencetak total belanja.",
        "help": "Seret baris naik atau turun. Pakai keyboard: fokus, lalu <kbd>Alt</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd>.",
        "lines": [{"id": "4", "code": "console.log(total);"}, {"id": "1", "code": "const harga = 3000;"},
                  {"id": "3", "code": "const total = harga * jumlah;"}, {"id": "2", "code": "let jumlah = 2;"}],
        "answer": ["1", "2", "3", "4"],
        "hints": {"l3": "Sebuah variabel harus <b>dibuat dulu</b> sebelum dipakai.",
                  "l4": f"Cari baris yang tidak memakai variabel lain. Itu duluan. {mono('total')} memakai harga dan jumlah, jadi setelah keduanya.",
                  "l5": f"Contoh urutan: {mono('const a = 1;')} → {mono('const b = a + 1;')} → {mono('console.log(b);')}"},
        "l6": f"Urutan benar: {mono('const harga = 3000;')}, {mono('let jumlah = 2;')}, {mono('const total = harga * jumlah;')}, {mono('console.log(total);')}.",
        "explain": f"Buat {mono('harga')} dan {mono('jumlah')} dulu, hitung {mono('total')}, baru cetak.",
        "concepts": ["hitung"], "similar_id": "q4b",
        "diagnosis": "Memakai variabel sebelum dibuat → miskonsepsi <b>urutan eksekusi</b>, bukan sintaks. Program dibaca dari atas ke bawah.",
    },
    {
        "id": "q4b", "type": "parsons", "adaptive": True, "label": "Susun (serupa)",
        "title": "Satu lagi. Susun supaya mencetak sisa uang.",
        "lines": [{"id": "3", "code": "console.log(sisa);"}, {"id": "2", "code": "const sisa = uang - 4000;"}, {"id": "1", "code": "const uang = 10000;"}],
        "answer": ["1", "2", "3"],
        "hints": {"l3": f"{mono('sisa')} memakai {mono('uang')}. Mana yang harus ada lebih dulu?"},
        "explain": "Buat uang, hitung sisa, lalu cetak.", "concepts": ["hitung"],
    },
    {
        "id": "q5", "type": "bug", "label": "temukan bug const",
        "title": "Program ini error. Ketuk baris penyebabnya.",
        "lines": ["const nyawa = 3;", "nyawa = nyawa - 1;", 'console.log("Sisa:", nyawa);'],
        "error": "TypeError: Assignment to constant variable.", "answer": 2, "similar_id": "q5b",
        "hints": {"l3": f"Pesan errornya menyebut <b>constant</b>. Di mana isi sebuah {mono('const')} diganti?",
                  "l4": f"Lihat baris yang memakai {mono('=')} setelah deklarasi.",
                  "l5": f"Contoh: {mono('const x = 1;')} lalu {mono('x = 2;')} error di baris kedua, bukan pertama."},
        "l6": f"Baris 2 error. Perbaikannya: ubah baris 1 menjadi {mono('let nyawa = 3;')}.",
        "explain": f"Baris 2 mengganti isi {mono('const')}. Perbaikannya: ubah baris 1 menjadi {mono('let nyawa = 3;')}.",
        "concepts": ["const"], "diagnosis": "Mengira bug ada di deklarasi, padahal error dipicu saat isi const diganti.",
    },
    {
        "id": "q5b", "type": "bug", "adaptive": True, "label": "temukan bug (serupa)",
        "title": "Satu lagi yang mirip. Baris mana yang error?",
        "lines": ['const kota = "Bandung";', "let suhu = 24;", 'kota = "Bogor";', "suhu = 22;"], "answer": 3,
        "hints": {"l3": f"Cari variabel yang dibuat dengan {mono('const')}, lalu cari di mana isinya diganti."},
        "explain": f"{mono('kota')} adalah {mono('const')}, jadi baris 3 error. {mono('suhu')} memakai {mono('let')}, jadi baris 4 aman.",
        "concepts": ["const"],
    },
    {
        "id": "q6", "type": "slider", "label": "Atur jumlah",
        "title": f"Geser {ic('jumlah')} sampai {ic('total')} tepat <b>20000</b>.",
        "code": "const harga = 4000;\nlet jumlah = {{v}};\nconst total = harga * jumlah;", "lit": [2],
        "min": 1, "max": 10, "value": 2, "var": "jumlah", "result": {"label": "total", "mul": 4000}, "target": 20000, "answer": 5,
        "hints": {"l3": "20000 dibagi 4000 berapa?", "l4": "Coba naikkan satu per satu dan lihat total."},
        "explain": "4000 × 5 = 20000. Mengubah satu variabel mengubah semua hitungan yang memakainya.",
        "concepts": ["hitung"],
    },
    {
        "id": "q7", "type": "match", "label": "Pasangkan maksud",
        "title": "Pasangkan maksud dengan kodenya.",
        "left": [{"key": "a", "text": "Buat kotak yang bisa diubah"}, {"key": "b", "text": "Buat kotak yang dikunci"},
                 {"key": "c", "text": "Ganti isi kotak"}, {"key": "d", "text": "Tampilkan isi kotak"}],
        "right": [{"key": "c", "text": "x = 5"}, {"key": "d", "text": "console.log(x)"}, {"key": "a", "text": "let x = 1"}, {"key": "b", "text": "const y = 2"}],
        "right_code": True,
        "hints": {"l3": "Mulai dari yang paling yakin. Salah pasang tidak mengurangi apa pun."},
        "explain": "Semua pasangan tepat.", "concepts": ["let", "const", "assign"],
    },
    {
        "id": "q8", "type": "choice", "label": "Nama terbaik",
        "title": "Nama variabel mana yang <b>paling baik</b> untuk menyimpan jumlah siswa di kelas?",
        "choices": ["x", "jumlah siswa", "jumlahSiswa", "2siswa"], "answer": 2,
        "hints": {"l3": "Nama harus valid <b>dan</b> menjelaskan isinya.",
                  "l4": "Coret yang tidak valid dulu: ada spasi, atau diawali angka.",
                  "l5": f"Contoh nama bagus: {mono('totalHarga')}, {mono('namaSekolah')}."},
        "l6": f"{mono('jumlahSiswa')}: valid (camelCase) dan jelas.",
        "explain": f"{mono('jumlahSiswa')} valid dan jelas. {mono('x')} valid tapi tidak menjelaskan apa-apa.",
        "concepts": ["penamaan"],
    },
]

BANK = [
    {"id": "k1", "t": "Kata kunci untuk variabel yang isinya <b>tidak boleh</b> diganti?", "o": ["let", "const", "var", "fix"], "a": 1,
     "e": f"{mono('const')} mengunci isinya.", "concepts": ["const"]},
    {"id": "k2", "t": f"Berapa nilai {ic('x')} di akhir?", "c": "let x = 3;\nx = x * 2;", "o": ["3", "6", "32", "x * 2"], "a": 1,
     "e": "Kanan dihitung dulu: 3 × 2 = 6.", "concepts": ["assign"]},
    {"id": "k3", "t": "Nama variabel mana yang <b>valid</b>?", "o": ["2total", "total-harga", "_total", "let"], "a": 2,
     "e": f"Boleh diawali {mono('_')}. Tidak boleh angka, tanda minus, atau kata kunci.", "concepts": ["penamaan"]},
    {"id": "k4", "t": "JavaScript versi pertama dibuat dalam waktu sekitar…", "trivia": True, "o": ["10 hari", "6 bulan", "2 tahun", "1 minggu"], "a": 0,
     "e": "Brendan Eich membuatnya sekitar 10 hari di tahun 1995.", "concepts": []},
    {"id": "k5", "t": "Apa yang terjadi?", "c": "const a = 1;\na = 2;", "o": ["a menjadi 2", "a tetap 1, tanpa pesan", "TypeError", "a menjadi 12"], "a": 2,
     "e": f"Mengganti isi {mono('const')} memunculkan TypeError.", "concepts": ["const"]},
    {"id": "k6", "t": f"Di JavaScript, tanda {ic('=')} berarti…", "o": ["sama dengan", "masukkan nilai", "bandingkan", "tambah"], "a": 1,
     "e": f"{mono('=')} adalah assignment. Untuk membandingkan dipakai {mono('===')}.", "concepts": ["assign"]},
    {"id": "k7", "t": f"Isi {ic('nama')} sekarang?", "c": 'let nama = "Ana";\nnama = "Budi";', "o": ['"Ana"', '"Budi"', '"AnaBudi"', "error"], "a": 1,
     "e": "Nilai lama diganti. Kotak hanya memegang satu nilai.", "concepts": ["assign"]},
    {"id": "k8", "t": "Gaya penamaan <i>camelCase</i> yang benar?", "trivia": True, "o": ["JumlahSiswa", "jumlah_siswa", "jumlahSiswa", "JUMLAH_SISWA"], "a": 2,
     "e": "Kata pertama kecil, kata berikutnya diawali huruf besar.", "concepts": ["penamaan"]},
    {"id": "k9", "t": f"Berapa nilai {ic('b')}?", "c": "let a = 2;\nlet b = a;\na = 5;", "o": ["2", "5", "7", "undefined"], "a": 0,
     "e": f"{mono('b')} menyalin <b>nilai</b> 2 saat dibuat. Mengubah {mono('a')} nanti tidak mengubah {mono('b')}.", "concepts": ["salinan"]},
    {"id": "k10", "t": "Apa yang dicetak?", "c": "let s;\nconsole.log(s);", "o": ["0", "null", '""', "undefined"], "a": 3,
     "e": f"Variabel tanpa nilai awal berisi {mono('undefined')}.", "concepts": ["let"]},
    {"id": "k11", "t": "Apa yang dicetak?", "c": "const harga = 2000;\nconst total = harga * 3;\nconsole.log(total);", "o": ["2000", "6000", "harga * 3", "23"], "a": 1,
     "e": f"{mono('harga * 3')} dihitung dulu: 6000.", "concepts": ["hitung"]},
    {"id": "k12", "t": f"Baris mana yang <b>mengganti</b> isi variabel {ic('nilai')}?", "o": ["let nilai = 5;", "nilai = 5;", "nilai == 5;", "const nilai = 5;"], "a": 1,
     "e": f"Mengganti isi cukup dengan nama, {mono('=')}, lalu nilai baru. Tanpa {mono('let')}.", "concepts": ["assign"]},
    {"id": "k13", "t": "Apa yang terjadi?", "c": "let umur = 15;\nlet umur = 16;", "o": ["umur jadi 16", "SyntaxError: sudah dideklarasikan", "umur jadi 31", "tidak terjadi apa-apa"], "a": 1,
     "e": f"Kotak yang sama tidak boleh dibuat dua kali. Untuk mengganti, tulis {mono('umur = 16;')}.", "concepts": ["let"]},
    {"id": "k14", "t": "Nama mana yang <b>tidak boleh</b> karena kata kunci?", "o": ["kelas", "namaKelas", "class", "kelas2"], "a": 2,
     "e": f"{mono('class')} adalah kata kunci JavaScript.", "concepts": ["penamaan"]},
    {"id": "k15", "t": "Nama awal JavaScript saat pertama dibuat adalah…", "trivia": True, "o": ["Mocha", "Java", "Script", "Coffee"], "a": 0,
     "e": "Awalnya bernama Mocha, lalu LiveScript, baru JavaScript.", "concepts": []},
    {"id": "k16", "t": f"Berapa nilai {ic('x')} di akhir?", "c": "let x = 10;\nx = x - 3;\nx = x * 2;", "o": ["7", "14", "20", "17"], "a": 1,
     "e": "10 − 3 = 7, lalu 7 × 2 = 14.", "concepts": ["assign", "hitung"]},
    {"id": "k17", "t": "Deklarasi mana yang benar?", "o": ["let = skor 10;", "skor let = 10;", "let skor = 10;", "let skor == 10;"], "a": 2,
     "e": "Urutannya: kata kunci, nama, =, nilai.", "concepts": ["let"]},
    {"id": "k18", "t": f"{ic('const')} paling cocok untuk menyimpan…", "o": ["skor permainan", "jumlah nyawa", "nama sekolah", "waktu tersisa"], "a": 2,
     "e": "Nama sekolah tidak berubah selama program berjalan.", "concepts": ["const"]},
    {"id": "k19", "t": f"Berapa nilai {ic('c')}?", "c": "let a = 4;\nlet b = a;\nb = 10;\nlet c = a + b;", "o": ["8", "14", "20", "44"], "a": 1,
     "e": f"{mono('a')} tetap 4 karena {mono('b')} hanya salinan. 4 + 10 = 14.", "concepts": ["salinan", "hitung"]},
    {"id": "k20", "t": "Apa yang dicetak?", "c": 'let pesan = "Hai";\npesan = pesan + "!";\nconsole.log(pesan);', "o": ["Hai", "Hai!", "pesan!", "error"], "a": 1,
     "e": "Teks lama ditambah tanda seru, lalu disimpan lagi ke pesan.", "concepts": ["assign"]},
]

EXAM = [
    {"id": "u1", "label": "Kata kunci untuk nilai tetap", "t": "Kata kunci untuk nilai yang tidak boleh berubah?", "type": "choice",
     "o": ["let", "const", "var", "static"], "pts": 10, "answer": 1, "concepts": ["const"]},
    {"id": "u2", "label": "Tebak nilai akhir", "t": f"Berapa nilai akhir {ic('total')}?", "code": "let total = 10;\ntotal = total - 4;", "type": "choice",
     "o": ["10", "4", "6", "14"], "pts": 10, "answer": 2, "concepts": ["assign"]},
    {"id": "u3", "label": "Lengkapi deklarasi", "t": f"Lengkapi agar {ic('poin')} bisa bertambah nanti.", "type": "short", "pre": "____ poin = 0;",
     "accept": ["let"], "pts": 15, "concepts": ["let"]},
    {"id": "u4", "label": f"Salinan nilai ({mono('let b = a')})", "t": f"Berapa nilai {ic('b')}?", "code": "let a = 2;\nlet b = a;\na = 5;", "type": "choice",
     "o": ["2", "5", "7", "error"], "pts": 10, "answer": 0, "concepts": ["salinan"]},
    {"id": "u5", "label": "Tulis kode: harga diskon", "t": f"Tulis kode: simpan {ic('harga')} 50000 dan {ic('diskon')} 10000, lalu cetak harga setelah diskon.",
     "type": "code", "pts": 20, "concepts": ["hitung"],
     "tests": [{"id": "out", "kind": "stdout_last", "equals": "40000", "fail": 'output "${last}", seharusnya 40000'},
               {"id": "harga", "kind": "source_regex", "pattern": r"\bharga\b", "fail": "tidak ada variabel harga"},
               {"id": "diskon", "kind": "source_regex", "pattern": r"\bdiskon\b", "fail": "tidak ada variabel diskon"}]},
    {"id": "u6", "label": "Nama tidak valid", "t": "Nama variabel mana yang tidak valid?", "type": "choice",
     "o": ["nilaiAkhir", "$harga", "nilai-akhir", "_id"], "pts": 10, "answer": 2, "concepts": ["penamaan"]},
    {"id": "u7", "label": "Variabel tanpa nilai awal", "t": "Apa isi variabel yang dibuat tanpa nilai awal?", "type": "choice",
     "o": ["0", "null", "undefined", '""'], "pts": 10, "answer": 2, "concepts": ["let"]},
    {"id": "u8", "label": "Kenapa const dulu", "t": f"Mengapa {ic('const')} sebaiknya dipakai lebih dulu?", "type": "choice",
     "o": ["Lebih cepat dijalankan", "Mencegah nilai berubah tanpa sengaja", "Wajib di JavaScript", "Agar bisa diubah"], "pts": 15, "answer": 1, "concepts": ["const"]},
]

CHALLENGE = {
    "title": "Papan skor lomba", "minutes": 10, "difficulty": "sedang", "filename": "papan-skor.js",
    "art": {"kind": "board", "title": "PAPAN SKOR", "name": "Garuda", "value": "6"},
    "story": f"Panitia lomba cerdas cermat butuh papan skor sederhana. Tulis programnya dengan variabel yang <b>tepat</b>.",
    "steps": [
        f"Simpan nama tim {ic('&quot;Garuda&quot;')}. Nama ini tidak akan berubah.",
        f"Simpan skor awal {ic('0')}. Skor akan berubah.",
        "Tim mencetak <b>3 poin</b>, dua kali.",
        f"Cetak persis: {ic('Garuda: 6')}",
    ],
    "starter": '// Papan skor lomba\n// 1. Simpan nama tim "Garuda" (tidak akan berubah)\n// 2. Simpan skor awal 0 (akan berubah)\n// 3. Tim mencetak 3 poin, dua kali\n// 4. Cetak: Garuda: 6\n\n',
    "tests": [
        {"id": "t1", "name": f"Nama tim disimpan dengan {mono('const')}", "kind": "source_regex", "pattern": r"const\s+namaTim\s*=", "fail": "namaTim tidak dibuat dengan const", "hidden": False, "weight": 1},
        {"id": "t2", "name": f"Skor disimpan dengan {mono('let')}", "kind": "source_regex", "pattern": r"let\s+skor\s*=", "fail": "skor harus bisa diubah", "hidden": False, "weight": 1},
        {"id": "t3", "name": f"Nilai akhir {mono('skor')} adalah 6", "kind": "expr", "expr": "skor === 6", "fail": "skor akhir ${skor}", "hidden": False, "weight": 1},
        {"id": "t4", "name": f"Output persis {mono('Garuda: 6')}", "kind": "stdout_last", "equals": "Garuda: 6", "trim": True, "fail": 'output "${last}"', "hidden": False, "weight": 1},
    ],
    "assist": "L1", "related_scene": "s4", "concepts": ["let", "const"],
}

CONTENT = {
    "minutes": {"pahami": 6, "perkuat": 8, "kuis": 4, "uji": 10},
    "concepts": ["let", "assign", "const", "hitung", "penamaan", "salinan"],
    "cheatsheet": 'let skor = 10;        // kotak yang bisa diubah\nskor = 25;            // ganti isi (tanpa let)\nconst sekolah = "SIG"; // dikunci\nconst total = harga * jumlah;',
    "pahami": {"scenes": SCENES},
    "perkuat": {"items": ITEMS},
    "kuis": {"round_size": 10, "seconds": 20, "pass_pct": 70, "combo_max": 3, "bank": BANK},
    "ulangan": {"minutes": 30, "pass_mark": 75, "questions": EXAM},
    "challenge": CHALLENGE,
    "uji_mode": "any",
}
