// Validasi kiriman form di sisi server.
// Validasi di browser hanya untuk kenyamanan; yang menentukan adalah yang di sini.

import { config, cariLayanan } from "./config.js";
import { bersihkan } from "./util.js";

const PANJANG_MAKS = {
  text: 200,
  pilihan: 100,
  teks_panjang: 4000,
};

// Cek apakah sebuah field perlu ditampilkan berdasarkan jawaban field lain.
function fieldBerlaku(field, jawaban) {
  if (!field.tampilJika) return true;
  return (field.tampilJika.nilai || []).includes(jawaban[field.tampilJika.field]);
}

export function validasiKiriman(masukan) {
  const layanan = cariLayanan(masukan?.layanan);
  if (!layanan) {
    return { galat: ["Kategori layanan tidak dikenali."], hasil: null };
  }

  const galat = [];
  const c = config();
  const mentah =
    masukan.jawaban && typeof masukan.jawaban === "object" && !Array.isArray(masukan.jawaban)
      ? masukan.jawaban
      : {};
  const semuaField = [...(c.fieldUmum || []), ...(layanan.fields || [])];

  // Bersihkan dulu semua nilai supaya aturan tampilJika membaca data yang sudah rapi.
  const jawaban = {};
  for (const field of semuaField) {
    jawaban[field.nama] = bersihkan(mentah[field.nama], PANJANG_MAKS[field.tipe] ?? 200);
  }

  for (const field of semuaField) {
    if (!fieldBerlaku(field, jawaban)) {
      delete jawaban[field.nama];
      continue;
    }
    const nilai = jawaban[field.nama];
    if (field.wajib && !nilai) {
      galat.push(`${field.label} wajib diisi.`);
      continue;
    }
    if (field.tipe === "pilihan" && nilai && !(field.opsi || []).includes(nilai)) {
      galat.push(`${field.label} berisi pilihan yang tidak sah.`);
    }
    if (!nilai) delete jawaban[field.nama];
  }

  if (galat.length) return { galat, hasil: null };

  const data = { ...jawaban };
  delete data.nama;
  delete data.status_pelapor;
  delete data.kontak;

  const ringkasan = (layanan.fields || [])
    .map((f) => jawaban[f.nama])
    .filter(Boolean)
    .join(" | ");

  return {
    galat: [],
    hasil: {
      kategori: layanan.nama,
      nama: jawaban.nama,
      status_pelapor: jawaban.status_pelapor || null,
      kontak: jawaban.kontak || null,
      data,
      ringkasan: ringkasan || "(tanpa isi)",
    },
  };
}
