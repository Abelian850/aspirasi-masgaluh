# Layanan Aspirasi Mas Galuh

Warga mengirim aspirasi lewat form web, admin langsung dapat notifikasi di
Telegram, dan warga memantau tindak lanjutnya memakai nomor tiket.

Pengganti bot WhatsApp Baileys yang nomornya kena banned. Tidak ada satu pun
bagian sistem ini yang bisa dibanned WhatsApp, karena tidak ada nomor WhatsApp
yang login ke server.

- **Hosting:** Cloudflare Pages
- **Database:** Neon Postgres
- **Notifikasi:** Telegram Bot API
- **Alamat:** `masgaluh.smpn30smg.online`

Semuanya paket gratis. Tidak ada proses yang perlu dijaga menyala.

## Isi

```
web-aspirasi/
  config.js          Nama sekolah, kategori layanan, susunan form
  schema.sql         Skema database untuk Neon
  wrangler.toml      Konfigurasi Cloudflare Pages
  server.js          Server untuk mencoba di komputer sendiri
  uji.js             Uji otomatis (104 pemeriksaan)
  src/               Logika inti, dipakai bersama Cloudflare dan server lokal
  functions/api/     Pembungkus Cloudflare Pages Functions
  public/            Halaman warga, cek status, dashboard admin
  .github/workflows/ Pemantauan mingguan (opsional)
```

Pemisahan `src/` dan `functions/` itu disengaja: seluruh logika ada di `src/`,
sedangkan `functions/api/*` hanya pembungkus tiga baris. Artinya yang kamu uji
di komputer sendiri adalah kode yang sama persis dengan yang berjalan di
produksi — bukan versi tiruan.

## Mencoba di komputer sendiri (5 menit)

Tidak perlu mendaftar apa pun.

```bash
cd web-aspirasi
npm install
node uji.js       # memastikan semuanya berfungsi
node server.js    # menjalankan situsnya
```

| Halaman | Alamat |
|---|---|
| Form warga | http://localhost:3000/ |
| Cek status | http://localhost:3000/status.html |
| Dashboard admin | http://localhost:3000/admin.html |
| Kesehatan | http://localhost:3000/api/sehat |

Untuk masuk ke dashboard, salin `.env.example` menjadi `.env` dan isi minimal
`ADMIN_PASSWORD` dan `SESSION_SECRET`.

> Tanpa `DATABASE_URL`, data disimpan di memori dan **hilang setiap server
> dimatikan.** Itu wajar untuk mencoba-coba. Untuk menyimpan sungguhan, isi
> `DATABASE_URL` dari Neon.

## Menyiapkan Telegram

1. Buka Telegram, cari **@BotFather**, kirim `/newbot`.
2. Ikuti instruksinya. BotFather memberi **token** seperti `8123456789:AAF...`.
   Simpan sebagai `TELEGRAM_BOT_TOKEN`.
3. Cari bot yang baru dibuat, tekan **Start**, kirim satu pesan apa saja.
   **Langkah ini wajib** — Telegram melarang bot mengirim pesan lebih dulu ke
   orang yang belum pernah memulai percakapan.
4. Buka alamat ini di browser, ganti `TOKEN` dengan token kamu:

   ```
   https://api.telegram.org/botTOKEN/getUpdates
   ```

   Cari angka di `"chat":{"id":123456789`. Itulah `TELEGRAM_CHAT_ID`.

### Kalau admin lebih dari satu

`TELEGRAM_CHAT_ID` menerima beberapa id dipisah koma:

```
TELEGRAM_CHAT_ID=123456789,-1001234567890
```

Dua cara, pilihannya bukan soal teknis:

- **Beberapa id pribadi.** Tiap admin dapat pesan di chat masing-masing. Cocok
  bila aspirasi sensitif. Menambah admin berarti mengubah environment variable
  dan deploy ulang.
- **Satu grup Telegram.** Menambah admin cukup invite ke grup. Tapi semua
  anggota grup melihat semua aspirasi.

Dua jebakan pada jalur grup:

1. Bot harus dimasukkan ke grup dan ada satu pesan terkirim, baru id-nya muncul
   di `getUpdates`. ID grup berupa angka **negatif**.
