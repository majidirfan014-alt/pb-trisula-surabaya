var CONFIG = {
  APP_NAME: 'PB TRISULA SURABAYA',
  SHORT_NAME: 'PB Trisula',
  TAGLINE: 'Pantau kehadiran, fisik, logbook, dan prestasi atlet dalam satu tempat.',
  PREFIX: 'pbts_',
  SESSION_HOURS: 168,
  DEMO_SEED: true,
  DOKUMEN_MAX_MB: 2,
  DOKUMEN_TEMPLATE: 'assets/template-surat-kebenaran-usia.pdf',
  GALERI_FOLDER: 'assets/galeri',
  LANDING_KATEGORI: ['Pelatih', 'Atlet', 'Latihan', 'Pertandingan'],
  LANDING_DEFAULT: {
    merek: {
      nama: 'PB TRISULA SURABAYA',
      sub: 'Monitoring Atlet',
      logo: 'assets/logo-pb-trisula.png'
    },
    kontak: {
      phone: '0812-3456-7890',
      phoneLink: '+6281234567890',
      email: 'pbtrisulasurabaya@gmail.com',
      alamatSingkat: 'Surabaya'
    },
    sosmed: [
      { nama: 'Instagram', ikon: 'instagram', url: 'https://instagram.com/pbtrisulasurabaya' },
      { nama: 'Facebook', ikon: 'facebook', url: 'https://facebook.com/pbtrisulasurabaya' },
      { nama: 'YouTube', ikon: 'youtube', url: 'https://youtube.com/@pbtrisulasurabaya' },
      { nama: 'WhatsApp', ikon: 'whatsapp', url: 'https://wa.me/6281234567890' }
    ],
    hero: {
      badge: 'Klub Bulutangkis · Surabaya',
      judul1: 'PB TRISULA',
      judul2: 'SURABAYA',
      subjudul: 'Badminton School',
      deskripsi: 'Pantau kehadiran, kondisi fisik, logbook latihan, dan hasil pertandingan setiap atlet dalam satu tempat, sederhana, cepat, dan bisa dibuka dari HP.',
      tombolUtama: 'Daftar Sekarang',
      tombolKedua: 'Masuk',
      tombolNavbar: 'Daftar'
    },
    kolase: [
      { file: 'assets/galeri/utama.jpg', caption: 'Keluarga Besar PB Trisula Surabaya', alt: 'Foto bersama pelatih dan atlet PB Trisula Surabaya' },
      { file: 'assets/galeri/pelatih-1.jpg', caption: 'Tim Pelatih', alt: 'Pelatih PB Trisula Surabaya' },
      { file: 'assets/galeri/atlet-1.jpg', caption: 'Latihan Rutin', alt: 'Atlet PB Trisula Surabaya berlatih' },
      { file: 'assets/galeri/atlet-2.jpg', caption: 'Kebersamaan Tim', alt: 'Kebersamaan atlet PB Trisula Surabaya' }
    ],
    marquee: [
      'Monitoring Atlet', 'Kehadiran', 'Tes Fisik', 'Logbook Latihan',
      'Hasil Pertandingan', 'Perkembangan Atlet', 'Badminton School'
    ],
    galeri: [
      { id: 'g1', src: 'assets/galeri/utama.jpg', kategori: 'Pelatih', judul: 'Keluarga Besar PB Trisula Surabaya', keterangan: 'Kebersamaan pelatih dan atlet', utama: true },
      { id: 'g2', src: 'assets/galeri/pelatih-1.jpg', kategori: 'Pelatih', judul: 'Pelatih: Coach Ahmad Fauzi', keterangan: 'Pelatih Kepala' },
      { id: 'g3', src: 'assets/galeri/pelatih-2.jpg', kategori: 'Pelatih', judul: 'Pelatih: Coach Raka Wijaya', keterangan: 'Asisten Pelatih' },
      { id: 'g4', src: 'assets/galeri/atlet-1.jpg', kategori: 'Atlet', judul: 'Atlet: Budi Santoso', keterangan: 'Atlet Club' },
      { id: 'g5', src: 'assets/galeri/atlet-2.jpg', kategori: 'Atlet', judul: 'Atlet: Siti Rahma', keterangan: 'Atlet Club' },
      { id: 'g6', src: 'assets/galeri/atlet-3.jpg', kategori: 'Atlet', judul: 'Atlet: Andi Pratama', keterangan: 'Atlet Club' },
      { id: 'g7', src: 'assets/galeri/atlet-4.jpg', kategori: 'Atlet', judul: 'Atlet: Dinda Lestari', keterangan: 'Atlet Club' },
      { id: 'g8', src: 'assets/galeri/atlet-5.jpg', kategori: 'Atlet', judul: 'Tim Atlet PB Trisula', keterangan: 'Latihan Bersama' }
    ],
    tentang: {
      judul: 'Tentang PB Trisula Surabaya',
      teks1: 'PB Trisula Surabaya adalah klub bulutangkis yang membina atlet usia sekolah hingga junior. Kami percaya pembinaan yang baik lahir dari data yang rapi: siapa yang hadir, bagaimana kondisi fisiknya, apa yang dilatih hari ini, dan bagaimana hasil pertandingannya.',
      teks2: 'Website ini dibuat agar pelatih kepala, asisten pelatih, dan atlet memiliki satu sumber data yang sama — tanpa catatan manual yang tercecer.',
      judulKartu: 'Cara kerjanya',
      langkah1: '1. Daftar|Calon atlet mengisi formulir, ID atlet (TRS001, dst.) langsung diberikan.',
      langkah2: '2. Latihan|Asisten pelatih mengabsen dan mengisi logbook latihan harian.',
      langkah3: '3. Pantau|Pelatih kepala memantau kondisi atlet, atlet melihat perkembangannya sendiri.',
      jam: 'Selasa & Jumat, 16.00 - 18.00 WIB',
      lokasi: 'GOR Surabaya, Jl. Kertajaya Indah No. 12, Surabaya',
      tombol: 'Daftar sebagai Atlet'
    },
    footer: {
      teks: 'Monitoring atlet: kehadiran, tes fisik, logbook latihan, dan hasil pertandingan dalam satu aplikasi sederhana.',
      hakCipta: '© 2026 PB Trisula Surabaya. Data disimpan di perangkat Anda untuk versi lokal ini.'
    }
  },
  STATUS_KEHADIRAN: ['Hadir', 'Izin', 'Sakit', 'Tidak Hadir'],
  GENDER: ['Laki-laki', 'Perempuan'],
  ROLE_LABEL: {
    pelatih_kepala: 'Pelatih Kepala',
    asisten: 'Asisten Pelatih',
    atlet: 'Atlet'
  },
  BMI_CATEGORIES: [
    { max: 18.5, label: 'Kurus', tone: 'warn' },
    { max: 25, label: 'Normal', tone: 'ok' },
    { max: 30, label: 'Berlebih', tone: 'warn' },
    { max: 999, label: 'Obesitas', tone: 'danger' }
  ],
  TEST_TYPES: [
    { id: 'tt1', nama: 'Sprint 20m', satuan: 'detik', lebih_baik: 'rendah' },
    { id: 'tt2', nama: 'Shuttle Run', satuan: 'detik', lebih_baik: 'rendah' },
    { id: 'tt3', nama: 'Vertical Jump', satuan: 'cm', lebih_baik: 'tinggi' },
    { id: 'tt4', nama: 'Sit-up 1 Menit', satuan: 'kali', lebih_baik: 'tinggi' },
    { id: 'tt5', nama: 'Push-up', satuan: 'kali', lebih_baik: 'tinggi' },
    { id: 'tt6', nama: 'Bleep Test / VO2max', satuan: 'ml/kg/min', lebih_baik: 'tinggi' }
  ],
  LOG_PARAMETERS: [
    { id: 'lp1', nama: 'Kecepatan', kategori: 'fisik', satuan: 'skala 1-10', skala_min: 1, skala_max: 10, aktif: true },
    { id: 'lp2', nama: 'Kekuatan', kategori: 'fisik', satuan: 'skala 1-10', skala_min: 1, skala_max: 10, aktif: true },
    { id: 'lp3', nama: 'Daya Tahan', kategori: 'fisik', satuan: 'skala 1-10', skala_min: 1, skala_max: 10, aktif: true },
    { id: 'lp4', nama: 'Fleksibilitas', kategori: 'fisik', satuan: 'skala 1-10', skala_min: 1, skala_max: 10, aktif: true },
    { id: 'lp5', nama: 'Footwork', kategori: 'teknik', satuan: 'skala 1-10', skala_min: 1, skala_max: 10, aktif: true },
    { id: 'lp6', nama: 'Forehand', kategori: 'teknik', satuan: 'skala 1-10', skala_min: 1, skala_max: 10, aktif: true },
    { id: 'lp7', nama: 'Backhand', kategori: 'teknik', satuan: 'skala 1-10', skala_min: 1, skala_max: 10, aktif: true },
    { id: 'lp8', nama: 'Serve', kategori: 'teknik', satuan: 'skala 1-10', skala_min: 1, skala_max: 10, aktif: true },
    { id: 'lp9', nama: 'Dropshot', kategori: 'teknik', satuan: 'skala 1-10', skala_min: 1, skala_max: 10, aktif: true },
    { id: 'lp10', nama: 'Smash', kategori: 'teknik', satuan: 'skala 1-10', skala_min: 1, skala_max: 10, aktif: true },
    { id: 'lp11', nama: 'Netting', kategori: 'teknik', satuan: 'skala 1-10', skala_min: 1, skala_max: 10, aktif: true }
  ]
};
