# SiFeeder

**Sinkronisasi PDDIKTI dengan pratinjau dan konfirmasi.**

Jembatan antara data akademik kampus dan PDDIKTI Neo Feeder, dengan alur
**tarik, bandingkan, pratinjau, simulasi, konfirmasi, kirim**. Backend Python
(FastAPI) yang benar-benar memanggil web service Feeder, dashboard web tanpa
CDN.

Riwayat perubahan ada di [CHANGELOG.md](CHANGELOG.md).

---

## 1. Struktur berkas

```
sifeeder/
├── setup.bat                    penyiapan sekali klik (Windows)
├── jalankan.bat                 menjalankan aplikasi (Windows)
├── cek-koneksi.bat              diagnosa koneksi Feeder (Windows)
├── feeder-tiruan.bat            menjalankan Feeder tiruan (Windows)
├── run.py                       titik masuk server
├── requirements.txt             dependensi runtime
├── requirements-dev.txt         dependensi pengujian
├── .env.example                 contoh konfigurasi (dibuat otomatis oleh setup)
├── CHANGELOG.md                 catatan perubahan tiap versi
├── pytest.ini
│
├── app/                         BACKEND PYTHON
│   ├── __init__.py              nama dan nomor versi aplikasi
│   ├── config.py                pembacaan .env + validasi keamanan endpoint
│   ├── security.py              hash kata sandi, sesi, CSRF, pembatas login
│   ├── logging_setup.py         rotasi log + penyamaran data sensitif
│   ├── main.py                  aplikasi FastAPI + header keamanan
│   │
│   ├── feeder/                  LAPISAN WEB SERVICE
│   │   ├── client.py            klien ws/live2.php
│   │   ├── diagnostics.py       pembenah alamat + penguji koneksi
│   │   ├── errors.py            jenis kesalahan
│   │   ├── filters.py           perakit filter SQL yang aman
│   │   └── registry.py          definisi entitas (act, kunci, field)
│   │
│   ├── storage/                 LAPISAN DATA
│   │   ├── database.py          skema SQLite
│   │   └── repository.py        akses data + audit
│   │
│   ├── sync/                    LOGIKA SINKRONISASI
│   │   ├── diff.py              pembandingan record
│   │   ├── engine.py            tarik, susun rencana, terapkan
│   │   └── jobs.py              pekerjaan latar + pembatalan
│   │
│   └── api/                     HTTP
│       ├── deps.py              wadah keadaan + penjaga sesi/CSRF
│       ├── routes.py            seluruh endpoint
│       └── schemas.py           skema permintaan
│
├── web/                         FRONTEND
│   ├── index.html               dashboard
│   ├── login.html
│   ├── css/styles.css
│   └── js/
│       ├── api.js               pembungkus fetch + CSRF
│       ├── dom.js               pembantu DOM aman XSS
│       ├── state.js             keadaan bersama
│       ├── jobmonitor.js        pemantau progres
│       ├── dashboard.js         tab tarik data
│       ├── localdata.js         tab impor CSV
│       ├── preview.js           tab pratinjau dan kirim
│       ├── history.js           tab riwayat dan audit
│       ├── settings.js          tab konfigurasi
│       ├── login.js
│       └── app.js               titik masuk
│
├── scripts/
│   ├── setup.py                 penyiap .env (lintas sistem operasi)
│   ├── cek_koneksi.py           diagnosa koneksi dan daftar act
│   └── hash_password.py         pembuat hash kata sandi saja
│
└── tests/
    ├── mock_feeder.py           server Neo Feeder tiruan
    ├── test_entities.py         setiap entitas dapat ditarik
    ├── test_filters.py          pengujian anti injeksi
    ├── test_diff.py             pengujian pembandingan
    ├── test_client.py           pengujian klien dan keamanan
    ├── test_api.py              pengujian alur lewat HTTP
    └── test_browser_smoke.py    uji asap di peramban sungguhan
```

---

## 2. Pemasangan di Windows

Syarat: Python 3.10 atau lebih baru, dipasang dengan opsi **Add Python to PATH**
dicentang. Periksa dengan `py --version`.

### Cara tercepat

Klik dua kali **`setup.bat`**, ikuti pertanyaannya, lalu klik dua kali
**`jalankan.bat`**. Selesai.

