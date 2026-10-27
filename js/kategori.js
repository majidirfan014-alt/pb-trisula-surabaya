/* ======================================================================
   MatchKategori - kategori usia pertandingan + kategori tambahan yang
   ditulis sendiri ("Lainnya"). Disimpan lokal di koleksi pbts_match_kategori
   agar kategori custom tersedia ulang untuk input berikutnya dan bisa
   dikelola Superadmin (ubah nama / nonaktifkan) lewat "Kelola Kategori".

   Data lama pada field `kategori` pertandingan (mis. Tunggal/Ganda,
   Tournament, dst.) tidak disentuh — tetap tampil apa adanya.
   ====================================================================== */
var MatchKategori = (function () {
  var KOLEKSI = 'match_kategori';
  var BAWAAN = ['Pra Usia Dini', 'Usia Dini', 'Anak', 'Pemula', 'Remaja', 'Taruna', 'Dewasa'];
  var NILAI_LAINNYA = '__lainnya';

  function init() {
    try {
      if (localStorage.getItem(CONFIG.PREFIX + KOLEKSI) === null) {
        BAWAAN.forEach(function (nama, i) {
          Store.insert(KOLEKSI, {
            id: 'mk_default_' + (i + 1),
            nama: nama,
            bawaan: true,
            aktif: true
          });
        });
      }
    } catch (e) {}
  }

  function semua() {
    return Utils.sortBy(Store.all(KOLEKSI), 'nama', 'asc');
  }

  function aktif() {
    return semua().filter(function (k) { return k.aktif !== false; });
  }

  function byId(id) {
    return Store.find(KOLEKSI, id);
  }

  function byNama(nama) {
    var n = String(nama || '').trim().toLowerCase();
    if (!n) return null;
    return Store.findOne(KOLEKSI, function (k) {
      return String(k.nama || '').trim().toLowerCase() === n;
    });
  }

  // Tambah kategori baru (dari pilihan "Lainnya"). Bila nama sudah ada
  // tapi nonaktif, aktifkan kembali tanpa menduplikasi.
  function tambah(nama) {
    var n = String(nama || '').trim();
    if (!n) return null;
    var ada = byNama(n);
    if (ada) {
      if (ada.aktif === false) Store.update(KOLEKSI, ada.id, { aktif: true });
      return ada;
    }
    return Store.insert(KOLEKSI, {
      id: 'mk_' + Date.now().toString(36) + Math.floor(Math.random() * 1000),
      nama: n,
      bawaan: false,
      aktif: true
    });
  }

  function ubahNama(id, nama) {
    var n = String(nama || '').trim();
    if (!n) return null;
    return Store.update(KOLEKSI, id, { nama: n });
  }

  function toggle(id) {
    var k = byId(id);
    if (!k) return null;
    return Store.update(KOLEKSI, id, { aktif: k.aktif === false });
  }

  // Opsi dropdown: nilai lama yang tidak dikenal tetap disertakan (sebagai
  // opsi "data lama") agar data lama tidak berubah saat form diedit.
  function opsiDropdown(nilaiLama) {
    var out = [{ value: '', label: '-- Pilih kategori --' }];
    aktif().forEach(function (k) {
      out.push({ value: k.nama, label: k.nama });
    });
    var v = String(nilaiLama || '');
    if (v && !aktif().some(function (k) { return k.nama === v; })) {
      out.push({ value: v, label: v + ' (data lama)' });
    }
    out.push({ value: NILAI_LAINNYA, label: 'Lainnya (isi sendiri)' });
    return out;
  }

  // Opsi filter daftar pertandingan: semua nilai yang dipakai data + koleksi.
  function opsiFilter() {
    var dipakai = {};
    Store.all('matches').forEach(function (m) {
      if (m.kategori) dipakai[String(m.kategori)] = true;
    });
    semua().forEach(function (k) { dipakai[k.nama] = true; });
    return Object.keys(dipakai).sort();
  }

  // Ambil nilai kategori dari isian form (termasuk teks "Lainnya") dan
  // daftarkan otomatis bila belum ada.
  function nilaiDariForm(data) {
    if (data.kategori === NILAI_LAINNYA) {
      var teks = String(data.kategori_lain || '').trim();
      if (teks) tambah(teks);
      return teks;
    }
    return data.kategori || '';
  }

  return {
    NILAI_LAINNYA: NILAI_LAINNYA,
    init: init,
    semua: semua,
    aktif: aktif,
    byId: byId,
    byNama: byNama,
    tambah: tambah,
    ubahNama: ubahNama,
    toggle: toggle,
    opsiDropdown: opsiDropdown,
    opsiFilter: opsiFilter,
    nilaiDariForm: nilaiDariForm
  };
})();
