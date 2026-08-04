// KONFIGURASI LAYANAN ASPIRASI
//
// Ini satu-satunya berkas yang perlu kamu ubah untuk menyesuaikan layanan.
// Form di browser dibangun otomatis dari sini, jadi HTML tidak perlu disentuh.
//
// Berkas ini .js dan bukan .json karena dua alasan:
//   1. Cloudflare Workers tidak punya sistem berkas, jadi konfigurasi harus
//      diimpor saat build, bukan dibaca dari disk. Modul .js paling aman untuk
//      itu di semua alat bundling.
//   2. Bisa diberi komentar seperti yang kamu baca sekarang.
//
// Cara mengeditnya sama saja: ubah nilai di dalam tanda kutip, jaga tanda koma.
// Setelah mengubah, jalankan `node uji.js` lalu push ke GitHub untuk deploy.

export default {
  namaSekolah: "SMP Negeri 30 Semarang",
  namaLayanan: "Mas Galuh",
  deskripsiSingkat: "Media aspirasi warga sekolah dan masyarakat umum",
  footer: "Dikirim otomatis oleh Layanan Aspirasi Mas Galuh",

  // {KATEGORI} otomatis diganti dengan jenis aspirasi yang dipilih warga.
  pesanKonfirmasi:
    "Terima kasih. {KATEGORI} Anda telah kami terima dan akan diteruskan " +
    "kepada pihak sekolah. Simpan nomor tiket di bawah ini untuk memantau " +
    "tindak lanjutnya.",

  // Kalau true, isi aspirasi TIDAK ikut dikirim ke Telegram — admin hanya
  // menerima nomor tiket dan tautan dashboard.
  //
  // Chat bot Telegram tidak terenkripsi ujung-ke-ujung, jadi apa pun yang
  // dikirim ke sana tersimpan di server Telegram dalam bentuk yang bisa mereka
  // baca. Pilih true bila aspirasi bisa memuat hal sensitif seperti dugaan
  // perundungan, nama anak, atau tuduhan terhadap guru.
  //
  // Konsekuensinya: admin harus membuka dashboard untuk membaca setiap aspirasi.
  notifikasiRingkas: false,

  // ---------------------------------------------------------------------------
  // Pertanyaan yang muncul di SEMUA kategori.
  //
  // tipe yang tersedia: "text", "teks_panjang", "pilihan"
  // tampilJika: field hanya muncul kalau jawaban field lain cocok.
  // ---------------------------------------------------------------------------
  fieldUmum: [
    {
      nama: "nama",
      label: "Nama lengkap",
      tipe: "text",
      wajib: true,
      placeholder: "Nama Anda",
    },
    {
      nama: "status_pelapor",
      label: "Status",
      tipe: "pilihan",
      wajib: true,
      opsi: ["Wali murid", "Siswa", "Guru / Staf", "Masyarakat umum"],
    },
    {
      nama: "anak_kelas",
      label: "Nama anak & kelas",
      tipe: "text",
      wajib: false,
      tampilJika: { field: "status_pelapor", nilai: ["Wali murid"] },
      placeholder: "Contoh: Andi Saputra - 8B",
    },
    {
      nama: "alamat",
      label: "Alamat / RT-RW",
      tipe: "text",
      wajib: false,
      tampilJika: { field: "status_pelapor", nilai: ["Masyarakat umum"] },
      placeholder: "Contoh: Jl. Melati RT 03 / RW 05",
    },
    {
      nama: "kontak",
      label: "Nomor WhatsApp atau email (opsional)",
      tipe: "text",
      wajib: false,
      bantuan: "Hanya dipakai bila pihak sekolah perlu menghubungi Anda. Boleh dikosongkan.",
      placeholder: "08xxxxxxxxxx",
    },
  ],

  // ---------------------------------------------------------------------------
  // Kategori aspirasi. Menambah kategori: salin satu blok, ganti id-nya.
  // id harus unik dan tidak boleh diubah setelah ada aspirasi masuk.
  // ---------------------------------------------------------------------------
  layanan: [
    {
      id: "1",
      nama: "Pengaduan",
      ikon: "!",
      deskripsi: "Melaporkan masalah, keluhan, atau kejadian yang perlu ditindaklanjuti sekolah.",
      fields: [
        {
          nama: "pengaduan",
          label: "Isi pengaduan",
          tipe: "teks_panjang",
          wajib: true,
          placeholder: "Jelaskan kejadiannya: apa, kapan, di mana, siapa yang terlibat.",
        },
        {
          nama: "harapan",
          label: "Harapan penyelesaian",
          tipe: "teks_panjang",
          wajib: false,
          placeholder: "Menurut Anda, tindak lanjut seperti apa yang diharapkan?",
        },
      ],
    },
    {
      id: "2",
      nama: "Saran / Masukan",
      ikon: "+",
      deskripsi: "Usulan perbaikan untuk kegiatan, fasilitas, atau pelayanan sekolah.",
      fields: [
        {
          nama: "saran",
          label: "Saran / masukan",
          tipe: "teks_panjang",
          wajib: true,
          placeholder: "Tuliskan saran Anda selengkap mungkin.",
        },
      ],
    },
    {
      id: "3",
      nama: "Apresiasi",
      ikon: "*",
      deskripsi: "Menyampaikan penghargaan kepada guru, staf, kegiatan, atau fasilitas.",
      fields: [
        {
          nama: "apresiasi_untuk",
          label: "Apresiasi ditujukan untuk",
          tipe: "text",
          wajib: true,
          placeholder: "Nama guru / kegiatan / fasilitas / pelayanan",
        },
        {
          nama: "pesan",
          label: "Pesan apresiasi",
          tipe: "teks_panjang",
          wajib: true,
          placeholder: "Tuliskan apresiasi Anda.",
        },
      ],
    },
    {
      id: "4",
      nama: "Pertanyaan / Informasi",
      ikon: "?",
      deskripsi: "Menanyakan informasi seputar kegiatan, administrasi, atau kebijakan sekolah.",
      fields: [
        {
          nama: "pertanyaan",
          label: "Pertanyaan Anda",
          tipe: "teks_panjang",
          wajib: true,
          placeholder: "Tuliskan pertanyaan Anda.",
        },
      ],
    },
  ],
};