`setup.bat` membuat lingkungan virtual, memasang dependensi, lalu menanyakan
alamat Feeder dan kredensial. Berkas `.env` ditulis otomatis, termasuk hash
kata sandi dan kunci sesi, jadi tidak ada yang perlu disunting manual.

### Kalau lebih suka lewat PowerShell

PowerShell lama tidak mengenal `&&`, jadi setiap perintah ditulis per baris:

```powershell
cd "D:\PROJECT\Sinkron Neofeeder\sifeeder"

py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe scripts\setup.py
.\.venv\Scripts\python.exe run.py
```

Memanggil `.venv\Scripts\python.exe` secara langsung menghindari keharusan
mengaktifkan lingkungan virtual. Kalau tetap ingin mengaktifkannya:

```powershell
.\.venv\Scripts\Activate.ps1
```

Bila muncul pesan *running scripts is disabled on this system*, izinkan skrip
untuk pengguna Anda sekali saja:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

Setelah server hidup, buka `http://127.0.0.1:8700` di peramban.

### Mencoba dulu tanpa menyentuh Feeder sungguhan

Paket ini memuat server Neo Feeder tiruan berisi data contoh untuk **seluruh
entitas** yang ada di dashboard: biodata mahasiswa, riwayat pendidikan, AKM,
nilai kelas, kelas kuliah, mahasiswa lulus/DO, prodi, dan semester. Jadi
entitas mana pun yang Anda pilih akan bekerja.

Pada `setup.bat`, pilih **mode 2**. Lalu:

1. Klik dua kali `feeder-tiruan.bat`, biarkan jendelanya terbuka.
2. Klik dua kali `jalankan.bat` di jendela lain.
3. Buka `http://127.0.0.1:8700`.

Seluruh alur bisa dicoba sampai tahap kirim tanpa satu pun data PDDIKTI
tersentuh.

---

## 2a. Menghubungkan ke Neo Feeder sungguhan

### Alamat yang benar

Yang dibutuhkan adalah **endpoint web service**, bukan alamat halaman aplikasi
Neo Feeder. Keduanya sering tertukar:

| | Alamat |
|---|---|
| Halaman aplikasi Neo Feeder (dibuka di peramban) | `http://127.0.0.1:8100/#/login` |
| Endpoint web service (dipakai aplikasi ini) | `http://127.0.0.1:3003/ws/live2.php` |

Endpoint web service hanya menerima POST berisi JSON. Membukanya di peramban
akan tampak kosong atau error, dan itu normal.

Port yang umum dipakai:

| Versi | Port web service |
|---|---|
| Neo Feeder v3.x | `3003` |
| Neo Feeder 2022 (v2.x) | `3003` atau `8082` |
| Feeder lama | `8082` |

Kalau Feeder Anda di belakang reverse proxy, pakai alamat publiknya, misalnya
`https://neo.umkota.ac.id/ws/live2.php`.

Anda tidak perlu menebak. Tempel saja alamat apa pun yang Anda tahu saat
`setup.bat` bertanya. Skrip akan membuang bagian `#/login`, menambahkan
`/ws/live2.php`, menguji koneksinya, dan bila gagal, mencoba port 3003, 8082,
8081, 8100, 3000, dan 80 lalu memberi tahu mana yang menjawab.

### Kredensial

`FEEDER_USERNAME` adalah **kode perguruan tinggi**, bukan email atau username
pengelola. `FEEDER_PASSWORD` adalah password Feeder PT. Keduanya sama dengan
yang dipakai aplikasi lain untuk memanggil web service Feeder Anda.

### Memeriksa koneksi kapan saja

Klik dua kali **`cek-koneksi.bat`**, atau:

```powershell
.\.venv\Scripts\python.exe scripts\cek_koneksi.py
```

Skrip ini membaca `.env`, menguji koneksi, dan bila berhasil, mendaftar
**setiap act yang benar-benar dilayani server Anda**:

```
  ENTITAS                          ACT                                  HASIL
  -------------------------------- ------------------------------------ -------------------
  Biodata Mahasiswa                GetListMahasiswa                     OK (1 baris contoh)
  Aktivitas Kuliah Mahasiswa (AKM) GetAktivitasKuliahMahasiswa          OK (1 baris contoh)
  Nilai Perkuliahan Kelas          GetDetailNilaiPerkuliahanKelas       ditolak: Act tidak...
```

