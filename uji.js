// Uji alur end-to-end tanpa perlu Neon maupun Telegram.
// Jalankan: node uji.js
//
// Memakai driver "memori", jadi tidak menyentuh jaringan dan tidak meninggalkan
// berkas apa pun. Yang diuji: pembuatan tiket, penolakan masukan tidak sah,
// kebocoran data, autentikasi admin, alur balasan, penyaring, penyusunan
// notifikasi, adaptor Node, dan pembungkus Cloudflare Pages Functions.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, readFileSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const PORT = 3999;
const ALAMAT = `http://127.0.0.1:${PORT}`;

const SANDI = "sandi-uji-123";
let lolos = 0;
let gagal = 0;

function cek(nama, syarat, tambahan = "") {
  if (syarat) {
    lolos += 1;
    console.log(`  LULUS  ${nama}`);
  } else {
    gagal += 1;
    console.log(`  GAGAL  ${nama}${tambahan ? "  -> " + tambahan : ""}`);
  }
}

const jsonDari = async (res) => res.json().catch(() => ({}));
const ambil = (jalur, opsi) => fetch(`${ALAMAT}${jalur}`, opsi);
const kirimJson = (jalur, body, header = {}) =>
  ambil(jalur, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...header },
    body: JSON.stringify(body),
  });

