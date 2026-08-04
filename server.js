// Server untuk mencoba di komputer sendiri.
//
// Di Cloudflare berkas ini TIDAK dipakai; Cloudflare memanggil functions/api/*
// langsung. Tugas server.js hanya menjembatani Node ke handler yang sama di
// src/rute.js, supaya yang kamu uji di komputer benar-benar kode yang nanti
// berjalan di produksi.
//
// Jalankan: node server.js   lalu buka http://localhost:3000

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, normalize, extname } from "node:path";
import { RUTE } from "./src/rute.js";
import { driverDari } from "./src/db.js";

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);

// Memuat .env sederhana kalau ada, tanpa library tambahan.
try {
  const isi = await readFile(join(here, ".env"), "utf8");
  let jumlah = 0;
  for (const baris of isi.split("\n")) {
    const cocok = baris.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!cocok) continue;
    const nilai = cocok[2].replace(/^["']|["']$/g, "");
    if (!(cocok[1] in process.env)) {
      process.env[cocok[1]] = nilai;
      jumlah += 1;
    }
  }
  console.log(`Memuat .env (${jumlah} variable)`);
} catch {
  console.log("Tidak ada .env, memakai nilai bawaan.");
}

const TIPE = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
};

// Node IncomingMessage -> Request standar web.
async function keRequest(req) {
  const asal = `http://${req.headers.host || `localhost:${PORT}`}`;
  const punyaBody = !["GET", "HEAD"].includes(req.method);

  let body;
  if (punyaBody) {
    const potongan = [];
    for await (const bagian of req) potongan.push(bagian);
    body = Buffer.concat(potongan);
  }

  return new Request(new URL(req.url, asal), {
    method: req.method,
    headers: req.headers,
    ...(punyaBody && body?.length ? { body } : {}),
  });
}

// Response standar web -> Node ServerResponse.
async function tulisResponse(res, hasil) {
  res.statusCode = hasil.status;
  for (const [k, v] of hasil.headers) res.setHeader(k, v);
  const isi = Buffer.from(await hasil.arrayBuffer());
  res.end(isi);
}

async function sajikanBerkas(res, jalurUrl) {
  let relatif = decodeURIComponent(jalurUrl.split("?")[0]);
  if (relatif === "/" || relatif === "") relatif = "/index.html";
  // Cegah keluar dari folder public.
  const aman = normalize(relatif).replace(/^(\.\.[/\\])+/, "");
  const berkas = join(here, "public", aman);

  try {
    const info = await stat(berkas);
    if (!info.isFile()) throw new Error("bukan berkas");
    const isi = await readFile(berkas);
    res.statusCode = 200;
    res.setHeader("Content-Type", TIPE[extname(berkas)] || "application/octet-stream");
    res.end(isi);
  } catch {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end("<h1>404</h1><p>Halaman tidak ditemukan.</p>");
  }
}

createServer(async (req, res) => {
  const jalur = (req.url || "/").split("?")[0];
  const handler = RUTE[jalur];

  if (handler) {
    try {
      const hasil = await handler(await keRequest(req), process.env);
      await tulisResponse(res, hasil);
    } catch (e) {
      console.error(`[${jalur}]`, e);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ ok: false, pesan: "Terjadi kesalahan di server." }));
      }
    }
    return;
  }

  if (jalur.startsWith("/api/")) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, pesan: "Endpoint tidak ditemukan." }));
    return;
  }

  await sajikanBerkas(res, req.url || "/");
}).listen(PORT, () => {
  const penyimpanan = driverDari(process.env);
  console.log(`\nLayanan Aspirasi berjalan di http://localhost:${PORT}`);
  console.log(`  Form warga    : http://localhost:${PORT}/`);
  console.log(`  Cek status    : http://localhost:${PORT}/status.html`);
  console.log(`  Dashboard     : http://localhost:${PORT}/admin.html`);
  console.log(`  Kesehatan     : http://localhost:${PORT}/api/sehat`);
  console.log(`  Penyimpanan   : ${penyimpanan}`);
  if (penyimpanan === "memori") {
    console.log("\n  Perhatian: data disimpan di memori dan HILANG saat server dimatikan.");
    console.log("  Isi DATABASE_URL di .env untuk memakai Neon.");
  }
  console.log("");
});
