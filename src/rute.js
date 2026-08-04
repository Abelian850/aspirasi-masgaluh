// Seluruh endpoint API.
//
// Setiap handler memakai standar web: menerima (request, env), mengembalikan
// Response. Bentuk ini berjalan apa adanya di Cloudflare Pages Functions, dan
// dijembatani ke Node oleh server.js untuk dicoba di komputer sendiri.

import {
  simpanAspirasi,
  ambilPerKode,
  daftarAspirasi,
  perbaruiAspirasi,
  statistik,
  driverDari,
} from "./db.js";
import { beritahuAdmin, telegramAktif, susunNotifikasi } from "./telegram.js";
import { validasiKiriman } from "./validasi.js";
import { config, configPublik, labelField } from "./config.js";
import { authSiap, sandiBenar, buatToken, tolakBukanAdmin } from "./auth.js";
import { nilai } from "./env.js";
import {
  json,
  bacaBody,
  bersihkan,
  waktuIndo,
  lolosBatas,
  ipPengirim,
  paramUrl,
} from "./util.js";

const POLA_KODE = /^\d{4}-[A-Z0-9]{4}$/;
const STATUS_SAH = ["baru", "diproses", "selesai"];

// Batas laju bisa disetel lewat environment variable.
// Naikkan BATAS_KIRIM kalau ada acara yang membuat banyak warga mengirim
// dari satu jaringan wifi sekolah, karena mereka akan terlihat ber-IP sama.
function batas(env, nama, bawaan) {
  const n = Number(nilai(env, nama, String(bawaan)));
  return Number.isFinite(n) && n > 0 ? n : bawaan;
}

function salahMetode() {
  return json(405, { ok: false, pesan: "Metode tidak didukung." });
}

// Alamat publik situs, untuk tombol di notifikasi Telegram.
function asalSitus(request, env) {
  const diatur = nilai(env, "URL_PUBLIK");
  if (diatur) return diatur.replace(/\/+$/, "");
  try {
    return new URL(request.url).origin;
  } catch {
    return "";
  }
}

// ------------------------------------------------------------- GET /api/config

export async function ruteConfig(request) {
  if (request.method !== "GET") return salahMetode();
  return json(200, { ok: true, config: configPublik() });
}

// ---------------------------------------------------------- POST /api/aspirasi

export async function ruteAspirasi(request, env) {
  if (request.method !== "POST") return salahMetode();

  const ip = ipPengirim(request);
  if (!lolosBatas(`kirim:${ip}`, batas(env, "BATAS_KIRIM", 5), 10 * 60 * 1000)) {
    return json(429, {
      ok: false,
      pesan: "Terlalu banyak kiriman dari perangkat ini. Silakan coba lagi beberapa menit lagi.",
    });
  }

  let masukan;
  try {
    masukan = await bacaBody(request);
  } catch (e) {
    return json(400, { ok: false, pesan: e.message });
  }

  // Perangkap bot: field tersembunyi yang hanya terisi kalau diisi robot.
  // Dijawab seolah berhasil supaya robotnya tidak belajar.
  if (masukan.website) {
    return json(200, { ok: true, kode: "0000-XXXX", waktu: waktuIndo(null, env) });
  }

  const { galat, hasil } = validasiKiriman(masukan);
  if (galat.length) return json(400, { ok: false, pesan: galat.join(" "), galat });

  // Aspirasi disimpan LEBIH DULU, notifikasi menyusul. Kalau Telegram
  // bermasalah, data warga tetap aman dan tetap muncul di dashboard.
  let baris;
  try {
    baris = await simpanAspirasi(env, hasil);
  } catch (e) {
    console.error("[aspirasi] gagal simpan:", e.message);
    return json(500, {
      ok: false,
      pesan: "Aspirasi gagal disimpan. Silakan coba lagi sebentar lagi.",
    });
  }

  const asal = asalSitus(request, env);
  try {
    await beritahuAdmin(env, baris, asal ? `${asal}/admin.html` : null);
  } catch (e) {
    console.error("[aspirasi] notifikasi gagal:", e.message);
  }

  return json(200, {
    ok: true,
    kode: baris.kode,
    waktu: waktuIndo(baris.waktu, env),
    kategori: baris.kategori,
    pesan: config().pesanKonfirmasi.replace("{KATEGORI}", baris.kategori),
  });
}

