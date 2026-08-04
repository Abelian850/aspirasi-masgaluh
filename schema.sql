-- Skema database Aspirasi (Neon / PostgreSQL)
--
-- Cara menjalankan: buka console.neon.tech > pilih project > SQL Editor,
-- tempel seluruh berkas ini, tekan Run. Cukup sekali saja.

create sequence if not exists aspirasi_nomor_seq start 1;

create table if not exists aspirasi (
  id          uuid primary key default gen_random_uuid(),
  nomor       integer not null default nextval('aspirasi_nomor_seq'),
  suffix      text    not null default upper(substr(md5(random()::text), 1, 4)),

  -- Kode tiket yang dilihat warga, contoh: 0007-K7QM.
  -- Bagian acaknya penting: tanpa itu orang bisa mengetik 0001, 0002, dan
  -- seterusnya untuk mengintip aspirasi warga lain.
  kode        text    generated always as (lpad(nomor::text, 4, '0') || '-' || suffix) stored,

  waktu       timestamptz not null default now(),
  kategori    text    not null,
  nama        text    not null,
  status_pelapor text,
  kontak      text,
  data        jsonb   not null default '{}'::jsonb,  -- semua jawaban form
  ringkasan   text    not null,                      -- versi teks untuk notifikasi

  status      text    not null default 'baru',
  balasan     text,
  waktu_balasan timestamptz,

  constraint aspirasi_status_sah check (status in ('baru', 'diproses', 'selesai'))
);

create unique index if not exists aspirasi_kode_idx   on aspirasi (kode);
create index        if not exists aspirasi_waktu_idx  on aspirasi (waktu desc);
create index        if not exists aspirasi_status_idx on aspirasi (status);

-- Catatan keamanan: Neon tidak punya lapisan API publik seperti Supabase.
-- Satu-satunya jalan masuk ke tabel ini adalah DATABASE_URL, yang hanya ada di
-- environment variable Cloudflare dan tidak pernah dikirim ke browser. Karena
-- itu Row Level Security tidak diperlukan di sini.

-- Memeriksa hasilnya:
--   select kode, waktu, kategori, status from aspirasi order by waktu desc limit 10;
