
## [1.3.0] - 2026-09-21

Pemberian nama resmi dan pencatatan versi.

### Ditambahkan

- Nama aplikasi **SiFeeder**, dipakai di dashboard, README, berkas batch, dan
  judul halaman.
- `app/__init__.py` sebagai sumber tunggal nomor versi, nama, dan tagline.
- Nomor versi tampil di header dashboard, di tab Konfigurasi, pada log saat
  aplikasi mulai, dan pada jawaban endpoint `/api/status`.
- Berkas `CHANGELOG.md` ini.

### Diubah

- Nama folder proyek dari `neofeeder-sync` menjadi `sifeeder`.
- Judul FastAPI dan versi API mengambil nilai dari `app/__init__.py`, tidak
  lagi ditulis tetap di `app/main.py`.

---

## [1.2.0] - 2026-09-21

Memperbaiki dua hambatan yang muncul saat percobaan pertama di Windows.

### Ditambahkan

- `app/feeder/diagnostics.py`: pembenah alamat endpoint dan penguji koneksi.
  Alamat seperti `http://127.0.0.1:8100/#/login` otomatis dibersihkan menjadi
  `http://127.0.0.1:8100/ws/live2.php`, dan bila gagal, port 3003, 8082, 8081,
  8100, 3000, serta 80 dicoba satu per satu.
- `scripts/cek_koneksi.py` dan `cek-koneksi.bat`: diagnosa koneksi yang juga
  mendaftar setiap act yang benar-benar dilayani server, beserta jumlah baris
  contohnya. Berguna untuk mengetahui entitas mana yang perlu disesuaikan.
- Pengujian koneksi langsung di dalam `scripts/setup.py`. Alamat dan
  kredensial diuji saat diketik, bukan baru ketahuan salah saat aplikasi
  dijalankan.
- Pemberitahuan kegagalan koneksi di dashboard, lengkap dengan saran
  perbaikan yang sesuai jenis kegagalannya.
- `tests/test_entities.py`: memastikan setiap entitas yang tampil di dashboard
  benar-benar bisa ditarik, kolom kuncinya lengkap, dan pembenahan alamat
  bekerja untuk tujuh bentuk masukan.

### Diperbaiki

- **Feeder tiruan hanya melayani satu entitas.** Akibatnya pilihan bawaan
  dashboard, Biodata Mahasiswa, langsung gagal dengan pesan
  `Act tidak dikenal: GetListMahasiswa`. Feeder tiruan sekarang membaca daftar
  entitas langsung dari `app/feeder/registry.py`, jadi setiap entitas pasti
  punya data contoh: biodata mahasiswa, riwayat pendidikan, AKM, nilai kelas,
  kelas kuliah, mahasiswa lulus/DO, prodi, dan semester.
- Pesan galat untuk act yang tidak dikenal kini menyebut nama act, menyarankan
  `cek_koneksi.py`, dan menunjuk berkas yang perlu disunting. Sebelumnya hanya
  meneruskan teks mentah dari server.
- Teks bantuan entitas di dashboard mengulang kata "Kunci:" dua kali.
- Feeder tiruan menjawab permintaan GET dengan keterangan yang jelas, bukan
  error mentah, sehingga tidak membingungkan bila alamatnya dibuka di peramban.

---

## [1.1.0] - 2026-09-21

Pemasangan di Windows yang sebelumnya tidak bisa diikuti.

### Ditambahkan

- `scripts/setup.py`: penyiap yang menanyakan alamat Feeder dan kredensial,
  lalu menulis `.env` lengkap beserta hash kata sandi dan kunci sesi. Tidak
  ada lagi salin tempel manual.
- `setup.bat`, `jalankan.bat`, dan `feeder-tiruan.bat` untuk Windows.
- Pembatasan izin berkas `.env` lewat `icacls` di Windows, setara `chmod 600`
  di Linux dan macOS.
- Mode uji coba pada penyiap, yang mengisi kredensial Feeder tiruan otomatis.
- Bagian penanganan masalah di README, memuat pesan galat yang sebenarnya
  muncul beserta penyebabnya.

### Diperbaiki

- **Petunjuk pemasangan memakai perintah Linux.** `chmod`, `&&`, dan
  `source .venv/bin/activate` tidak berlaku di PowerShell, sehingga langkah
  pemasangan tidak bisa diikuti sama sekali di Windows. README sekarang
  mengutamakan Windows dan menulis perintah satu per baris.

---

## [1.0.0] - 2026-09-21

Penulisan ulang total. Berkas HTML tunggal `pddikti_neo_feeder_sync_hub.html`
diganti proyek yang benar-benar terhubung ke Neo Feeder.

### Ditambahkan

- Backend Python dengan FastAPI, terbagi menjadi empat lapisan: `feeder/`
  (web service), `storage/` (SQLite), `sync/` (logika sinkronisasi), dan
  `api/` (HTTP).
