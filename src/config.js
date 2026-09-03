// Pembaca konfigurasi.
//
// Berkas yang kamu edit adalah ../config.js di akar project. Di sini hanya
// disediakan fungsi bantu untuk membacanya.
//
// Config diimpor sebagai modul, bukan dibaca dari disk, karena Cloudflare
// Workers tidak punya sistem berkas. Konsekuensinya: setiap perubahan config
// perlu deploy ulang.

import mentah from "../config.js";

export function config() {
  return mentah;
}

// Versi yang aman dikirim ke browser. Saat ini seluruh isinya memang publik,
// tetapi fungsi ini jadi satu tempat menyaring bila nanti ada data rahasia.
export function configPublik() {
  const c = mentah;
  return {
    namaSekolah: c.namaSekolah,
    namaLayanan: c.namaLayanan,
    deskripsiSingkat: c.deskripsiSingkat,
    footer: c.footer,
    pesanKonfirmasi: c.pesanKonfirmasi,
    whatsapp: c.whatsapp || null,
    fieldUmum: c.fieldUmum,
    layanan: c.layanan,
  };
}

export function cariLayanan(id) {
  return mentah.layanan.find((l) => String(l.id) === String(id)) || null;
}

// Mengubah nama field jadi label yang enak dibaca.
export function labelField(namaField) {
  const semua = [
    ...(mentah.fieldUmum || []),
    ...mentah.layanan.flatMap((l) => l.fields || []),
  ];
  const cocok = semua.find((f) => f.nama === namaField);
  if (cocok) return cocok.label;
  return namaField.replace(/_/g, " ").replace(/^./, (m) => m.toUpperCase());
}
