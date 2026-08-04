// Lapisan penyimpanan data.
//
// Dua driver:
//   "neon"   : Neon Postgres lewat HTTP. Dipakai saat DATABASE_URL terisi.
//              Neon dipilih karena computenya bangun sendiri setelah tidur,
//              tanpa perlu dipulihkan manual.
//   "memori" : penyimpanan di memori proses. Dipakai untuk uji otomatis dan
//              untuk mencoba di komputer sendiri tanpa mendaftar apa pun.
//              PERHATIAN: datanya hilang setiap proses dimatikan.
//
// Driver dipilih otomatis dari ada tidaknya DATABASE_URL.

import { neon } from "@neondatabase/serverless";
import { nilai } from "./env.js";

export function driverDari(env) {
  return nilai(env, "DATABASE_URL") ? "neon" : "memori";
}

// ------------------------------------------------------------------ Memori

const memori = { urutan: 0, baris: [] };

const HURUF = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // tanpa I, O, 0, 1 agar tidak salah baca

function suffixAcak() {
  const b = new Uint8Array(4);
  crypto.getRandomValues(b);
  return [...b].map((x) => HURUF[x % HURUF.length]).join("");
}

// Dipakai uji otomatis agar setiap pengujian mulai dari keadaan bersih.
export function kosongkanMemori() {
  memori.urutan = 0;
  memori.baris = [];
}

// ------------------------------------------------------------------- Neon

function sql(env) {
  return neon(nilai(env, "DATABASE_URL"));
}

function rapikan(baris) {
  if (!baris) return null;
  return {
    ...baris,
    // Neon mengembalikan jsonb sebagai objek, tapi dijaga kalau berupa teks.
    data: typeof baris.data === "string" ? JSON.parse(baris.data) : baris.data || {},
    waktu: baris.waktu instanceof Date ? baris.waktu.toISOString() : baris.waktu,
    waktu_balasan:
      baris.waktu_balasan instanceof Date
        ? baris.waktu_balasan.toISOString()
        : baris.waktu_balasan,
  };
}

// -------------------------------------------------------------------- API

export async function simpanAspirasi(env, baris) {
  if (driverDari(env) === "neon") {
    const q = sql(env);
    const hasil = await q`
      insert into aspirasi (kategori, nama, status_pelapor, kontak, data, ringkasan)
      values (${baris.kategori}, ${baris.nama}, ${baris.status_pelapor},
              ${baris.kontak}, ${JSON.stringify(baris.data)}, ${baris.ringkasan})
      returning *`;
    return rapikan(hasil[0]);
  }

  memori.urutan += 1;
  const baru = {
    id: `memori-${memori.urutan}`,
    nomor: memori.urutan,
    suffix: suffixAcak(),
    waktu: new Date().toISOString(),
    status: "baru",
    balasan: null,
    waktu_balasan: null,
    ...baris,
  };
  baru.kode = `${String(baru.nomor).padStart(4, "0")}-${baru.suffix}`;
  memori.baris.unshift(baru);
  return baru;
}

export async function ambilPerKode(env, kode) {
  if (driverDari(env) === "neon") {
    const q = sql(env);
    const hasil = await q`select * from aspirasi where kode = ${kode} limit 1`;
    return rapikan(hasil[0]);
  }
  return memori.baris.find((b) => b.kode === kode) || null;
}

export async function daftarAspirasi(env, { status, cari, batas = 200 } = {}) {
  const pakaiStatus = status && status !== "semua";
  const pola = cari ? `%${cari}%` : null;

  if (driverDari(env) === "neon") {
    const q = sql(env);
    // Parameter selalu di-bind, tidak pernah disisipkan sebagai teks,
    // jadi tidak ada celah SQL injection dari kotak pencarian.
    const hasil = await q`
      select * from aspirasi
      where (${pakaiStatus}::boolean is false or status = ${status})
        and (${pola}::text is null
             or nama ilike ${pola}
             or ringkasan ilike ${pola}
             or kode ilike ${pola})
      order by waktu desc
      limit ${batas}`;
    return hasil.map(rapikan);
  }

  let baris = memori.baris;
  if (pakaiStatus) baris = baris.filter((b) => b.status === status);
  if (cari) {
    const c = cari.toLowerCase();
    baris = baris.filter(
      (b) =>
        (b.nama || "").toLowerCase().includes(c) ||
        (b.ringkasan || "").toLowerCase().includes(c) ||
        (b.kode || "").toLowerCase().includes(c),
    );
  }
  return baris.slice(0, batas);
}

export async function perbaruiAspirasi(env, kode, perubahan) {
  if (driverDari(env) === "neon") {
    const q = sql(env);
    // coalesce dengan penanda: hanya kolom yang dikirim yang benar-benar diubah.
    const adaBalasan = Object.hasOwn(perubahan, "balasan");
    const adaStatus = Object.hasOwn(perubahan, "status");
    const hasil = await q`
      update aspirasi set
        balasan       = case when ${adaBalasan}::boolean then ${perubahan.balasan ?? null} else balasan end,
        waktu_balasan = case when ${adaBalasan}::boolean then ${perubahan.waktu_balasan ?? null}::timestamptz else waktu_balasan end,
        status        = case when ${adaStatus}::boolean  then ${perubahan.status ?? null}   else status  end
      where kode = ${kode}
      returning *`;
    return rapikan(hasil[0]);
  }

  const baris = memori.baris.find((b) => b.kode === kode);
  if (!baris) return null;
  Object.assign(baris, perubahan);
  return baris;
}

export async function statistik(env) {
  if (driverDari(env) === "neon") {
    const q = sql(env);
    const hasil = await q`
      select
        count(*)::int                                              as total,
        count(*) filter (where status = 'baru')::int               as baru,
        count(*) filter (where status = 'diproses')::int           as diproses,
        count(*) filter (where status = 'selesai')::int            as selesai
      from aspirasi`;
    return hasil[0];
  }

  const b = memori.baris;
  return {
    total: b.length,
    baru: b.filter((x) => x.status === "baru").length,
    diproses: b.filter((x) => x.status === "diproses").length,
    selesai: b.filter((x) => x.status === "selesai").length,
  };
}
