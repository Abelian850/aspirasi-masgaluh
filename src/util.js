// Fungsi bantu. Semuanya memakai API web standar (Request, Response, URL),
// jadi berjalan sama di Cloudflare Workers dan Node 18+.

import { nilai } from "./env.js";

export function waktuIndo(iso, env) {
  const d = iso ? new Date(iso) : new Date();
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: nilai(env, "ZONA_WAKTU", "Asia/Jakarta"),
  }).format(d);
}

// Membuang karakter kontrol yang tak terlihat dan memangkas panjang berlebih.
export function bersihkan(teks, maks = 4000) {
  if (typeof teks !== "string") return "";
  let hasil = "";
  for (const ch of teks) {
    const kode = ch.codePointAt(0);
    // Sisakan tab (9), newline (10), dan carriage return (13).
    if (kode < 32 && kode !== 9 && kode !== 10 && kode !== 13) continue;
    if (kode === 127) continue;
    hasil += ch;
  }
  return hasil.trim().slice(0, maks);
}

export function escHtml(teks) {
  return String(teks ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function bacaBody(request) {
  const tipe = request.headers.get("content-type") || "";
  if (!tipe.includes("application/json")) {
    throw new Error("Body harus berformat JSON.");
  }
  const teks = await request.text();
  if (teks.length > 256 * 1024) throw new Error("Body terlalu besar.");
  if (!teks) return {};
  try {
    const hasil = JSON.parse(teks);
    if (hasil === null || typeof hasil !== "object" || Array.isArray(hasil)) {
      throw new Error("bukan objek");
    }
    return hasil;
  } catch {
    throw new Error("Body bukan JSON yang sah.");
  }
}

// Pembatas laju sederhana berbasis memori.
//
// Batasan yang perlu disadari: setiap instance Worker punya memorinya sendiri
// dan bisa dibuang kapan saja, jadi angka ini bersifat perkiraan, bukan jaminan.
// Cukup untuk meredam iseng dan salah klik pada skala layanan sekolah.
// Kalau nanti benar-benar diserang, yang dibutuhkan adalah Cloudflare Rate
// Limiting Rules di depan situs, bukan kode ini.
const jejak = new Map();

export function lolosBatas(kunci, maks, jendelaMs) {
  const sekarang = Date.now();
  const daftar = (jejak.get(kunci) || []).filter((t) => sekarang - t < jendelaMs);
  if (daftar.length >= maks) {
    jejak.set(kunci, daftar);
    return false;
  }
  daftar.push(sekarang);
  jejak.set(kunci, daftar);
  if (jejak.size > 5000) jejak.clear();
  return true;
}

// Di Cloudflare, IP asli warga ada di CF-Connecting-IP.
export function ipPengirim(request) {
  const h = request.headers;
  return (
    h.get("cf-connecting-ip") ||
    (h.get("x-forwarded-for") || "").split(",")[0].trim() ||
    "tak-dikenal"
  );
}

export function paramUrl(request, nama) {
  return new URL(request.url).searchParams.get(nama) || "";
}