// ------------------------------------------------------------ GET /api/status
//
// Yang dikembalikan sengaja dibatasi: hanya kategori, waktu, status, dan
// balasan. Isi aspirasi dan identitas pelapor TIDAK dikirim, supaya kalau nomor
// tiket bocor, isinya tetap tidak terbaca orang lain.

export async function ruteStatus(request, env) {
  if (request.method !== "GET") return salahMetode();

  const ip = ipPengirim(request);
  if (!lolosBatas(`status:${ip}`, batas(env, "BATAS_CEK_STATUS", 30), 10 * 60 * 1000)) {
    return json(429, { ok: false, pesan: "Terlalu banyak percobaan. Coba lagi nanti." });
  }

  const kode = paramUrl(request, "kode").trim().toUpperCase();
  if (!POLA_KODE.test(kode)) {
    return json(400, {
      ok: false,
      pesan: "Format nomor tiket tidak sesuai. Contoh yang benar: 0007-K7QM",
    });
  }

  let baris;
  try {
    baris = await ambilPerKode(env, kode);
  } catch (e) {
    console.error("[status] gagal baca:", e.message);
    return json(500, { ok: false, pesan: "Gagal memeriksa tiket. Coba lagi sebentar lagi." });
  }

  if (!baris) return json(404, { ok: false, pesan: "Nomor tiket tidak ditemukan." });

  return json(200, {
    ok: true,
    tiket: {
      kode: baris.kode,
      kategori: baris.kategori,
      waktu: waktuIndo(baris.waktu, env),
      status: baris.status,
      balasan: baris.balasan || null,
      waktuBalasan: baris.waktu_balasan ? waktuIndo(baris.waktu_balasan, env) : null,
    },
  });
}

// ------------------------------------------------------- POST /api/admin/login

export async function ruteLogin(request, env) {
  if (request.method !== "POST") return salahMetode();

  if (!authSiap(env)) {
    return json(500, {
      ok: false,
      pesan: "ADMIN_PASSWORD atau SESSION_SECRET belum diatur di environment variable.",
    });
  }

  const ip = ipPengirim(request);
  if (!lolosBatas(`login:${ip}`, batas(env, "BATAS_LOGIN", 8), 15 * 60 * 1000)) {
    return json(429, { ok: false, pesan: "Terlalu banyak percobaan masuk. Tunggu 15 menit." });
  }

  let body;
  try {
    body = await bacaBody(request);
  } catch (e) {
    return json(400, { ok: false, pesan: e.message });
  }

  if (!sandiBenar(env, body.sandi)) {
    return json(401, { ok: false, pesan: "Kata sandi salah." });
  }

  return json(200, { ok: true, token: await buatToken(env) });
}

// ------------------------------------------------------ GET /api/admin/daftar

export async function ruteDaftar(request, env) {
  if (request.method !== "GET") return salahMetode();
  const tolak = await tolakBukanAdmin(request, env);
  if (tolak) return tolak;

  const status = paramUrl(request, "status") || "semua";
  const cari = paramUrl(request, "cari").trim().slice(0, 80);

  try {
    const baris = await daftarAspirasi(env, { status, cari, batas: 200 });
    return json(200, {
      ok: true,
      daftar: baris.map((b) => ({
        kode: b.kode,
        kategori: b.kategori,
        waktu: waktuIndo(b.waktu, env),
        nama: b.nama,
        statusPelapor: b.status_pelapor || null,
        kontak: b.kontak || null,
        status: b.status,
        balasan: b.balasan || null,
        waktuBalasan: b.waktu_balasan ? waktuIndo(b.waktu_balasan, env) : null,
        isian: Object.entries(b.data || {}).map(([k, v]) => ({ label: labelField(k), nilai: v })),
      })),
      statistik: await statistik(env),
    });
  } catch (e) {
    console.error("[admin/daftar] gagal:", e.message);
    return json(500, { ok: false, pesan: "Gagal memuat data." });
  }
}