2. Kalau grup biasa nanti berubah menjadi supergroup — otomatis terjadi saat
   anggota bertambah banyak — **id-nya berganti** dan notifikasi berhenti tanpa
   peringatan. Amannya: ubah dulu ke supergroup, baru ambil id-nya.

## Menyiapkan database Neon

1. Daftar di [neon.com](https://neon.com), buat project baru. Pilih region
   **Singapore (ap-southeast-1)** — paling dekat ke Indonesia.
2. Buka **SQL Editor**, tempel seluruh isi `schema.sql`, tekan **Run**.
3. Buka **Connect**, pilih **Pooled connection**, salin connection string-nya.
   Bentuknya seperti:

   ```
   postgresql://pengguna:sandi@ep-nama-123456-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```

   Itu nilai `DATABASE_URL`.

### Kenapa Neon, bukan Supabase

Keduanya menidurkan database yang tidak dipakai, tapi cara bangunnya berbeda
dan ini yang menentukan:

| | Supabase gratis | Neon gratis |
|---|---|---|
| Tidur setelah | 7 hari tanpa aktivitas | 5 menit tanpa aktivitas |
| Bangunnya | **Manual**, harus dipulihkan dari dashboard | **Sendiri**, ratusan milidetik |
| Akibat kalau libur panjang | Layanan mati sampai kamu sadar | Warga pertama menunggu sedetik |

Neon tidur lebih cepat tapi tidak pernah butuh campur tangan. Itu perbedaan
antara "lambat sebentar" dan "mati tanpa pemberitahuan".

### Yang perlu dipantau di Neon

Kuota gratis: **100 CU-jam per bulan** dan 0,5 GB penyimpanan.

Perlu diketahui: setiap kunjungan membangunkan compute minimal 5 menit. Jadi
yang menghabiskan kuota bukan jumlah aspirasi, melainkan **sebaran waktu**
kunjungan. Lima puluh orang membuka form dalam satu jam lebih murah daripada
sepuluh orang yang tersebar sepanjang hari.

Untuk skala satu sekolah ini aman, tapi periksa halaman **Usage** di Neon
setelah bulan pertama. Ada laporan pengguna yang memakai jauh lebih banyak
CU-jam dari perkiraan pada project dengan lalu lintas menetes sepanjang hari.
Kalau ternyata mendekati batas, opsinya menaikkan ke paket berbayar atau
menerima database sesekali tidak tersedia di akhir bulan.

## Deploy ke Cloudflare Pages

### 1. Unggah ke GitHub

Pastikan `.env` **tidak** ikut — sudah diatur di `.gitignore`, jangan
dikeluarkan dari situ.

### 2. Buat project Pages

1. Buka **dash.cloudflare.com** > **Workers & Pages** > **Create** >
   **Pages** > **Connect to Git**, pilih repo kamu.
2. Pengaturan build:

   | Kolom | Isi |
   |---|---|
   | Framework preset | None |
   | Build command | `echo dependencies siap` |
   | Build output directory | `public` |

   > **Build command tidak boleh kosong.** Ini menjebak dan pesan errornya
   > menyesatkan. Kalau kolom itu kosong, Cloudflare melewati seluruh langkah
   > Node — termasuk memasang dependency — lalu gagal dengan
   > `Could not resolve "@neondatabase/serverless"`, yang terlihat seperti
   > masalah kode padahal bukan.
   >
   > Perintahnya sendiri tidak penting; kehadirannya yang memicu Cloudflare
   > menjalankan `npm clean-install`. Karena itu dipakai `echo` saja: tidak
   > mungkin gagal, dan tidak menambah titik kegagalan baru.

3. **Environment variables**, isi sebelum deploy pertama:

   | Nama | Tipe | Isi |
   |---|---|---|
   | `DATABASE_URL` | Secret | connection string Neon |
   | `TELEGRAM_BOT_TOKEN` | Secret | dari BotFather |
   | `ADMIN_PASSWORD` | Secret | kata sandi dashboard |
   | `SESSION_SECRET` | Secret | hasil perintah acak di bawah |
   | `TELEGRAM_CHAT_ID` | **Secret** | id chat admin |

   `URL_PUBLIK` **tidak perlu diisi** — kode otomatis memakai alamat situs
   sendiri kalau kosong.

   > Kenapa `TELEGRAM_CHAT_ID` dibuat Secret, bukan Text? Karena repo ini punya
   > `wrangler.toml`, dan menurut dokumentasi Cloudflare berkas itu menjadi
   > *source of truth*: variabel bertipe **Text** yang diisi di dashboard akan
   > **diabaikan**. Secret disimpan lewat mekanisme terpisah sehingga tidak
   > terkena aturan itu. Kalau nanti ada pengaturan non-rahasia baru,
   > tempatnya di `[vars]` dalam `wrangler.toml`, bukan di dashboard.

   Membuat `SESSION_SECRET`:

   ```bash
   node -e "console.log(crypto.randomUUID()+crypto.randomUUID())"
   ```

   Yang bertipe **Secret** tidak bisa dibaca lagi setelah disimpan. Itu memang
   tujuannya. Simpan salinannya di pengelola kata sandi, bukan di catatan biasa.

4. **Save and Deploy.** Cloudflare memberi alamat sementara
   `namaproject.pages.dev`.

### 3. Pasang subdomain

DNS `smpn30smg.online` sudah berada di Cloudflare (nameserver `bradley` dan
`paige.ns.cloudflare.com`), jadi tidak ada nameserver yang perlu diubah.

Di project Pages > **Custom domains** > **Set up a custom domain**:

1. Masukkan `masgaluh.smpn30smg.online` > **Continue** > **Activate domain**.
2. Ulangi untuk `aspirasi.smpn30smg.online` sebagai alias. Cloudflare
   mengizinkan beberapa custom domain pada satu project gratis, jadi keduanya
   akan bekerja.

Cloudflare membuat CNAME dan sertifikat HTTPS-nya sendiri. Biasanya aktif dalam
beberapa menit.

Memastikan sudah jalan:

```
https://masgaluh.smpn30smg.online/api/sehat
```

Harus menjawab `"siapPakai": true`.

### 4. Menyebarkan ke warga

Bagikan `masgaluh.smpn30smg.online` lewat grup WhatsApp biasa, poster, atau QR
code. Warga hanya membuka tautan — tidak perlu menginstal apa pun.

Pertimbangan jujur: nama merek lebih sulit diingat daripada nama fungsi. Kalau
"Mas Galuh" belum dikenal luas, pakai `aspirasi.smpn30smg.online` di poster dan
simpan `masgaluh` untuk keperluan internal. Dua-duanya menuju tempat yang sama.

## Apakah aktif 24 jam?

Ya, dan tidak ada yang perlu dijaga menyala. Bot lama butuh PC menyala 24 jam;
sistem ini tidak punya proses yang berjalan terus, jadi tidak ada yang bisa mati.

| Bagian | Ketersediaan | Catatan |
|---|---|---|
| Cloudflare Pages | 24/7 | 100.000 permintaan/hari pada paket gratis |
| Neon | 24/7 | Tidur 5 menit, bangun sendiri |
| Telegram | 24/7 | Di luar kendali kita, praktis selalu hidup |

`.github/workflows/pantau.yml` memeriksa `/api/sehat` setiap Senin. Ini
**tidak wajib** — gunanya hanya agar GitHub mengirim email kalau situs rusak,
sehingga kamu tahu sebelum ada warga yang mengeluh.

## Seberapa aman Telegram-nya

Tiga hal yang perlu dibedakan.

**Akun Telegram pribadimu tidak terekspos.** Warga tidak pernah berhubungan
dengan bot. Alurnya hanya server → bot → kamu. Nomor HP dan username admin
tidak pernah terlihat siapa pun yang mengisi form.

**Botnya tidak bisa dibanned seperti WhatsApp,** selama tidak dipakai spam.
Bot API ini resmi dari Telegram, bukan hasil rekayasa balik protokol.

**Tapi chat bot Telegram TIDAK terenkripsi ujung-ke-ujung.** Enkripsi
ujung-ke-ujung di Telegram hanya berlaku untuk Secret Chat antar-manusia, dan
bot tidak bisa memakainya. Setiap aspirasi yang dikirim ke Telegram tersimpan
di server Telegram dalam bentuk yang bisa mereka baca.

Untuk aspirasi sekolah ini bukan soal sepele: pengaduan bisa memuat nama anak,
dugaan perundungan, atau tuduhan terhadap guru. Karena itu ada saklar di
`config.js`:

```json
"notifikasiRingkas": true
```

Kalau dinyalakan, Telegram hanya menerima nomor tiket, kategori, waktu, dan
tautan dashboard. Isi aspirasi dan nama pelapor tidak ikut — admin membacanya di
dashboard, yang datanya ada di database kamu sendiri.

Konsekuensinya: admin harus membuka browser untuk membaca setiap aspirasi.
Ini pertukaran antara kenyamanan dan kerahasiaan, dan kamu yang paling tahu mana
yang lebih penting untuk sekolahmu.

### Yang benar-benar berisiko: rahasia bocor

Ancaman terbesar bukan Telegram, tapi `TELEGRAM_BOT_TOKEN` atau `DATABASE_URL`
yang ikut terunggah ke GitHub.

- Siapa pun yang punya bot token bisa mengambil alih bot dan membaca semua pesan
  yang masuk ke sana. Kalau bocor: kirim `/revoke` ke @BotFather.
- Siapa pun yang punya `DATABASE_URL` bisa membaca dan **menghapus** seluruh
  aspirasi. Kalau bocor: reset password database di Neon (**Roles** >
  **Reset password**), lalu perbarui di Cloudflare.

`.env` sudah masuk `.gitignore`, dan `wrangler.toml` sengaja tidak memuat satu
pun rahasia. Uji otomatis memeriksa keduanya setiap kali dijalankan.

## Nomor tiket

Formatnya `0007-K7QM`: nomor urut ditambah empat karakter acak.

Bagian acak itu penting. Kalau tiket hanya nomor urut, siapa pun bisa mengetik
`0001`, `0002`, dan seterusnya untuk mengintip aspirasi orang lain. Halaman cek
status juga sengaja hanya mengembalikan kategori, waktu, status, dan balasan —
isi aspirasi dan identitas pelapor tidak pernah dikirim ke publik.

Huruf `I`, `O`, angka `0` dan `1` tidak dipakai di bagian acak, supaya warga
tidak salah membaca saat mencatat.

## Pilihan lapor: WhatsApp atau web

Halaman warga membuka dengan satu pertanyaan: mau lapor lewat WhatsApp, atau
lewat formulir web. Pengaturannya di `config.js`:

```js
whatsapp: {
  aktif: true,
  tautan: "https://api.whatsapp.com/send/?phone=628xxxxxxxxxx&text&type=phone_number&app_absent=0",
  nomorTampil: "08xx-xxxx-xxxx",
  deskripsi: "...",   // kalimat kecil di bawah judul pilihan
  catatan: "...",     // kotak biru di bawah kedua pilihan
}
```

Yang perlu diperhatikan:

- Nomor di dalam `tautan` ditulis dengan kode negara tanpa tanda plus
  (`6281...`, bukan `081...`). `nomorTampil` hanya untuk dibaca warga, boleh
  ditulis dengan format lokal.
- `catatan` adalah pengaman jalur: dia yang memberi tahu warga bahwa formulir
  web tetap bisa dipakai kalau WhatsApp tidak dibalas atau nomor admin sedang
  mati. Jangan dihapus tanpa mengganti dengan kalimat yang sepadan — tanpa itu,
  warga yang chat-nya tidak dibalas akan menyimpulkan layanannya mati.
- Aspirasi lewat WhatsApp **tidak** masuk dashboard dan tidak dapat nomor
  tiket; itu percakapan biasa yang harus dicatat admin sendiri. Hanya jalur web
  yang tercatat dan bisa dilacak warga lewat halaman cek status.
- `aktif: false` mematikan gerbang ini. Halaman kembali langsung membuka
  pilihan kategori seperti sebelumnya, dan penomoran langkah mundur satu
  (jadi "1. Pilih jenis aspirasi") tanpa perlu mengubah HTML.

## Mengubah kategori dan pertanyaan form

Semua ada di `config.js`. Form di browser dibangun otomatis dari berkas ini,
jadi tidak perlu menyentuh HTML.

```json
{
  "id": "5",
  "nama": "Permohonan Surat",
  "ikon": "S",
  "deskripsi": "Mengajukan surat keterangan.",
  "fields": [
    {
      "nama": "jenis_surat",
      "label": "Jenis surat",
      "tipe": "pilihan",
      "wajib": true,
      "opsi": ["Surat keterangan aktif", "Surat izin"]
    },
    { "nama": "keperluan", "label": "Keperluan", "tipe": "teks_panjang", "wajib": true }
  ]
}
```

Tipe field: `text`, `teks_panjang`, `pilihan`.

Field bisa dimunculkan bersyarat:

```json
"tampilJika": { "field": "status_pelapor", "nilai": ["Wali murid"] }
```

> `config.js` diimpor saat build, bukan dibaca dari disk — Cloudflare Workers
> tidak punya sistem berkas. Jadi setiap perubahan `config.js` **perlu deploy
> ulang** (cukup push ke GitHub).

Setelah mengubahnya, jalankan `node uji.js` untuk memastikan tidak ada yang
rusak.

## Mengganti logo

| Berkas | Dipakai untuk | Saran ukuran |
|---|---|---|
| `public/logo.png` | Logo di kepala tiap halaman | lebar 520 px, latar transparan |
| `public/ikon.png` | Ikon tab browser dan pintasan HP | 192 x 192 px |

Keduanya dibuat dari `../logo-mas-galuh.png` dengan latar hitamnya dihapus agar
emasnya bisa duduk di atas warna hijau kepala halaman. Kalau nanti ada berkas
logo asli berlatar transparan, cukup timpa keduanya dengan nama yang sama —
tidak perlu mengubah kode.

## Keamanan yang sudah dipasang

- Dashboard dikunci kata sandi; token sesi ditandatangani HMAC-SHA256 dan
  kedaluwarsa (bawaan 12 jam).
- Perbandingan kata sandi dan tanda tangan memakai waktu tetap, tidak
  membocorkan lewat selisih waktu respons.
- Batas laju per IP: pengiriman, cek status, dan percobaan login.
- Perangkap tersembunyi untuk robot pengisi form.
- Semua masukan divalidasi ulang di server, bukan hanya di browser.
- Query database selalu memakai parameter yang di-bind, jadi kotak pencarian
  tidak bisa dipakai untuk SQL injection.
- Isi aspirasi tidak pernah bocor lewat halaman cek status atau `/api/sehat`.

Yang **belum** ada dan perlu kamu pertimbangkan sendiri:

- **CAPTCHA.** Kalau nanti banyak spam, Cloudflare Turnstile gratis dan paling
  mudah dipasang karena situsnya sudah di Cloudflare.
- **Rate limiting sungguhan.** Pembatas di kode ini berbasis memori tiap
  instance, jadi bersifat perkiraan. Kalau benar-benar diserang, yang dibutuhkan
  adalah Cloudflare Rate Limiting Rules di depan situs.
- **Enkripsi isi aspirasi di database.** Kalau aspirasi memuat data yang sangat
  sensitif.

## Menjalankan uji

```bash
node uji.js
```

104 pemeriksaan: pembuatan tiket, penolakan masukan tidak sah, kebocoran data,
autentikasi admin, alur balasan, penyaring dan pencarian, penyusunan notifikasi,
pembatas laju, pembungkus Cloudflare Pages Functions, dan berkas konfigurasi
deploy. Jalankan setiap kali mengubah `config.js` atau kode.

Ujinya memakai driver memori, jadi tidak menyentuh jaringan, tidak butuh Neon,
dan tidak meninggalkan berkas apa pun.

## Catatan tentang bot WhatsApp yang lama

Bot Baileys yang lama sudah dihapus seluruhnya pada 4 Agustus 2026: `bot.js`,
folder `auth/` berisi 847 berkas sesi WhatsApp, `node_modules`, dan seluruh
konfigurasinya. Tidak ada lagi kredensial WhatsApp di komputer ini.

Yang perlu diingat kalau suatu saat ingin kembali ke WhatsApp: menghapus kode
**tidak** membatalkan ban nomornya, karena blokirnya ada di sisi Meta. Dan jalur
yang benar adalah WhatsApp Cloud API resmi — bukan Baileys, dan bukan gateway
pihak ketiga seperti Fonnte atau Wablas yang sebetulnya juga Baileys dengan
risiko ban yang sama.