Baris `ditolak` berarti versi Feeder Anda memakai nama act yang berbeda.
Sunting `app/feeder/registry.py` pada entitas tersebut, lalu jalankan lagi.
Untuk menguji alamat lain tanpa mengubah `.env`:

```powershell
.\.venv\Scripts\python.exe scripts\cek_koneksi.py http://127.0.0.1:3003/ws/live2.php KODE_PT
```

### Sebelum menyentuh data produksi

1. Jalankan `cek-koneksi.bat` sampai semua entitas yang akan Anda pakai
   berstatus OK.
2. Di tab **Konfigurasi**, jalankan `GetDictionary` untuk entitas tersebut dan
   bandingkan daftar field-nya dengan `writable_fields` di
   `app/feeder/registry.py`. Field bertanda `mandatory` wajib ikut terkirim
   karena Feeder menolak update parsial.
3. Tarik data dan susun pratinjau lebih dulu. Dua langkah itu hanya membaca.
4. Jalankan simulasi, periksa hasilnya, unduh CSV rencana sebagai arsip.
5. Baru kirim, dan mulailah dari beberapa record saja dengan mencentang
   sebagian baris di tab Pratinjau.

---

## 2b. Pemasangan di Linux atau macOS

```bash
cd sifeeder
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python scripts/setup.py
python run.py
```

---

## 2c. Menjalankan pengujian

```bash
pip install -r requirements-dev.txt
python -m playwright install chromium   # hanya untuk uji peramban
pytest
```

Di Windows, ganti `pip` dan `python` dengan `.\.venv\Scripts\python.exe -m pip`
dan `.\.venv\Scripts\python.exe -m pytest`.

---

## 2d. Bila ada yang tidak jalan

| Pesan | Penyebab dan penanganan |
|---|---|
| `chmod : The term 'chmod' is not recognized` | Perintah Linux di PowerShell. Tidak perlu dijalankan: `setup.bat` sudah mengatur izin `.env` lewat `icacls`. |
| `The token '&&' is not a valid statement separator` | PowerShell lama. Tulis perintah satu per baris seperti contoh di atas. |
| `Environment variable FEEDER_USERNAME wajib diisi` | `.env` masih kosong karena hanya disalin dari `.env.example`. Jalankan `setup.bat` atau `py scripts\setup.py`. |
| `py : The term 'py' is not recognized` | Python belum masuk PATH. Pasang ulang Python dan centang **Add Python to PATH**, atau pakai `python` sebagai ganti `py`. |
| `[Errno 10048] address already in use` | Port 8700 sedang dipakai. Ubah `PORT` di `.env`, misalnya `PORT=8800`. |
| `running scripts is disabled on this system` | Kebijakan PowerShell. Jalankan `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`. |
| Badge koneksi merah, `Tidak terhubung` | Jalankan `cek-koneksi.bat`. Skrip akan menguji alamat, mencoba port lain, dan menyebut mana yang menjawab. |
| `FEEDER_URL` berisi `#/login` | Itu alamat halaman aplikasi Neo Feeder, bukan endpoint web service. Yang benar berakhiran `/ws/live2.php`. Lihat bagian 2a. |
| `Act tidak dikenal: GetListMahasiswa` | Versi Feeder Anda memakai nama act lain untuk entitas itu. Jalankan `cek-koneksi.bat` untuk melihat act mana yang dilayani, lalu sesuaikan `app/feeder/registry.py`. |
| `Autentikasi ke Neo Feeder gagal` | `FEEDER_USERNAME` (kode perguruan tinggi) atau `FEEDER_PASSWORD` salah. Ulangi `py scripts\setup.py`. |
| Lupa kata sandi aplikasi | Jalankan `py scripts\setup.py` lagi dan pilih timpa saat ditanya. |

---

## 3. Alur pemakaian

| Langkah | Tindakan | Menyentuh data PDDIKTI? |
|---|---|---|
| 1 | **Tarik Data**: salin kondisi Feeder ke basis data lokal | tidak, hanya baca |
| 2 | **Data Lokal**: impor CSV berisi nilai yang menurut Anda benar | tidak |
| 3 | **Pratinjau**: bandingkan keduanya, hasilkan rencana | tidak |
| 4 | **Simulasi**: jalankan rencana tanpa mengirim apa pun | tidak |
| 5 | **Kirim**: setelah mengetik `KIRIM` pada dialog konfirmasi | ya, menulis |

