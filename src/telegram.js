// Notifikasi ke admin lewat Telegram Bot API.
//
// Telegram Bot API resmi dan gratis. Botnya tidak bisa memblokir nomor siapa
// pun karena berjalan atas nama akun bot, bukan nomor pribadi.
//
// Environment variable:
//   TELEGRAM_BOT_TOKEN  -> dari @BotFather
//   TELEGRAM_CHAT_ID    -> id chat atau grup admin, boleh beberapa dipisah koma

import { escHtml, waktuIndo } from "./util.js";
import { config, labelField } from "./config.js";
import { nilai } from "./env.js";

function tujuan(env) {
  return nilai(env, "TELEGRAM_CHAT_ID")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function telegramAktif(env) {
  return Boolean(nilai(env, "TELEGRAM_BOT_TOKEN") && tujuan(env).length);
}

async function kirim(env, chatId, teks, tombol) {
  const token = nilai(env, "TELEGRAM_BOT_TOKEN");
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: teks,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      ...(tombol ? { reply_markup: { inline_keyboard: [[tombol]] } } : {}),
    }),
  });
  const hasil = await res.json().catch(() => ({}));
  if (!hasil.ok) throw new Error(hasil.description || `HTTP ${res.status}`);
  return hasil;
}

// Menyusun teks notifikasi. Dipisah dari pengiriman supaya bisa diuji sendiri.
//
// Kalau config.notifikasiRingkas bernilai true, isi aspirasi dan identitas
// pelapor TIDAK ikut dikirim. Alasannya: chat bot Telegram tidak pernah
// terenkripsi ujung-ke-ujung, jadi apa pun yang dikirim ke sini tersimpan di
// server Telegram dalam bentuk yang bisa mereka baca.
export function susunNotifikasi(baris, urlDashboard, cfg, env) {
  const c = cfg || config();
  const garis = "-".repeat(28);

  if (c.notifikasiRingkas) {
    return [
      `<b>ASPIRASI BARU</b>  #${escHtml(baris.kode)}`,
      garis,
      `<b>Kategori:</b> ${escHtml(baris.kategori)}`,
      `<b>Waktu:</b> ${escHtml(waktuIndo(baris.waktu, env))}`,
      garis,
      "Isi aspirasi sengaja tidak dikirim lewat Telegram.",
      urlDashboard ? `Buka dashboard untuk membacanya:\n${urlDashboard}` : null,
      `<i>${escHtml(c.footer)}</i>`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  const isian = Object.entries(baris.data || {})
    .filter(([, v]) => v !== "" && v != null)
    .map(([k, v]) => `<b>${escHtml(labelField(k))}:</b> ${escHtml(v)}`)
    .join("\n");

  return [
    `<b>ASPIRASI BARU</b>  #${escHtml(baris.kode)}`,
    garis,
    `<b>Kategori:</b> ${escHtml(baris.kategori)}`,
    `<b>Waktu:</b> ${escHtml(waktuIndo(baris.waktu, env))}`,
    `<b>Nama:</b> ${escHtml(baris.nama)}`,
    baris.status_pelapor ? `<b>Status:</b> ${escHtml(baris.status_pelapor)}` : null,
    baris.kontak ? `<b>Kontak:</b> ${escHtml(baris.kontak)}` : null,
    garis,
    isian,
    garis,
    urlDashboard ? `Buka dashboard untuk membalas:\n${urlDashboard}` : null,
    `<i>${escHtml(c.footer)}</i>`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function beritahuAdmin(env, baris, urlDashboard) {
  if (!telegramAktif(env)) {
    console.warn("[telegram] Belum dikonfigurasi, notifikasi dilewati.");
    return { terkirim: 0, dilewati: true };
  }

  const teks = susunNotifikasi(baris, urlDashboard, null, env);
  const tombol = urlDashboard ? { text: "Buka dashboard", url: urlDashboard } : null;

  let terkirim = 0;
  const gagal = [];
  for (const chatId of tujuan(env)) {
    try {
      await kirim(env, chatId, teks, tombol);
      terkirim += 1;
    } catch (e) {
      // Notifikasi gagal tidak boleh membatalkan aspirasi yang sudah tersimpan.
      // Penyebab paling umum: admin belum pernah menekan Start di chat bot.
      gagal.push(`${chatId}: ${e.message}`);
      console.error(`[telegram] gagal kirim ke ${chatId}: ${e.message}`);
    }
  }
  return { terkirim, gagal, dilewati: false };
}