// ------------------------------------------------------- POST /api/admin/balas

export async function ruteBalas(request, env) {
  if (request.method !== "POST") return salahMetode();
  const tolak = await tolakBukanAdmin(request, env);
  if (tolak) return tolak;

  let body;
  try {
    body = await bacaBody(request);
  } catch (e) {
    return json(400, { ok: false, pesan: e.message });
  }

  const kode = String(body.kode || "").trim().toUpperCase();
  if (!POLA_KODE.test(kode)) return json(400, { ok: false, pesan: "Nomor tiket tidak sah." });

  const perubahan = {};

  if (typeof body.balasan === "string") {
    const balasan = bersihkan(body.balasan, 4000);
    perubahan.balasan = balasan || null;
    perubahan.waktu_balasan = balasan ? new Date().toISOString() : null;
  }

  if (body.status != null) {
    const status = String(body.status);
    if (!STATUS_SAH.includes(status)) {
      return json(400, { ok: false, pesan: "Status tidak dikenali." });
    }
    perubahan.status = status;
  }

  if (!Object.keys(perubahan).length) {
    return json(400, { ok: false, pesan: "Tidak ada perubahan yang dikirim." });
  }

  try {
    const baris = await perbaruiAspirasi(env, kode, perubahan);
    if (!baris) return json(404, { ok: false, pesan: "Tiket tidak ditemukan." });
    return json(200, {
      ok: true,
      tiket: {
        kode: baris.kode,
        status: baris.status,
        balasan: baris.balasan || null,
        waktuBalasan: baris.waktu_balasan ? waktuIndo(baris.waktu_balasan, env) : null,
      },
    });
  } catch (e) {
    console.error("[admin/balas] gagal:", e.message);
    return json(500, { ok: false, pesan: "Gagal menyimpan perubahan." });
  }
}

// ------------------------------------------------------------- GET /api/sehat
//
// Pemeriksaan kesehatan. Tidak membocorkan apa pun: hanya status konfigurasi.
// Neon tidur setelah 5 menit tanpa aktivitas tapi bangun sendiri, jadi endpoint
// ini tidak wajib dipanggil berkala seperti dulu waktu memakai Supabase.

export async function ruteSehat(request, env) {
  if (request.method !== "GET") return salahMetode();

  const mulai = Date.now();
  let databaseHidup = false;
  let galat = null;

  try {
    // Query paling murah yang tetap menyentuh database sungguhan.
    // Kode ini pasti tidak ada, jadi tidak ada data warga yang terbaca.
    await ambilPerKode(env, "0000-CEK0");
    databaseHidup = true;
  } catch (e) {
    galat = e.message.slice(0, 200);
  }

  const tg = telegramAktif(env);
  const auth = authSiap(env);
  const siapPakai = databaseHidup && tg && auth;

  return json(siapPakai ? 200 : 503, {
    ok: databaseHidup,
    siapPakai,
    penyimpanan: driverDari(env),
    databaseHidup,
    telegramTerpasang: tg,
    dashboardTerpasang: auth,
    notifikasiRingkas: Boolean(config().notifikasiRingkas),
    msRespons: Date.now() - mulai,
    waktu: new Date().toISOString(),
    ...(galat ? { galat } : {}),
  });
}

// --------------------------------------------------------------- Daftar rute

export const RUTE = {
  "/api/config": ruteConfig,
  "/api/aspirasi": ruteAspirasi,
  "/api/status": ruteStatus,
  "/api/sehat": ruteSehat,
  "/api/admin/login": ruteLogin,
  "/api/admin/daftar": ruteDaftar,
  "/api/admin/balas": ruteBalas,
};

export { susunNotifikasi };