Langkah 5 ditolak server bila langkah 4 belum pernah dijalankan untuk rencana
yang sama. Bila klien lupa mengirimkan pilihan mode, nilai bawaannya adalah
simulasi, bukan pengiriman.

Template CSV per entitas tersedia di tab Data Lokal, berisi kolom kunci dan
kolom yang boleh ditulis untuk entitas tersebut.

---

## 4. Perbaikan terhadap berkas lama

### Fungsi

| Masalah pada berkas lama | Penanganan sekarang |
|---|---|
| Tombol hanya menjalankan `setInterval`, tidak memanggil API | Semua aksi memanggil backend yang benar benar menghubungi Feeder |
| Statistik palsu (sukses 98 persen, kecepatan acak) | Angka dihitung dari hasil nyata per record |
| `get_pending_local_records` mengembalikan data contoh | Data lokal berasal dari impor CSV yang divalidasi |
| `save_remote_records` berisi `pass` | Disimpan ke SQLite dalam satu transaksi |
| `compute_diff`, `chunk_payload`, `mark_synced` disebut di diagram tapi tidak ada | Diff, rencana, dan penandaan hasil diimplementasikan |
| `records=chunk` dikirim sebagai batch | Satu record per request, `key` + `record` sesuai spesifikasi act |
| Update parsial | Record disusun lengkap dari nilai remote lalu ditimpa perubahan lokal |
| `push_data` selalu `return True` | Hasil dicatat per record: berhasil, ditolak, gagal, tidak pasti |
| Pagination tanpa `order` | `order` selalu diisi; loop berhenti saat halaman tidak penuh |
| Backoff linear yang ditulis "exponential" | Eksponensial dengan jitter, khusus operasi baca |
| Token hanya ditebak dari 55 menit | Kedaluwarsa dideteksi dari jawaban server, lalu login ulang otomatis |
| Tombol batal tidak menghentikan apa pun | Flag pembatalan diperiksa antar record dan antar halaman |
| Daftar semester berhenti di 20251, prodi memakai kode 5 digit | Semester dan prodi diambil langsung dari Feeder (`id_prodi` UUID) |
| `document.execCommand` yang usang | Diganti operasi DOM biasa dan unduhan berkas |

### Keamanan

| Masalah pada berkas lama | Penanganan sekarang |
|---|---|
| Klaim "AES-256-GCM Enkripsi Aktif" tanpa enkripsi apa pun | Klaim palsu dihapus; kredensial hanya ada di `.env` sisi server |
| Password tertulis polos di atribut `value` HTML | Tidak ada kotak kredensial Feeder di halaman |
| Tidak ada otentikasi | Login aplikasi, hash PBKDF2-SHA256, pembatas percobaan |
| Tidak ada konfirmasi sebelum menulis | Wajib simulasi, konfirmasi, dan mengetik `KIRIM` |
| Retry pada POST non-idempoten | Operasi tulis tidak pernah diulang; hasil tak pasti dilaporkan tersendiri |
| `innerHTML` tanpa escape | Seluruh isi dinamis lewat `textContent` |
| Tailwind, Chart.js, FontAwesome dari CDN tanpa SRI | Tanpa CDN sama sekali; CSP `default-src 'self'` |
| `filter` dirakit lewat f-string | Perakit filter dengan daftar kolom yang diizinkan dan escape literal |
| HTTP tanpa penjagaan | HTTP ke host non-lokal ditolak kecuali diizinkan secara sadar |
| Log berisi NIM dan nama polos tanpa rotasi | `RotatingFileHandler` + penyamaran NIM, nama, NIK, token, password |

---

## 5. Catatan keamanan penting

**Operasi tulis tidak pernah diulang otomatis.** Bila jawaban tidak diterima,
record ditandai `uncertain`. Status di PDDIKTI tidak dapat dipastikan dari sisi
aplikasi, jadi record tersebut harus diperiksa manual sebelum dikirim ulang.
Pengulangan buta berisiko menciptakan data ganda.

