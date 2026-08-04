// Autentikasi admin: satu kata sandi, token sesi bertanda tangan HMAC.
//
// Memakai Web Crypto (crypto.subtle), bukan node:crypto, supaya tidak
// bergantung pada nodejs_compat dan berjalan identik di Node maupun Workers.
//
// Kata sandi tidak pernah dikirim ulang setelah login. Token berisi waktu
// kedaluwarsa plus tanda tangan, jadi tidak bisa dipalsukan tanpa SESSION_SECRET.

import { nilai } from "./env.js";
import { json } from "./util.js";

const enc = new TextEncoder();

export function authSiap(env) {
  return Boolean(nilai(env, "ADMIN_PASSWORD") && nilai(env, "SESSION_SECRET"));
}

// Perbandingan yang tidak membocorkan panjang atau posisi karakter yang cocok.
function samaAman(a, b) {
  const ba = enc.encode(String(a));
  const bb = enc.encode(String(b));
  let beda = ba.length ^ bb.length;
  const n = Math.max(ba.length, bb.length);
  for (let i = 0; i < n; i++) {
    beda |= (ba[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return beda === 0;
}

export function sandiBenar(env, masukan) {
  const sandi = nilai(env, "ADMIN_PASSWORD");
  if (!sandi) return false;
  return samaAman(masukan ?? "", sandi);
}

async function tandaTangan(rahasia, isi) {
  const kunci = await crypto.subtle.importKey(
    "raw",
    enc.encode(rahasia),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", kunci, enc.encode(isi));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function buatToken(env) {
  const rahasia = nilai(env, "SESSION_SECRET");
  const umurJam = Number(nilai(env, "SESI_UMUR_JAM", "12")) || 12;
  const isi = String(Date.now() + umurJam * 3600 * 1000);
  return `${isi}.${await tandaTangan(rahasia, isi)}`;
}

export async function tokenSah(env, token) {
  const rahasia = nilai(env, "SESSION_SECRET");
  if (!token || !rahasia) return false;
  const [isi, tanda] = String(token).split(".");
  if (!isi || !tanda) return false;
  if (!/^\d+$/.test(isi)) return false;
  const benar = await tandaTangan(rahasia, isi);
  if (!samaAman(tanda, benar)) return false;
  return Number(isi) > Date.now();
}

// Dipakai di setiap endpoint admin.
// Mengembalikan null bila boleh lanjut, atau Response 401 bila ditolak.
export async function tolakBukanAdmin(request, env) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (await tokenSah(env, token)) return null;
  return json(401, { ok: false, pesan: "Sesi tidak sah atau sudah berakhir." });
}
