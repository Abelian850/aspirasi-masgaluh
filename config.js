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
  // "Mas Galuh" adalah akronim: Media Aspirasi SMP tiGA puLUH.
  // Kepanjangannya disebut di sini supaya warga tahu ini nama layanan, bukan
  // nama orang.
  deskripsiSingkat:
    "Media Aspirasi SMP Tiga Puluh — wadah aspirasi warga sekolah dan masyarakat umum",
  footer: "Dikirim otomatis oleh Layanan Aspirasi Mas Galuh",

  // Ditampilkan di halaman awal, sebelum warga memilih jalur pelaporan.
  // Isinya aturan main, bukan hiasan — kosongkan hanya kalau memang tidak
  // ingin ada imbauan sama sekali.
  catatanEtika:
    "Sampaikan dengan santun dan lengkapi identitas pelapor.",

  // ---------------------------------------------------------------------------
  // Gerbang pilihan saluran: warga memilih melapor lewat WhatsApp atau lewat
  // web ini. Kalau aktif: false, gerbang tidak ditampilkan dan halaman langsung
  // membuka pilihan kategori seperti sebelumnya.
  //
  // tautan harus tautan wa.me / api.whatsapp.com yang sudah berisi nomor
  // tujuan. Nomor ditulis dengan kode negara tanpa tanda plus (62..., bukan
  // 08...).
  //
  // catatan muncul di bawah kedua pilihan. Ini yang memberi tahu warga bahwa
  // web tetap bisa dipakai bila WhatsApp tidak dibalas atau sedang mati, jadi
  // jangan dihapus tanpa mengganti dengan kalimat yang sepadan.
  // ---------------------------------------------------------------------------
  whatsapp: {
    aktif: true,
    tautan:
      "https://api.whatsapp.com/send/?phone=6281319426151&text&type=phone_number&app_absent=0",
    nomorTampil: "0813-1942-6151",
    // Jangan menulis "chat langsung dengan admin" di sini. Yang menjawab
    // pertama kali adalah bot; admin membaca dan menindaklanjuti setelahnya.
    // Warga yang mengira sedang bicara dengan manusia akan menunggu balasan
    // yang tidak kunjung datang, lalu menyimpulkan aspirasinya diabaikan.
    deskripsi:
      "Dibalas otomatis oleh bot terlebih dahulu, lalu ditindaklanjuti " +
      "admin sekolah. Cocok bila Anda ingin bertanya dulu atau lebih " +
      "nyaman memakai WhatsApp.",
    catatan:
      "Bila WhatsApp tidak dapat dihubungi, bot tidak menjawab, atau " +
      "balasan admin belum juga datang, aspirasi Anda tetap dapat dikirim " +
      "lewat formulir web di halaman ini. Laporan lewat web selalu masuk " +
      "dan diberi nomor tiket yang bisa Anda pantau sendiri.",
  },

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