async function tungguSiap(batasMs = 15000) {
  const mulai = Date.now();
  while (Date.now() - mulai < batasMs) {
    try {
      if ((await ambil("/api/config")).ok) return true;
    } catch {
      /* belum siap */
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
}

const anak = spawn(process.execPath, [join(here, "server.js")], {
  env: {
    ...process.env,
    PORT: String(PORT),
    ADMIN_PASSWORD: SANDI,
    SESSION_SECRET: "rahasia-uji-yang-cukup-panjang",
    DATABASE_URL: "", // kosong -> driver memori
    TELEGRAM_BOT_TOKEN: "",
    TELEGRAM_CHAT_ID: "",
    // Batas laju dinaikkan agar tidak menghalangi uji itu sendiri.
    // Pembatasnya diuji terpisah sebagai unit di bagian 15.
    BATAS_KIRIM: "500",
    BATAS_CEK_STATUS: "500",
    BATAS_LOGIN: "500",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let catatanServer = "";
anak.stdout.on("data", (d) => (catatanServer += d));
anak.stderr.on("data", (d) => (catatanServer += d));

const selesai = (kode) => {
  anak.kill();
  process.exit(kode);
};

if (!(await tungguSiap())) {
  console.error("Server tidak mau start.\n" + catatanServer);
  selesai(1);
}

console.log("\n1. Konfigurasi");
{
  const d = await jsonDari(await ambil("/api/config"));
  cek("config terbaca lewat import modul", d.ok === true);
  cek("config.js dipakai, bukan config.json", !existsSync(join(here, "config.json")));
  cek("ada 4 layanan", d.config?.layanan?.length === 4, `dapat ${d.config?.layanan?.length}`);
  cek("field umum ada", (d.config?.fieldUmum || []).length > 0);
  cek("nama sekolah terkirim", Boolean(d.config?.namaSekolah));

  // Gerbang pilihan saluran di halaman warga dibangun dari blok ini. Kalau
  // tautannya hilang atau ditulis pakai 08..., gerbangnya diam-diam tidak
  // muncul atau membuka chat ke nomor yang salah.
  const wa = d.config?.whatsapp;
  cek("blok whatsapp terkirim ke browser", Boolean(wa));
  if (wa?.aktif) {
    cek("tautan whatsapp diisi", /^https:\/\/(api\.whatsapp\.com|wa\.me)\//.test(wa.tautan || ""), wa.tautan);
    cek("nomor whatsapp pakai kode negara", /[?/]phone=\d{10,15}|wa\.me\/\d{10,15}/.test(wa.tautan || ""), wa.tautan);
    cek("catatan jalur cadangan ada", (wa.catatan || "").length > 20);
  }

  // Halaman warga memuat gerbang, dan tetap bisa jatuh ke jalur web.
  const beranda = readFileSync(join(here, "public/index.html"), "utf8");
  cek("gerbang saluran ada di halaman", beranda.includes('id="langkah-gate"'));
  cek("pilihan web ada di halaman", beranda.includes('id="pilih-web"'));
  cek("tautan whatsapp dibuka di tab baru", /id="pilih-wa"[\s\S]{0,160}target="_blank"/.test(beranda));
}

console.log("\n2. Kirim aspirasi yang sah");
let kodeTiket = null;
{
  const d = await jsonDari(
    await kirimJson("/api/aspirasi", {
      layanan: "1",
      jawaban: {
        nama: "Bayu Sadewo",
        status_pelapor: "Wali murid",
        anak_kelas: "Andi Saputra - 8B",
        kontak: "085389767894",
        pengaduan: "Atap kelas 8B bocor saat hujan deras.",
        harapan: "Mohon diperbaiki sebelum musim hujan puncak.",
      },
    }),
  );
  cek("aspirasi diterima", d.ok === true, d.pesan);
  cek("kode tiket berformat 0000-XXXX", /^\d{4}-[A-Z0-9]{4}$/.test(d.kode || ""), d.kode);
  cek("tiket pertama bernomor 0001", (d.kode || "").startsWith("0001-"), d.kode);
  cek("suffix tidak memakai huruf rancu (I, O, 0, 1)", !/[IO01]/.test((d.kode || "").slice(5)));
  cek("pesan konfirmasi menyebut kategori", (d.pesan || "").includes("Pengaduan"), d.pesan);
  kodeTiket = d.kode;
}

console.log("\n3. Menolak masukan yang tidak sah");
{
  const kosong = await jsonDari(await kirimJson("/api/aspirasi", { layanan: "1", jawaban: { nama: "" } }));
  cek("field wajib kosong ditolak", kosong.ok === false);

  const palsu = await jsonDari(await kirimJson("/api/aspirasi", { layanan: "99", jawaban: { nama: "X" } }));
  cek("layanan tidak dikenal ditolak", palsu.ok === false);

  const opsi = await jsonDari(
    await kirimJson("/api/aspirasi", {
      layanan: "2",
      jawaban: { nama: "X", status_pelapor: "Presiden", saran: "halo" },
    }),
  );
  cek("pilihan di luar daftar ditolak", opsi.ok === false, JSON.stringify(opsi));

  const jebakan = await jsonDari(
    await kirimJson("/api/aspirasi", { layanan: "1", jawaban: {}, website: "spam.example" }),
  );
  cek("perangkap robot tidak menyimpan data", jebakan.kode === "0000-XXXX");

  const bukanJson = await ambil("/api/aspirasi", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: "bukan json",
  });
  cek("body non-JSON ditolak", bukanJson.status === 400, String(bukanJson.status));

  const larik = await jsonDari(await kirimJson("/api/aspirasi", { layanan: "1", jawaban: [1, 2, 3] }));
  cek("jawaban berupa larik ditolak", larik.ok === false);

  const metodeSalah = await ambil("/api/aspirasi");
  cek("GET ke endpoint POST ditolak 405", metodeSalah.status === 405, String(metodeSalah.status));
}

console.log("\n4. Warga cek status");
{
  const d = await jsonDari(await ambil(`/api/status?kode=${kodeTiket}`));
  cek("tiket ditemukan", d.ok === true, d.pesan);
  cek("status awal 'baru'", d.tiket?.status === "baru", d.tiket?.status);
  cek("belum ada balasan", d.tiket?.balasan === null);
  const teks = JSON.stringify(d);
  cek("isi aspirasi TIDAK dibocorkan ke publik", !teks.includes("Atap kelas 8B bocor"));
  cek("nama pelapor TIDAK dibocorkan ke publik", !teks.includes("Bayu Sadewo"));
  cek("kontak TIDAK dibocorkan ke publik", !teks.includes("085389767894"));

  cek("tiket tidak ada ditolak", (await jsonDari(await ambil("/api/status?kode=9999-ZZZZ"))).ok === false);
  cek("format tiket salah ditolak", (await jsonDari(await ambil("/api/status?kode=abc"))).ok === false);
  cek("tiket kosong ditolak", (await jsonDari(await ambil("/api/status"))).ok === false);
}

console.log("\n5. Keamanan dashboard admin");
let token = null;
{
  cek("daftar tanpa token ditolak 401", (await ambil("/api/admin/daftar")).status === 401);

  const palsu = await ambil("/api/admin/daftar", {
    headers: { Authorization: "Bearer 99999999999999.palsu" },
  });
  cek("token palsu ditolak 401", palsu.status === 401, String(palsu.status));

  const kedaluwarsa = await ambil("/api/admin/daftar", {
    headers: { Authorization: "Bearer 1000000000000.abc" },
  });
  cek("token kedaluwarsa ditolak 401", kedaluwarsa.status === 401);

  cek(
    "sandi salah ditolak",
    (await jsonDari(await kirimJson("/api/admin/login", { sandi: "salah" }))).ok === false,
  );

  const masuk = await jsonDari(await kirimJson("/api/admin/login", { sandi: SANDI }));
  cek("sandi benar menghasilkan token", masuk.ok === true && Boolean(masuk.token));
  cek("token bertanda tangan HMAC hex", /^\d+\.[0-9a-f]{64}$/.test(masuk.token || ""), masuk.token);
  token = masuk.token;
}

const bearer = () => ({ Authorization: `Bearer ${token}` });

console.log("\n6. Admin melihat data lengkap");
{
  const d = await jsonDari(await ambil("/api/admin/daftar", { headers: bearer() }));
  cek("daftar terbaca", d.ok === true, d.pesan);
  cek("ada 1 aspirasi tersimpan", d.daftar?.length === 1, `dapat ${d.daftar?.length}`);
  cek("admin melihat isi lengkap", JSON.stringify(d).includes("Atap kelas 8B bocor"));
  cek("label field diterjemahkan", JSON.stringify(d).includes("Isi pengaduan"));
  cek("statistik benar", d.statistik?.total === 1 && d.statistik?.baru === 1);
}

console.log("\n7. Admin membalas");
{
  const d = await jsonDari(
    await kirimJson(
      "/api/admin/balas",
      { kode: kodeTiket, balasan: "Perbaikan atap dijadwalkan pekan depan.", status: "diproses" },
      bearer(),
    ),
  );
  cek("balasan tersimpan", d.ok === true, d.pesan);
  cek("status berubah jadi diproses", d.tiket?.status === "diproses", d.tiket?.status);

  const statusPalsu = await jsonDari(
    await kirimJson("/api/admin/balas", { kode: kodeTiket, status: "dihapus-diam-diam" }, bearer()),
  );
  cek("status tidak dikenal ditolak", statusPalsu.ok === false);

  const tanpaPerubahan = await jsonDari(
    await kirimJson("/api/admin/balas", { kode: kodeTiket }, bearer()),
  );
  cek("permintaan tanpa perubahan ditolak", tanpaPerubahan.ok === false);

  const tiketAsing = await jsonDari(
    await kirimJson("/api/admin/balas", { kode: "9999-ZZZZ", status: "selesai" }, bearer()),
  );
  cek("tiket tidak ada ditolak 404", tiketAsing.ok === false);
}

console.log("\n8. Warga melihat balasan");
{
  const d = await jsonDari(await ambil(`/api/status?kode=${kodeTiket}`));
  cek("status ikut berubah", d.tiket?.status === "diproses", d.tiket?.status);
  cek("balasan terlihat warga", (d.tiket?.balasan || "").includes("Perbaikan atap"), d.tiket?.balasan);
  cek("waktu balasan tercatat", Boolean(d.tiket?.waktuBalasan));
  cek("isi aspirasi tetap tidak bocor", !JSON.stringify(d).includes("Atap kelas 8B bocor"));
}

console.log("\n9. Penyaring dan pencarian");
{
  const g = async (q) => jsonDari(await ambil(`/api/admin/daftar?${q}`, { headers: bearer() }));
  cek("saring 'selesai' kosong", (await g("status=selesai")).daftar?.length === 0);
  cek("saring 'diproses' berisi 1", (await g("status=diproses")).daftar?.length === 1);
  cek("pencarian nama berfungsi", (await g("cari=Bayu")).daftar?.length === 1);
  cek("pencarian nomor tiket berfungsi", (await g(`cari=${kodeTiket}`)).daftar?.length === 1);
  cek("pencarian tanpa hasil mengembalikan kosong", (await g("cari=tidakadaini")).daftar?.length === 0);
  cek("tanda kutip di pencarian tidak merusak", Array.isArray((await g("cari=%27%20or%201%3D1--")).daftar));
}

console.log("\n10. Notifikasi Telegram");
{
  const { susunNotifikasi } = await import("./src/telegram.js");
  const { config } = await import("./src/config.js");
  const contoh = {
    kode: "0001-ABCD",
    kategori: "Pengaduan",
    waktu: new Date().toISOString(),
    nama: "Bayu <script>",
    status_pelapor: "Wali murid",
    kontak: "0853",
    data: { pengaduan: "Atap bocor", harapan: "Diperbaiki" },
  };

  const teks = susunNotifikasi(contoh, "https://masgaluh.smpn30smg.online/admin.html");
  cek("notifikasi memuat nomor tiket", teks.includes("0001-ABCD"));
  cek("notifikasi memuat isi", teks.includes("Atap bocor"));
  cek("label field diterjemahkan", teks.includes("Isi pengaduan"));
  cek("HTML berbahaya di-escape", teks.includes("&lt;script&gt;") && !teks.includes("<script>"));

  const ringkas = susunNotifikasi(contoh, "https://masgaluh.smpn30smg.online/admin.html", {
    ...config(),
    notifikasiRingkas: true,
  });
  cek("mode ringkas tetap memuat nomor tiket", ringkas.includes("0001-ABCD"));
  cek("mode ringkas menyembunyikan isi", !ringkas.includes("Atap bocor"));
  cek("mode ringkas menyembunyikan nama", !ringkas.includes("Bayu"));
  cek("mode ringkas tetap memberi tautan dashboard", ringkas.includes("/admin.html"));
}

console.log("\n11. Pemeriksaan kesehatan");
{
  const r = await ambil("/api/sehat");
  const d = await jsonDari(r);
  cek("endpoint sehat menjawab", typeof d.ok === "boolean");
  cek("database terbaca", d.databaseHidup === true, d.galat);
  cek("driver memori terdeteksi", d.penyimpanan === "memori", d.penyimpanan);
  cek("dashboard terpasang terdeteksi", d.dashboardTerpasang === true);
  cek("telegram belum terpasang terdeteksi", d.telegramTerpasang === false);
  cek("status 503 saat konfigurasi belum lengkap", r.status === 503, String(r.status));
  cek("tidak membocorkan isi aspirasi", !JSON.stringify(d).includes("Atap kelas 8B bocor"));
}

console.log("\n12. Pembungkus Cloudflare Pages Functions");
{
  const berkas = {
    "functions/api/config.js": "/api/config",
    "functions/api/aspirasi.js": "/api/aspirasi",
    "functions/api/status.js": "/api/status",
    "functions/api/sehat.js": "/api/sehat",
    "functions/api/admin/login.js": "/api/admin/login",
    "functions/api/admin/daftar.js": "/api/admin/daftar",
    "functions/api/admin/balas.js": "/api/admin/balas",
  };

  for (const jalur of Object.keys(berkas)) {
    cek(`${jalur} ada`, existsSync(join(here, jalur)));
  }

  // Pembungkus dipanggil dengan context tiruan, memastikan request dan env
  // benar-benar diteruskan ke handler di src/rute.js.
  const modul = await import("./functions/api/config.js");
  cek("mengekspor onRequest", typeof modul.onRequest === "function");

  const hasil = await modul.onRequest({
    request: new Request("https://contoh.test/api/config"),
    env: {},
  });
  cek("pembungkus mengembalikan Response", hasil instanceof Response);
  cek("pembungkus meneruskan ke handler", (await hasil.json()).ok === true);

  const sehat = await import("./functions/api/sehat.js");
  const hasilSehat = await sehat.onRequest({
    request: new Request("https://contoh.test/api/sehat"),
    env: { ADMIN_PASSWORD: "x", SESSION_SECRET: "y" },
  });
  const dSehat = await hasilSehat.json();
  cek("env dari context terpakai", dSehat.dashboardTerpasang === true, JSON.stringify(dSehat));
}

console.log("\n13. Berkas konfigurasi deploy");
{
  const wr = readFileSync(join(here, "wrangler.toml"), "utf8");
  cek("wrangler.toml ada", wr.length > 0);
  cek("nodejs_compat dinyalakan", wr.includes("nodejs_compat"));
  cek("output dir menunjuk public", wr.includes("pages_build_output_dir"));
  cek("compatibility_date setelah 2025-04-01", /compatibility_date = "20(2[5-9]|[3-9]\d)/.test(wr));

  // Hanya baris yang benar-benar memberi nilai yang dihitung; komentar peringatan
  // memang menyebut nama-nama rahasia itu dan tidak apa-apa.
  const barisNilai = wr
    .split("\n")
    .map((b) => b.trim())
    .filter((b) => b && !b.startsWith("#"));
  cek(
    "tidak ada rahasia yang ditulis di wrangler.toml",
    !barisNilai.some((b) => /^(DATABASE_URL|.*BOT_TOKEN|ADMIN_PASSWORD|SESSION_SECRET)\s*=/.test(b)),
    barisNilai.join(" | "),
  );

  cek(".env tidak ikut ke git", readFileSync(join(here, ".gitignore"), "utf8").includes(".env"));
  cek("schema.sql untuk Neon", readFileSync(join(here, "schema.sql"), "utf8").includes("Neon"));
  cek("vercel.json sudah tidak ada", !existsSync(join(here, "vercel.json")));
  cek("folder lib lama sudah tidak ada", !existsSync(join(here, "lib")));

  const pkg = JSON.parse(readFileSync(join(here, "package.json"), "utf8"));
  cek("driver Neon terdaftar", "@neondatabase/serverless" in (pkg.dependencies || {}));
  cek("tidak ada sisa dependensi Baileys", !JSON.stringify(pkg).toLowerCase().includes("baileys"));
}

console.log("\n14. Halaman web tersaji");
{
  for (const [jalur, tanda] of [
    ["/", "Layanan Aspirasi"],
    ["/status.html", "Cek Status"],
    ["/admin.html", "Dashboard Admin"],
    ["/gaya.css", "--utama"],
  ]) {
    const r = await ambil(jalur);
    cek(`${jalur} tersaji`, r.ok && (await r.text()).includes(tanda), `status ${r.status}`);
  }

  for (const berkas of ["/logo.png", "/ikon.png"]) {
    const r = await ambil(berkas);
    const b = Buffer.from(await r.arrayBuffer());
    cek(
      `${berkas} tersaji sebagai PNG`,
      r.ok && b.subarray(1, 4).toString() === "PNG",
      `status ${r.status}`,
    );
  }

  const beranda = await (await ambil("/")).text();
  cek("logo terpasang di halaman warga", beranda.includes('src="/logo.png"'));
  cek("ikon situs terpasang", beranda.includes('href="/ikon.png"'));

  const keluar = await (await ambil("/../server.js")).text();
  cek("tidak bisa membaca berkas di luar public", !keluar.includes("ADMIN_PASSWORD"));

  cek("endpoint tak dikenal menjawab 404", (await ambil("/api/tidak-ada")).status === 404);
}

console.log("\n15. Pembatas laju (unit)");
{
  const { lolosBatas } = await import("./src/util.js");
  const kunci = `uji-${Math.random()}`;
  const hasil = [];
  for (let i = 0; i < 5; i++) hasil.push(lolosBatas(kunci, 3, 60_000));
  cek("3 permintaan pertama diizinkan", hasil.slice(0, 3).every(Boolean), JSON.stringify(hasil));
  cek("permintaan ke-4 dan ke-5 ditolak", hasil.slice(3).every((x) => x === false));

  // Jendela yang sudah lewat harus melepaskan kuota kembali.
  const kunci2 = `uji-${Math.random()}`;
  cek("permintaan pertama pada kunci lain tetap lolos", lolosBatas(kunci2, 1, 60_000) === true);
  cek("kunci berbeda dihitung terpisah", lolosBatas(kunci, 3, 60_000) === false);
  cek("jendela nol milidetik langsung melepas kuota", lolosBatas(kunci2, 1, 0) === true);
}

console.log(`\n${"=".repeat(46)}`);
console.log(`Hasil: ${lolos} lulus, ${gagal} gagal`);
console.log("=".repeat(46) + "\n");

if (gagal > 0 && catatanServer.trim()) {
  console.log("Catatan server:\n" + catatanServer);
}

selesai(gagal > 0 ? 1 : 0);