**Nilai sebelum perubahan disimpan.** Setiap baris rencana menyimpan `before`
(nilai di Feeder) dan `after` (yang dikirim). Unduh CSV rencana sebelum
mengirim sebagai arsip pemulihan. Aplikasi ini tidak menyediakan rollback
otomatis karena pembatalan di PDDIKTI punya aturannya sendiri.

**Skema field perlu diverifikasi.** Daftar field di `app/feeder/registry.py`
mengikuti dokumentasi WS versi 2.x dan belum tentu sama dengan Neo Feeder di
server Anda. Tab Konfigurasi menyediakan `GetDictionary` untuk membaca skema
`key` dan `record` yang sebenarnya. Sesuaikan `writable_fields` bila ada
selisih, khususnya field bertanda `mandatory`, karena Feeder menolak update
parsial.

**Coba di data uji lebih dulu.** Jalankan terhadap salinan Feeder atau server
tiruan sebelum menyentuh produksi.

---

## 6. Menjalankan di belakang Nginx

```nginx
location / {
    proxy_pass http://127.0.0.1:8700;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Setelah HTTPS aktif, set `COOKIE_SECURE=true` di `.env`. Biarkan aplikasi
mendengarkan di `127.0.0.1` saja dan biarkan Nginx yang menghadap keluar.

Contoh unit systemd:

```ini
[Unit]
Description=SiFeeder
After=network.target

[Service]
User=neofeeder
WorkingDirectory=/opt/sifeeder
EnvironmentFile=/opt/sifeeder/.env
ExecStart=/opt/sifeeder/.venv/bin/python run.py
Restart=on-failure
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

---

## 7. Ringkasan endpoint

| Metode | Jalur | Keterangan |
|---|---|---|
| POST | `/api/auth/login` | masuk, mengembalikan token CSRF |
| GET | `/api/entities` | daftar entitas dan jumlah record |
| GET | `/api/status` | konfigurasi aktif dan pekerjaan berjalan |
| GET | `/api/feeder/ping` | uji koneksi ke Feeder |
| GET | `/api/feeder/dictionary?fungsi=` | skema act dari server |
| GET | `/api/reference/{semester\|prodi}` | referensi langsung dari Feeder |
| POST | `/api/pull` | tarik data (pekerjaan latar) |
| POST | `/api/local/import` | impor CSV |
| GET | `/api/local/template/{entity}` | unduh template CSV |
| POST | `/api/plan` | susun rencana diff |
| GET | `/api/plan/{id}` | isi rencana |
| POST | `/api/plan/{id}/selection` | pilih atau batalkan baris |
| POST | `/api/plan/{id}/apply` | simulasi atau kirim |
| GET | `/api/plan/{id}/export.csv` | unduh rencana |
| GET | `/api/jobs/{id}` | progres dan log |
| POST | `/api/jobs/{id}/cancel` | batalkan |
| GET | `/api/audit` | jejak audit |

Semua endpoint selain login memerlukan sesi; endpoint yang mengubah keadaan
memerlukan header `X-CSRF-Token`.

---

## 8. Cakupan pengujian

88 pengujian, dijalankan dengan `pytest`:

- **`test_entities.py`** — setiap entitas yang tampil di dashboard benar-benar
  bisa ditarik, kolom kuncinya ada pada tiap record, dan alamat seperti
  `http://127.0.0.1:8100/#/login` dibereskan menjadi endpoint yang benar.
- **`test_filters.py`** — payload injeksi (`' OR '1'='1`) di-escape, kolom dan
  operator di luar daftar ditolak.
- **`test_diff.py`** — `"3.50"` sama dengan `3.5`, kolom yang tidak ada di CSV
  tidak dianggap kosong, record update dikirim lengkap.
- **`test_client.py`** — login ulang otomatis saat token ditolak, pagination
  tidak menggandakan baris, **operasi tulis yang terputus tidak diulang**,
  update parsial ditolak, log menyamarkan rahasia dan data pribadi.
- **`test_api.py`** — alur lengkap, kirim sebelum simulasi ditolak, tanpa kata
  `KIRIM` ditolak, rencana terkunci setelah dijalankan, satu record gagal tidak
  menghentikan sisanya.
- **`test_browser_smoke.py`** — halaman dijalankan di Chromium sungguhan:
  login, tarik, impor, bandingkan, simulasi, konfirmasi, kirim, tanpa satu pun
  kesalahan konsol, tanpa permintaan ke luar, di bawah CSP ketat.