- Alur wajib bertahap: tarik data, impor CSV, susun pratinjau, simulasi,
  konfirmasi, kirim. Pengiriman nyata ditolak server bila simulasi belum
  pernah dijalankan untuk rencana yang sama.
- Mesin pembandingan data (`sync/diff.py`) dengan normalisasi nilai, sehingga
  `"3.50"` dan `3.5` tidak dianggap berbeda.
- Penyimpanan nilai sebelum dan sesudah perubahan pada setiap baris rencana,
  sebagai bahan pemulihan manual.
- Pekerjaan latar dengan kemajuan nyata, kecepatan terukur, dan pembatalan
  yang benar-benar menghentikan proses.
- Jejak audit untuk setiap aksi yang mengubah keadaan.
- Dashboard lima tab tanpa CDN: Tarik Data, Data Lokal, Pratinjau & Kirim,
  Riwayat & Audit, Konfigurasi.
- Server Neo Feeder tiruan untuk uji coba tanpa menyentuh data sungguhan.
- 54 pengujian otomatis, termasuk uji asap yang menjalankan seluruh alur di
  peramban Chromium sungguhan.

### Diperbaiki

Dari hasil pemeriksaan berkas HTML lama:

- Tombol hanya menjalankan `setInterval`, tidak memanggil API apa pun.
- Statistik palsu: sukses selalu 98 persen, kecepatan acak 80 sampai 99 req/s.
- `get_pending_local_records()` mengembalikan dua nama contoh, yang akan ikut
  terkirim ke Feeder bila dijalankan apa adanya.
- `save_remote_records()` hanya berisi `pass`, jadi hasil tarik data tidak
  tersimpan ke mana pun.
- `compute_diff`, `chunk_payload`, `mark_synced`, dan `upsert_batch` disebut
  di diagram arsitektur tetapi tidak ada di kode.
- Data dikirim sebagai `records=chunk`. Act Insert dan Update Feeder menerima
  satu `record` per request, dan Update membutuhkan `key`.
- Update parsial akan ditolak Feeder. Record sekarang disusun lengkap dari
  nilai remote lalu ditimpa perubahan lokal.
- `push_data` selalu mengembalikan `True` walau ada batch yang gagal.
- Pagination `limit` dan `offset` tanpa `order`, yang bisa menggandakan atau
  melewatkan baris.
- Backoff yang diberi komentar "exponential" sebenarnya linear.
- Token kedaluwarsa hanya ditebak dari selisih 55 menit, tanpa membaca
  jawaban server.
- Tombol Batalkan tidak menghentikan apa pun.
- Daftar semester berhenti di 20251 dan filter prodi memakai kode 5 digit,
  padahal filter Feeder memakai `id_prodi` berbentuk UUID.
- `document.execCommand` yang sudah usang.
- Ringkasan diff tidak cocok dengan isi tabelnya.

### Keamanan

- Menghapus klaim palsu "AES-256-GCM Enkripsi Aktif" dan "disimpan dalam
  Local Vault terenkripsi", padahal tidak ada enkripsi sama sekali.
- Menghapus kata sandi yang tertulis polos pada atribut `value` HTML dan
  terlihat lewat View Source.
- Menambahkan login aplikasi dengan hash PBKDF2-HMAC-SHA256 240.000 iterasi,
  sesi bertanda tangan, cookie HttpOnly, token CSRF, dan pembatas percobaan
  login.
- **Operasi tulis tidak pernah diulang otomatis.** Retry hanya berlaku untuk
  act `Get*`. Bila jawaban tidak diterima, record ditandai `uncertain` supaya
  diperiksa manual, karena pengulangan buta berisiko menciptakan data ganda.
- Mengganti seluruh `innerHTML` dengan `textContent`, menutup celah XSS saat
  data asli dari Feeder ditampilkan.
- Menghapus seluruh CDN (Tailwind, Chart.js, FontAwesome) dan menerapkan
  Content-Security-Policy `default-src 'self'` tanpa skrip maupun gaya
  sebaris.
- Mengganti perakitan filter lewat f-string dengan perakit yang memakai daftar
  kolom terizin dan escape literal.
- Menolak HTTP polos ke host non-lokal kecuali diizinkan secara sadar lewat
  `FEEDER_ALLOW_INSECURE_HTTP`.
- Log memakai rotasi berkas dan menyamarkan NIM, nama, NIK, token, serta
  kata sandi.

### Dihapus

- Berkas tunggal `pddikti_neo_feeder_sync_hub.html` beserta seluruh isinya
  yang bersifat simulasi: progres `setInterval`, grafik dengan angka tetap,
  status "Connected" dan "Token Aktif 58m" yang ditulis langsung di HTML,
  serta data diff contoh.

---

## [0.1.0] - sebelum 2026-09-21

Prototipe tampilan berupa satu berkas `pddikti_neo_feeder_sync_hub.html`.
Berfungsi sebagai gambaran antarmuka, tetapi tidak terhubung ke API mana pun.
Dicatat di sini sebagai titik awal, bukan sebagai rilis.

---