/* Jadwal Latihan (sesi) + kuota atlet.
   Koleksi: pbts_jadwal_sesi — setiap sesi punya ID unik (bukan teks),
   sehingga perubahan nama/jam tidak memutus data atlet.
   Atlet menyimpan daftar id sesi pada field "jadwal_sesi" (array).
   Hanya atlet berstatus Aktif yang menempati kuota; atlet Non-Aktif/Cuti/
   Berhenti datanya tetap tersimpan tetapi tidak dihitung. */

var Jadwal = (function () {
  var KOLEKSI = 'jadwal_sesi';
  var KUNCI_SEED = 'jadwal_seeded_v1';
  var KUNCI_DEDUP = 'jadwal_dedup_v2';
  var HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  var HARI_PENDEK = {
    Senin: 'Sen', Selasa: 'Sel', Rabu: 'Rab', Kamis: 'Kam',
    Jumat: 'Jum', Sabtu: 'Sab', Minggu: 'Min'
  };
  // Urutan tampil lokasi: dua lokasi utama dulu, sisanya alfabetis.
  var URUT_LOKASI = ['Sport Center Puncak Permai', 'Kintono Badminton Hall'];

  var SEED = [
    { id: 'ses_sc_sen', lokasi_nama: 'Sport Center Puncak Permai', hari: 'Senin', jam: '16.00-18.00', lapangan: 6, pelatih: 7, kuota: 48 },
    { id: 'ses_sc_sel', lokasi_nama: 'Sport Center Puncak Permai', hari: 'Selasa', jam: '16.00-18.00', lapangan: 5, pelatih: 6, kuota: 40 },
    { id: 'ses_sc_rab', lokasi_nama: 'Sport Center Puncak Permai', hari: 'Rabu', jam: '16.00-18.00', lapangan: 7, pelatih: 8, kuota: 56 },
    { id: 'ses_sc_kam', lokasi_nama: 'Sport Center Puncak Permai', hari: 'Kamis', jam: '16.00-18.00', lapangan: 6, pelatih: 7, kuota: 48 },
    { id: 'ses_sc_jum', lokasi_nama: 'Sport Center Puncak Permai', hari: 'Jumat', jam: '16.00-18.00', lapangan: 6, pelatih: 7, kuota: 48 },
    { id: 'ses_sc_sab', lokasi_nama: 'Sport Center Puncak Permai', hari: 'Sabtu', jam: '08.00-10.00', lapangan: 4, pelatih: 5, kuota: 32 },
    { id: 'ses_sc_min', lokasi_nama: 'Sport Center Puncak Permai', hari: 'Minggu', jam: '08.00-10.00', lapangan: 4, pelatih: 5, kuota: 32 },
    { id: 'ses_kb_sen', lokasi_nama: 'Kintono Badminton Hall', hari: 'Senin', jam: '16.00-18.00', lapangan: 3, pelatih: 3, kuota: 24 },
    { id: 'ses_kb_rab', lokasi_nama: 'Kintono Badminton Hall', hari: 'Rabu', jam: '16.00-18.00', lapangan: 3, pelatih: 3, kuota: 24 }
  ];

  /* ==================== DASAR ==================== */

  function semua() {
    var rows = Store.all(KOLEKSI);
    return rows.sort(function (a, b) {
      var oa = URUT_LOKASI.indexOf(a.lokasi_nama);
      var ob = URUT_LOKASI.indexOf(b.lokasi_nama);
      if (oa === -1) oa = URUT_LOKASI.length;
      if (ob === -1) ob = URUT_LOKASI.length;
      if (a.lokasi_nama !== b.lokasi_nama) {
        if (oa !== ob) return oa - ob;
        return String(a.lokasi_nama || '') < String(b.lokasi_nama || '') ? -1 : 1;
      }
      return HARI.indexOf(a.hari) - HARI.indexOf(b.hari);
    });
  }

  function aktif() {
    return semua().filter(function (s) {
      return s.aktif !== false;
    });
  }

  function byId(id) {
    if (!id) return null;
    return Store.find(KOLEKSI, id);
  }

  function grupLokasi(daftar) {
    var grup = [];
    var peta = {};
    (daftar || semua()).forEach(function (s) {
      var nama = s.lokasi_nama || 'Tanpa Lokasi';
      if (!peta[nama]) {
        peta[nama] = { nama: nama, sesi: [] };
        grup.push(peta[nama]);
      }
      peta[nama].sesi.push(s);
    });
    return grup;
  }

  /* ==================== LABEL ==================== */

  function singkatanLokasi(nama) {
    var n = String(nama || '').trim();
    if (!n) return '-';
    if (n === 'Sport Center Puncak Permai') return 'SCPP';
    if (n === 'Kintono Badminton Hall') return 'KBH';
    var kata = n.replace(/[.,]/g, ' ').split(/\s+/).filter(Boolean);
    var out = '';
    kata.forEach(function (w) {
      if (out.length < 4) out += w.charAt(0).toUpperCase();
    });
    return out || n.slice(0, 4).toUpperCase();
  }

  function hariSingkat(hari) {
    return HARI_PENDEK[hari] || String(hari || '').slice(0, 3);
  }

  function jamMulai(jam) {
    var t = String(jam || '').split('-')[0].trim();
    return t || String(jam || '');
  }

  function labelSesi(s) {
    if (!s) return '-';
    return (s.hari || '-') + ', ' + (s.jam || '-');
  }

  function labelPendek(s) {
    if (!s) return '-';
    return singkatanLokasi(s.lokasi_nama) + ' ' + hariSingkat(s.hari) + ' ' + jamMulai(s.jam);
  }

  function labelPanjang(s) {
    if (!s) return '-';
    return (s.lokasi_nama || '-') + ' — ' + labelSesi(s);
  }

  function tooltipSesi(s) {
    if (!s) return '';
    var t = labelPanjang(s);
    t += ' · ' + terisi(s) + ' dari ' + (s.kuota || 0) + ' atlet';
    if (s.aktif === false) t += ' (nonaktif)';
    return t;
  }

  /* ==================== ATLET & KUOTA ==================== */

  function atletAktif() {
    return Store.where('athletes', function (a) {
      return (a.status || 'aktif') === 'aktif';
    });
  }

  function punyaSesi(a, idSesi) {
    return !!(a && Array.isArray(a.jadwal_sesi) && a.jadwal_sesi.indexOf(idSesi) !== -1);
  }

  // Jumlah atlet Aktif yang menempati sesi (hanya status aktif yang dihitung).
  function terisi(sesi) {
    if (!sesi) return 0;
    var id = typeof sesi === 'string' ? sesi : sesi.id;
    var n = 0;
    atletAktif().forEach(function (a) {
      if (punyaSesi(a, id)) n++;
    });
    return n;
  }

  function sisa(sesi) {
    if (!sesi) return 0;
    return Math.max(0, Number(sesi.kuota || 0) - terisi(sesi));
  }

  // Semua atlet (status apa pun) yang memegang sesi ini — data tersimpan.
  function semuaPeserta(sesi) {
    var id = typeof sesi === 'string' ? sesi : sesi.id;
    return Utils.sortBy(Store.where('athletes', function (a) {
      return punyaSesi(a, id);
    }), 'nama', 'asc');
  }

  // Peserta yang menempati kuota (status Aktif saja).
  function peserta(sesi) {
    var id = typeof sesi === 'string' ? sesi : sesi.id;
    return Utils.sortBy(Store.where('athletes', function (a) {
      return punyaSesi(a, id) && (a.status || 'aktif') === 'aktif';
    }), 'nama', 'asc');
  }

  function sesiAtlet(a) {
    var ids = (a && Array.isArray(a.jadwal_sesi)) ? a.jadwal_sesi : [];
    var out = [];
    ids.forEach(function (id) {
      var s = byId(id);
      if (s) out.push(s);
    });
    return out.sort(function (x, y) {
      var ox = URUT_LOKASI.indexOf(x.lokasi_nama);
      var oy = URUT_LOKASI.indexOf(y.lokasi_nama);
      if (ox === -1) ox = URUT_LOKASI.length;
      if (oy === -1) oy = URUT_LOKASI.length;
      if (ox !== oy) return ox - oy;
      return HARI.indexOf(x.hari) - HARI.indexOf(y.hari);
    });
  }

  function belumDijadwalkan() {
    return Utils.sortBy(Store.where('athletes', function (a) {
      return (a.status || 'aktif') === 'aktif' && !sesiAtlet(a).length;
    }), 'nama', 'asc');
  }

  function ringkasan() {
    var list = semua().filter(function (s) { return s.aktif !== false; });
    var kuota = 0;
    var isi = 0;
    list.forEach(function (s) {
      kuota += Number(s.kuota || 0);
      isi += terisi(s);
    });
    return {
      kuota: kuota,
      terisi: isi,
      sisa: Math.max(0, kuota - isi),
      belum: belumDijadwalkan().length
    };
  }

  // Sisa kuota untuk sebuah form: kursi milik atlet yang sedang diedit
  // tidak dihitung (boleh tetap memilih sesi penuh miliknya sendiri).
  function sisaUntukForm(sesi, a) {
    var dipakai = terisi(sesi);
    if (a && punyaSesi(a, sesi.id) && (a.status || 'aktif') === 'aktif') dipakai--;
    return Number(sesi.kuota || 0) - dipakai;
  }

  // Sesi milik atlet yang melebihi kuota saat kembali berstatus Aktif.
  function peringatanPenuh(a) {
    if (!a) return [];
    return sesiAtlet(a).filter(function (s) {
      return terisi(s) > Number(s.kuota || 0);
    });
  }

  /* ==================== TAMPILAN CHIPS ==================== */

  function chipsHtml(a, opts) {
    opts = opts || {};
    var list = sesiAtlet(a);
    if (!list.length) {
      return opts.kosongHtml || '<span class="sel-kosong">-</span>';
    }
    return '<div class="jadwal-chips">' + list.map(function (s) {
      var teks = opts.panjang ? labelPanjang(s) : labelPendek(s);
      return '<span class="jadwal-chip' + (s.aktif === false ? ' nonaktif' : '') + '" title="' +
        Utils.esc(tooltipSesi(s)) + '">' + Utils.esc(teks) + '</span>';
    }).join('') + '</div>';
  }

  /* ==================== MIGRASI & SEED ==================== */

  // Pencarian/pembuatan lokasi didelegasikan ke Picker (ID tetap, idempoten)
  // sehingga tidak pernah membuat lokasi duplikat untuk nama yang sama.
  function pastikanLokasi(nama) {
    if (typeof Picker !== 'undefined' && Picker && Picker.pastikanLokasi) {
      return Picker.pastikanLokasi(nama);
    }
    return '';
  }

  function seed() {
    try {
      if (localStorage.getItem(CONFIG.PREFIX + KUNCI_SEED)) return;
      SEED.forEach(function (s) {
        if (Store.find(KOLEKSI, s.id)) return;
        Store.insert(KOLEKSI, {
          id: s.id,
          lokasi_id: pastikanLokasi(s.lokasi_nama),
          lokasi_nama: s.lokasi_nama,
          hari: s.hari,
          jam: s.jam,
          lapangan: s.lapangan,
          pelatih: s.pelatih,
          kuota: s.kuota,
          aktif: true
        });
      });
      localStorage.setItem(CONFIG.PREFIX + KUNCI_SEED, '1');
    } catch (e) {}
  }

  // Migrasi aman: semua atlet lama diberi field jadwal_sesi (array) bila
  // belum ada. Tidak ada data yang dihapus.
  function migrasiAtlet() {
    Store.all('athletes').forEach(function (a) {
      if (!Array.isArray(a.jadwal_sesi)) {
        Store.update('athletes', a.id, { jadwal_sesi: [] });
      }
    });
    // Buang id sesi yang sudah tidak ada agar tampilan tetap rapi (data
    // atlet lain tidak disentuh). Hanya dilakukan bila id memang hilang.
    var sah = {};
    Store.all(KOLEKSI).forEach(function (s) { sah[s.id] = true; });
    Store.all('athletes').forEach(function (a) {
      if (!Array.isArray(a.jadwal_sesi)) return;
      var bersih = a.jadwal_sesi.filter(function (id) { return sah[id]; });
      if (bersih.length !== a.jadwal_sesi.length) {
        Store.update('athletes', a.id, { jadwal_sesi: bersih });
      }
    });
  }

  // Satu kali jalan (aman diulang): gabungkan sesi jadwal duplikat (lokasi +
  // hari + jam yang sama) menjadi satu entri kanonik — ID dari data master
  // (ses_sc_sen, dst) bila cocok — lalu alihkan referensi atlet (jadwal_sesi)
  // dan catatan absensi (sesi_id) ke ID kanonik sebelum duplikat dihapus.
  function dedupSesi() {
    try {
      var semua = Store.all(KOLEKSI);
      var grup = {};
      var urut = [];
      semua.forEach(function (s) {
        if (!s) return;
        var k = String(s.lokasi_id || '') + '|' + String(s.hari || '').toLowerCase().trim() +
          '|' + String(s.jam || '').replace(/[^0-9]/g, '');
        if (!grup[k]) {
          grup[k] = [];
          urut.push(k);
        }
        grup[k].push(s);
      });
      var peta = {};
      var hapus = {};
      urut.forEach(function (k) {
        var anggota = grup[k];
        if (anggota.length < 2) return;
        var target = null;
        anggota.forEach(function (s) {
          SEED.forEach(function (d) {
            if (String(d.hari).toLowerCase() === String(s.hari || '').toLowerCase() &&
              String(d.jam).replace(/[^0-9]/g, '') === String(s.jam || '').replace(/[^0-9]/g, '') &&
              normalNamaLokasi(d.lokasi_nama) === normalNamaLokasi(s.lokasi_nama)) {
              target = d.id;
            }
          });
        });
        if (target && !anggota.filter(function (s) { return s.id === target; }).length && Store.find(KOLEKSI, target)) {
          target = null;
        }
        var pemenang = null;
        if (target) {
          anggota.forEach(function (s) {
            if (s.id === target) pemenang = s;
          });
        }
        if (!pemenang) {
          pemenang = anggota[0];
          anggota.forEach(function (s) {
            if (String(s.dibuat_pada || '') < String(pemenang.dibuat_pada || '')) pemenang = s;
          });
        }
        if (target && pemenang.id !== target) {
          Store.insert(KOLEKSI, Object.assign({}, pemenang, { id: target }));
          peta[pemenang.id] = target;
          hapus[pemenang.id] = true;
          pemenang = { id: target };
        }
        anggota.forEach(function (s) {
          if (s.id === pemenang.id) return;
          peta[s.id] = pemenang.id;
          hapus[s.id] = true;
        });
      });

      if (Object.keys(peta).length) {
        Store.all('athletes').forEach(function (a) {
          if (!Array.isArray(a.jadwal_sesi)) return;
          var list = [];
          a.jadwal_sesi.forEach(function (id) {
            var t = peta[id] || id;
            if (list.indexOf(t) === -1) list.push(t);
          });
          if (list.join(',') !== a.jadwal_sesi.join(',')) {
            Store.update('athletes', a.id, { jadwal_sesi: list });
          }
        });
        ['absensi_asisten', 'attendance'].forEach(function (koleksi) {
          Store.all(koleksi).forEach(function (r) {
            if (r && r.sesi_id && peta[r.sesi_id]) {
              Store.update(koleksi, r.id, { sesi_id: peta[r.sesi_id] });
            }
          });
        });
        Object.keys(hapus).forEach(function (id) {
          Store.remove(KOLEKSI, id);
        });
      }

      // Sinkronkan nama lokasi tiap sesi dari master (sekalian saat migrasi).
      Store.all(KOLEKSI).forEach(function (s) {
        var l = (typeof Picker !== 'undefined' && Picker && Picker.masterById && s.lokasi_id)
          ? Picker.masterById(s.lokasi_id) : null;
        if (l && l.nama && s.lokasi_nama !== l.nama) {
          Store.update(KOLEKSI, s.id, { lokasi_nama: l.nama });
        }
      });
      return { digabung: Object.keys(hapus).length };
    } catch (e) {
      return { digabung: 0 };
    }
  }

  function normalNamaLokasi(nama) {
    if (typeof Picker !== 'undefined' && Picker && Picker.normalNama) {
      return Picker.normalNama(nama);
    }
    return String(nama || '').trim().toLowerCase();
  }

  function migrasiDedupSesi() {
    try {
      if (localStorage.getItem(CONFIG.PREFIX + KUNCI_DEDUP)) return;
      var hasil = dedupSesi();
      localStorage.setItem(CONFIG.PREFIX + KUNCI_DEDUP, JSON.stringify({
        digabung: hasil.digabung,
        pada: new Date().toISOString()
      }));
      if (hasil.digabung > 0 && typeof Utils !== 'undefined' && Utils.toast) {
        Utils.toast('Perapian data jadwal: ' + hasil.digabung + ' sesi duplikat digabung.', 'success');
      }
    } catch (e) {}
  }

  function init() {
    seed();
    migrasiAtlet();
    migrasiDedupSesi();
  }

  /* ==================== PENGOLAHAN SISI ==================== */

  function simpanSesi(payload, id) {
    payload.lokasi_nama = namaLokasi(payload.lokasi_id) || payload.lokasi_nama || '';
    if (id) {
      Store.update(KOLEKSI, id, payload);
      return byId(id);
    }
    payload.id = 'ses_' + Date.now().toString(36) + Math.floor(Math.random() * 1000);
    payload.aktif = payload.aktif !== false;
    return Store.insert(KOLEKSI, payload);
  }

  function namaLokasi(id) {
    var l = (typeof Picker !== 'undefined' && Picker && Picker.masterById) ? Picker.masterById(id) : null;
    return l ? l.nama : '';
  }

  function toggleSesi(id) {
    var s = byId(id);
    if (!s) return null;
    return Store.update(KOLEKSI, id, { aktif: s.aktif === false });
  }

  function dipakaiAtlet(id) {
    var n = 0;
    Store.all('athletes').forEach(function (a) {
      if (punyaSesi(a, id)) n++;
    });
    return n;
  }

  function hapusSesi(id) {
    if (dipakaiAtlet(id)) return false;
    return Store.remove(KOLEKSI, id);
  }

  // Tambah/hapus sesi dari daftar jadwal sebuah atlet (id apa pun statusnya).
  function setSesiAtlet(a, idSesi, aktif) {
    if (!a) return;
    var list = Array.isArray(a.jadwal_sesi) ? a.jadwal_sesi.slice() : [];
    var i = list.indexOf(idSesi);
    if (aktif && i === -1) list.push(idSesi);
    if (!aktif && i !== -1) list.splice(i, 1);
    Store.update('athletes', a.id, { jadwal_sesi: list });
  }

  // Simpan pilihan jadwal atlet dari form (menimpa daftar sesi atlet).
  function simpanJadwalAtlet(a, ids) {
    var list = [];
    (ids || []).forEach(function (id) {
      if (id && list.indexOf(id) === -1 && byId(id)) list.push(id);
    });
    Store.update('athletes', a.id, { jadwal_sesi: list });
  }

  /* ==================== PANEL PILIH SESI ==================== */

  var panelAktif = null;

  function tutupPanel() {
    if (!panelAktif) return;
    if (panelAktif.onResize) window.removeEventListener('resize', panelAktif.onResize);
    if (panelAktif.overlay && panelAktif.overlay.parentNode) {
      panelAktif.overlay.parentNode.removeChild(panelAktif.overlay);
    }
    document.body.classList.remove('picker-open');
    panelAktif = null;
  }

  function bukaPanel(api) {
    tutupPanel();
    var atlet = api.atlet || null;
    var dipilih = {};
    api.getValue().forEach(function (id) { dipilih[id] = true; });
    var kueri = '';

    var overlay = document.createElement('div');
    overlay.className = 'picker-overlay';
    overlay.innerHTML =
      '<div class="picker-pop" role="dialog" aria-modal="true" aria-label="Pilih jadwal latihan">' +
      '<div class="picker-pop-head">' +
      '<div class="picker-search">' + UI.icon('search', 18) +
      '<input type="search" data-jp-cari placeholder="Cari lokasi, hari, atau jam..." aria-label="Cari jadwal">' +
      '</div>' +
      '<button type="button" class="icon-btn" data-jp-tutup aria-label="Tutup">' + UI.icon('close', 20) + '</button>' +
      '</div>' +
      '<div class="picker-pop-chips" data-jp-chips></div>' +
      '<div class="picker-pop-tools">' +
      '<button type="button" class="btn btn-sm btn-ghost" data-jp-reset>Hapus semua pilihan</button>' +
      '<span class="picker-counter" data-jp-counter></span>' +
      '</div>' +
      '<div class="picker-pop-list" data-jp-list></div>' +
      '<div class="picker-pop-foot">' +
      '<button type="button" class="btn picker-done" data-jp-selesai>Selesai</button>' +
      '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    document.body.classList.add('picker-open');

    var pop = overlay.querySelector('.picker-pop');
    var listHost = overlay.querySelector('[data-jp-list]');
    var chipsHost = overlay.querySelector('[data-jp-chips]');
    var counter = overlay.querySelector('[data-jp-counter]');
    var cari = overlay.querySelector('[data-jp-cari]');

    function posisikan() {
      var kecil = window.matchMedia && window.matchMedia('(max-width: 640px)').matches;
      pop.classList.toggle('sheet', kecil);
      if (kecil) {
        pop.style.top = '';
        pop.style.left = '';
        return;
      }
      var rect = api.trigger.getBoundingClientRect();
      var lebar = Math.min(460, window.innerWidth - 24);
      pop.style.width = lebar + 'px';
      var kiri = Math.max(12, Math.min(rect.left, window.innerWidth - lebar - 12));
      pop.style.left = kiri + 'px';
      pop.style.top = (rect.bottom + 8) + 'px';
      pop.style.maxHeight = Math.min(560, window.innerHeight - rect.bottom - 24) + 'px';
    }
    posisikan();

    function hasilFilter() {
      var q = kueri.trim().toLowerCase();
      var list = semua();
      if (!q) return list;
      return list.filter(function (s) {
        return String(s.lokasi_nama || '').toLowerCase().indexOf(q) !== -1 ||
          String(s.hari || '').toLowerCase().indexOf(q) !== -1 ||
          String(s.jam || '').toLowerCase().indexOf(q) !== -1;
      });
    }

    function renderChips() {
      var ids = Object.keys(dipilih);
      if (!ids.length) {
        chipsHost.innerHTML = '<span class="small muted">Belum ada sesi dipilih. Atlet boleh belum dijadwalkan.</span>';
        return;
      }
      chipsHost.innerHTML = ids.map(function (id) {
        var s = byId(id);
        return '<span class="picker-chip picker-chip-static">' + Utils.esc(s ? labelPendek(s) : id) +
          '<button type="button" class="picker-chip-x" data-jp-hapus="' + Utils.esc(id) + '" aria-label="Hapus jadwal">' +
          UI.icon('x', 14) + '</button></span>';
      }).join('');
    }

    function renderCounter() {
      counter.textContent = Object.keys(dipilih).length + ' sesi dipilih';
    }

    function renderList() {
      var hasil = hasilFilter();
      if (!hasil.length) {
        listHost.innerHTML = '<div class="picker-kosong">Jadwal tidak ditemukan</div>';
        return;
      }
      var html = '';
      var grupTerakhir = '';
      hasil.forEach(function (s) {
        if (s.lokasi_nama !== grupTerakhir) {
          grupTerakhir = s.lokasi_nama;
          html += '<div class="jp-grup">' + Utils.esc(grupTerakhir) + '</div>';
        }
        var on = !!dipilih[s.id];
        var sisaForm = sisaUntukForm(s, atlet);
        var penuh = sisaForm <= 0 && !on;
        var nonaktif = s.aktif === false && !on;
        var mati = penuh || nonaktif;
        var info = mati
          ? (nonaktif ? 'Sesi nonaktif' : 'Penuh')
          : 'Sisa ' + sisaForm + ' dari ' + (s.kuota || 0);
        html += '<label class="picker-row jp-row' + (on ? ' active' : '') + (mati ? ' jp-mati' : '') + '"' +
          ' data-row-sesi="' + Utils.esc(s.id) + '"' + (mati ? ' aria-disabled="true"' : '') + '>' +
          '<input type="checkbox" value="' + Utils.esc(s.id) + '"' + (on ? ' checked' : '') + (mati ? ' disabled' : '') + '>' +
          '<span class="picker-row-teks"><b>' + Utils.esc(labelSesi(s)) + '</b>' +
          '<span class="small muted">' + Utils.esc(singkatanLokasi(s.lokasi_nama)) + ' · ' +
          Utils.esc(s.lapangan || 0) + ' lapangan · ' + Utils.esc(s.pelatih || 0) + ' pelatih</span></span>' +
          '<span class="jp-sisa' + (mati ? ' jp-sisa-penuh' : '') + '">' + Utils.esc(info) + '</span>' +
          '</label>';
      });
      listHost.innerHTML = html;
    }

    function render() {
      renderChips();
      renderCounter();
      renderList();
    }

    function terapkan() {
      api.setValue(Object.keys(dipilih));
    }

    render();
    panelAktif = { overlay: overlay, api: api, onResize: posisikan };
    window.addEventListener('resize', posisikan);

    setTimeout(function () { if (cari && cari.focus) cari.focus(); }, 30);

    overlay.addEventListener('mousedown', function (e) {
      if (e.target === overlay) tutupPanel();
    });

    overlay.addEventListener('click', function (e) {
      if (e.target.closest('[data-jp-tutup]') || e.target.closest('[data-jp-selesai]')) {
        tutupPanel();
        return;
      }
      var chipX = e.target.closest('[data-jp-hapus]');
      if (chipX) {
        delete dipilih[chipX.getAttribute('data-jp-hapus')];
        terapkan();
        render();
        return;
      }
      if (e.target.closest('[data-jp-reset]')) {
        dipilih = {};
        terapkan();
        render();
        return;
      }
      var row = e.target.closest('[data-row-sesi]');
      if (row && e.target.tagName !== 'INPUT') {
        if (row.classList.contains('jp-mati')) return;
        var id = row.getAttribute('data-row-sesi');
        if (dipilih[id]) delete dipilih[id];
        else dipilih[id] = true;
        terapkan();
        render();
      }
    });

    overlay.addEventListener('change', function (e) {
      var t = e.target;
      if (t && t.type === 'checkbox' && t.closest && t.closest('[data-row-sesi]')) {
        if (t.checked) dipilih[t.value] = true;
        else delete dipilih[t.value];
        terapkan();
        render();
      }
    });

    cari.addEventListener('input', function () {
      kueri = cari.value;
      renderList();
    });

    document.addEventListener('keydown', function onEsc(e) {
      if (!panelAktif || panelAktif.overlay !== overlay) {
        document.removeEventListener('keydown', onEsc, true);
        return;
      }
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault();
        e.stopPropagation();
        tutupPanel();
      }
    }, true);
  }

  // Komponen pemilih jadwal: dropdown pencarian + centang, dikelompokkan
  // per lokasi, tiap pilihan menampilkan sisa kuota.
  function pickerJadwal(host, opts) {
    opts = opts || {};
    var name = opts.name || 'jadwal_sesi';
    var dipilih = [];
    (opts.value || []).forEach(function (id) {
      if (id && dipilih.indexOf(id) === -1) dipilih.push(id);
    });

    host.className = (host.className ? host.className + ' ' : '') + 'picker-atlet-host';
    host.innerHTML =
      '<div class="field">' +
      '<label class="label">' + Utils.esc(opts.label || 'Jadwal Latihan') + '</label>' +
      '<button type="button" class="picker-trigger" data-jd-buka aria-haspopup="dialog">' +
      UI.icon('calendar', 20) +
      '<span class="picker-trigger-teks" data-jd-ringkas></span>' +
      '<span class="picker-trigger-panah"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></span>' +
      '</button>' +
      '<div class="picker-ringkas" data-jd-chips></div>' +
      '<div class="help">' + Utils.esc(opts.help || 'Opsional. Boleh pilih lebih dari satu sesi (cari lalu centang). Sesi penuh tidak bisa dipilih.') + '</div>' +
      '<div class="field-error" data-error-for="' + Utils.esc(name) + '"></div>' +
      '<input type="hidden" name="' + Utils.esc(name) + '" value="">' +
      '</div>';

    var trigger = host.querySelector('[data-jd-buka]');
    var ringkas = host.querySelector('[data-jd-ringkas]');
    var chips = host.querySelector('[data-jd-chips]');
    var hidden = host.querySelector('input[type="hidden"][name="' + name + '"]');

    function renderRingkas() {
      hidden.value = dipilih.join(',');
      if (!dipilih.length) {
        ringkas.textContent = 'Pilih jadwal latihan (opsional)';
        chips.innerHTML = '';
        trigger.classList.remove('ada');
        return;
      }
      trigger.classList.add('ada');
      ringkas.textContent = dipilih.length + ' sesi dipilih';
      chips.innerHTML = dipilih.map(function (id) {
        var s = byId(id);
        var teks = s ? labelPendek(s) : id;
        return '<span class="picker-chip picker-chip-static">' + Utils.esc(teks) +
          '<button type="button" class="picker-chip-x" data-jd-hapus="' + Utils.esc(id) + '" aria-label="Hapus ' + Utils.esc(teks) + '">' +
          UI.icon('x', 14) + '</button></span>';
      }).join('');
    }

    function setValue(ids) {
      var sebelum = dipilih.join(',');
      dipilih = [];
      (ids || []).forEach(function (id) {
        if (id && dipilih.indexOf(id) === -1) dipilih.push(id);
      });
      renderRingkas();
      if (dipilih.join(',') === sebelum) return;
      if (typeof opts.onChange === 'function') opts.onChange(dipilih.slice());
      try {
        hidden.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (e) {}
    }

    function getValue() {
      return dipilih.slice();
    }

    var api = {
      getValue: getValue,
      setValue: setValue,
      atlet: opts.atlet || null,
      trigger: trigger,
      el: host
    };

    trigger.addEventListener('click', function () {
      bukaPanel(api);
    });

    host.addEventListener('click', function (e) {
      var x = e.target.closest('[data-jd-hapus]');
      if (!x) return;
      e.preventDefault();
      setValue(dipilih.filter(function (v) {
        return v !== x.getAttribute('data-jd-hapus');
      }));
    });

    host.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.key === 'Esc') {
        if (panelAktif) {
          e.preventDefault();
          tutupPanel();
        }
      }
    });

    renderRingkas();
    return api;
  }

  /* ==================== KELOLA JADWAL & KUOTA ==================== */

  function opsiHari(value) {
    return HARI.map(function (h) {
      return { value: h, label: h };
    });
  }

  function opsiLokasi(value) {
    var list = (typeof Picker !== 'undefined' && Picker && Picker.masterAktif)
      ? Picker.masterAktif() : [];
    if (!list.length) return [{ value: '', label: '-- Belum ada lokasi --' }];
    return [{ value: '', label: '-- Pilih lokasi --' }].concat(list.map(function (l) {
      return { value: l.id, label: l.nama };
    }));
  }

  // Kartu "Kelola Jadwal & Kuota": daftar sesi + tambah/ubah/nonaktifkan/hapus.
  function kelolaJadwal(host) {
    function render() {
      var list = semua();
      host.innerHTML =
        '<p class="muted small">Sesi latihan dipakai untuk pilihan jadwal atlet, kuota otomatis di Beranda, ' +
        'dan absensi asisten pelatih. Sesi yang masih dipakai atlet hanya bisa dinonaktifkan.</p>' +
        '<div class="flex items-center justify-between flex-wrap gap-1 mb-2">' +
        '<span class="small muted">' + list.length + ' sesi terdaftar</span>' +
        '<button type="button" class="btn btn-sm" data-sesi-tambah>' + UI.icon('plus', 18) + ' Tambah Sesi</button>' +
        '</div>' +
        (list.length ? '<div class="table-wrap"><table class="table"><thead><tr>' +
          '<th>Lokasi</th><th>Hari</th><th>Jam</th><th class="align-center">Lap.</th><th class="align-center">Pelatih</th>' +
          '<th class="align-center">Kuota</th><th class="align-center">Terisi</th><th class="align-center">Sisa</th>' +
          '<th>Status</th><th class="align-center">Aksi</th>' +
          '</tr></thead><tbody>' +
          list.map(function (s) {
            var isi = terisi(s);
            var dipakai = dipakaiAtlet(s.id);
            return '<tr>' +
              '<td><b>' + Utils.esc(s.lokasi_nama || '-') + '</b></td>' +
              '<td>' + Utils.esc(s.hari || '-') + '</td>' +
              '<td>' + Utils.esc(s.jam || '-') + '</td>' +
              '<td class="align-center">' + Utils.esc(s.lapangan || 0) + '</td>' +
              '<td class="align-center">' + Utils.esc(s.pelatih || 0) + '</td>' +
              '<td class="align-center">' + Utils.esc(s.kuota || 0) + '</td>' +
              '<td class="align-center fw-bold">' + isi + '</td>' +
              '<td class="align-center">' + sisa(s) + '</td>' +
              '<td>' + UI.statusBadge(s.aktif === false ? 'nonaktif' : 'aktif') + '</td>' +
              '<td class="align-center"><div class="flex gap-1" style="justify-content:center;flex-wrap:wrap">' +
              '<button type="button" class="btn btn-sm btn-secondary" data-sesi-edit="' + Utils.esc(s.id) + '">Edit</button>' +
              '<button type="button" class="btn btn-sm btn-ghost" data-sesi-toggle="' + Utils.esc(s.id) + '">' +
              (s.aktif === false ? 'Aktifkan' : 'Nonaktifkan') + '</button>' +
              (dipakai ? '<span class="small muted" title="Sesi dipakai ' + dipakai + ' atlet">Dipakai ' + dipakai + '</span>'
                : '<button type="button" class="btn btn-sm btn-danger" data-sesi-hapus="' + Utils.esc(s.id) + '">Hapus</button>') +
              '</div></td></tr>';
          }).join('') + '</tbody></table></div>'
          : UI.emptyState('Belum ada sesi jadwal latihan.', 'calendar'));
    }

    function bukaForm(sesi) {
      document.getElementById('modal-host').insertAdjacentHTML('beforeend',
        UI.modalShell('m-sesi', sesi ? 'Edit Sesi Latihan' : 'Tambah Sesi Latihan',
          UI.backButton({ closeModal: 'm-sesi' }) +
          '<form id="form-sesi" novalidate>' +
          UI.field({ name: 'lokasi_id', label: 'Lokasi', type: 'select', required: true, value: sesi ? sesi.lokasi_id : '', options: opsiLokasi() }) +
          UI.field({ name: 'hari', label: 'Hari', type: 'select', required: true, value: sesi ? sesi.hari : '', options: [{ value: '', label: '-- Pilih hari --' }].concat(opsiHari()) }) +
          UI.field({ name: 'jam', label: 'Jam Latihan', required: true, value: sesi ? sesi.jam : '', placeholder: 'contoh: 16.00-18.00' }) +
          '<div class="form-grid cols-2">' +
          UI.field({ name: 'lapangan', label: 'Jumlah Lapangan', type: 'number', required: true, value: sesi ? sesi.lapangan : '', min: 1 }) +
          UI.field({ name: 'pelatih', label: 'Jumlah Pelatih', type: 'number', required: true, value: sesi ? sesi.pelatih : '', min: 1 }) +
          '</div>' +
          UI.field({
            name: 'kuota', label: 'Kuota Atlet', type: 'number', required: true, value: sesi ? sesi.kuota : '', min: 1,
            help: sesi ? 'Jumlah atlet aktif terjadwal saat ini: ' + terisi(sesi) + '.' : 'Jumlah maksimal atlet pada sesi ini.'
          }) +
          UI.field({
            name: 'aktif', label: 'Status', type: 'select', value: !sesi || sesi.aktif !== false ? '1' : '0',
            options: [{ value: '1', label: 'Aktif' }, { value: '0', label: 'Nonaktif' }]
          }) +
          '</form>',
          '<button type="button" class="btn btn-ghost" data-back-close="m-sesi">Batal</button>' +
          '<button type="submit" class="btn" form="form-sesi">Simpan Sesi</button>'));
      UI.openModal('m-sesi');
      var form = document.getElementById('form-sesi');
      UI.bindSubmit(form, function () {
        Utils.clearErrors(form);
        var d = Utils.formData(form);
        var errors = {};
        if (!d.lokasi_id) errors.lokasi_id = 'Lokasi wajib dipilih.';
        if (!d.hari) errors.hari = 'Hari wajib dipilih.';
        if (!d.jam || !String(d.jam).trim()) errors.jam = 'Jam latihan wajib diisi.';
        if (!d.lapangan || Number(d.lapangan) < 1) errors.lapangan = 'Jumlah lapangan minimal 1.';
        if (!d.pelatih || Number(d.pelatih) < 1) errors.pelatih = 'Jumlah pelatih minimal 1.';
        if (!d.kuota || Number(d.kuota) < 1) errors.kuota = 'Kuota atlet minimal 1.';
        if (Object.keys(errors).length) {
          Utils.showErrors(form, errors);
          Utils.toast('Periksa kembali isian yang ditandai.', 'danger');
          return;
        }
        simpanSesi({
          lokasi_id: d.lokasi_id,
          hari: d.hari,
          jam: String(d.jam).trim(),
          lapangan: Number(d.lapangan),
          pelatih: Number(d.pelatih),
          kuota: Number(d.kuota),
          aktif: d.aktif !== '0'
        }, sesi ? sesi.id : null);
        var tutup = document.getElementById('m-sesi');
        if (tutup && tutup.parentNode) tutup.parentNode.removeChild(tutup);
        if (!document.querySelector('.modal-backdrop:not([hidden])')) {
          document.body.classList.remove('modal-open');
        }
        Utils.toast('Sesi latihan berhasil disimpan.', 'success');
        render();
      });
    }

    render();

    host.addEventListener('click', function (e) {
      if (e.target.closest('[data-sesi-tambah]')) {
        bukaForm(null);
        return;
      }
      var edit = e.target.closest('[data-sesi-edit]');
      if (edit) {
        bukaForm(byId(edit.getAttribute('data-sesi-edit')));
        return;
      }
      var tog = e.target.closest('[data-sesi-toggle]');
      if (tog) {
        var s = toggleSesi(tog.getAttribute('data-sesi-toggle'));
        if (s) Utils.toast('Status sesi diperbarui.', 'success');
        render();
        return;
      }
      var hapus = e.target.closest('[data-sesi-hapus]');
      if (hapus) {
        var target = byId(hapus.getAttribute('data-sesi-hapus'));
        if (!target) return;
        if (dipakaiAtlet(target.id)) {
          Utils.toast('Sesi masih dipakai atlet. Nonaktifkan saja agar data atlet tidak putus.', 'danger');
          render();
          return;
        }
        UI.confirmDialog('Hapus sesi ' + labelPanjang(target) + '? Sesi ini tidak dipakai atlet mana pun.', 'Hapus Sesi').then(function (ok) {
          if (!ok) return;
          hapusSesi(target.id);
          Utils.toast('Sesi latihan dihapus.', 'success');
          render();
        });
      }
    });
  }

  // Buka modal "Kelola Jadwal & Kuota" (dipakai dari Daftar Atlet & Beranda).
  function bukaKelola(onTutup) {
    var host = document.getElementById('modal-host');
    if (!host) return;
    host.insertAdjacentHTML('beforeend',
      UI.modalShell('m-kelola-jadwal', 'Kelola Jadwal & Kuota',
        UI.backButton({ closeModal: 'm-kelola-jadwal' }) +
        '<div id="kelola-jadwal-host"></div>',
        '<button type="button" class="btn" data-back-close="m-kelola-jadwal">Tutup</button>'));
    UI.openModal('m-kelola-jadwal');
    kelolaJadwal(document.getElementById('kelola-jadwal-host'));
    var el = document.getElementById('m-kelola-jadwal');
    if (el) {
      el.addEventListener('click', function (e) {
        if (e.target.closest('[data-back-close="m-kelola-jadwal"]') ||
          e.target.closest('[data-modal-close="m-kelola-jadwal"]') ||
          e.target === el) {
          if (typeof onTutup === 'function') onTutup();
        }
      });
    }
  }

  /* ==================== DAFTAR PESERTA SESI ==================== */

  // Modal daftar atlet pada satu sesi + tombol "Atur Jadwal" (tambah atlet).
  // opts: { onDetail: function(idAtlet) }
  function bukaPeserta(sesiId, opts) {
    opts = opts || {};
    var s = byId(sesiId);
    if (!s) return;
    var host = document.getElementById('modal-host');
    if (!host) return;

    function htmlPeserta() {
      var list = peserta(s);
      var nonaktif = semuaPeserta(s).filter(function (a) {
        return (a.status || 'aktif') !== 'aktif';
      });
      var body = '<p class="muted small mb-2">' + Utils.esc(labelPanjang(s)) + ' · Kuota ' + terisi(s) +
        ' dari ' + Utils.esc(s.kuota || 0) + ' atlet</p>';
      if (!list.length && !nonaktif.length) {
        body += UI.emptyState('Belum ada atlet pada sesi ini.', 'users');
      } else {
        body += '<div class="list-rows">' + list.map(function (a) {
          return '<div class="list-row">' + UI.avatar(a, 38) +
            '<div class="grow"><b>' + Utils.esc(a.nama) + '</b><span>' + Utils.esc(a.id_atlet) + '</span></div>' +
            '<button type="button" class="btn btn-sm btn-secondary" data-peserta-detail="' + Utils.esc(a.id_atlet) + '">Detail</button></div>';
        }).join('') + '</div>';
        if (nonaktif.length) {
          body += '<h4 class="mt-3 mb-1">Tidak dihitung kuota (bukan Aktif)</h4>' +
            '<div class="list-rows">' + nonaktif.map(function (a) {
              return '<div class="list-row">' + UI.avatar(a, 38) +
                '<div class="grow"><b>' + Utils.esc(a.nama) + '</b><span>' + Utils.esc(a.id_atlet) + '</span></div>' +
                UI.statusBadge(a.status) +
                '<button type="button" class="btn btn-sm btn-secondary" data-peserta-detail="' + Utils.esc(a.id_atlet) + '">Detail</button></div>';
            }).join('') + '</div>';
        }
      }
      return body;
    }

    function buka() {
      var ada = document.getElementById('m-peserta');
      if (ada && ada.parentNode) ada.parentNode.removeChild(ada);
      host.insertAdjacentHTML('beforeend',
        UI.modalShell('m-peserta', 'Atlet pada Sesi ' + labelSesi(s),
          UI.backButton({ closeModal: 'm-peserta' }) +
          '<div id="peserta-isi">' + htmlPeserta() + '</div>',
          '<button type="button" class="btn btn-ghost" data-back-close="m-peserta">Tutup</button>' +
          '<button type="button" class="btn" id="peserta-atur">Atur Jadwal</button>'));
      UI.openModal('m-peserta');
    }

    buka();

    var el = document.getElementById('m-peserta');
    if (!el) return;

    el.addEventListener('click', function (e) {
      var det = e.target.closest('[data-peserta-detail]');
      if (det) {
        var idAtlet = det.getAttribute('data-peserta-detail');
        if (el.parentNode) el.parentNode.removeChild(el);
        if (!document.querySelector('.modal-backdrop:not([hidden])')) {
          document.body.classList.remove('modal-open');
        }
        if (typeof opts.onDetail === 'function') opts.onDetail(idAtlet);
        return;
      }
      if (e.target.closest('#peserta-atur')) {
        bukaAturJadwal(s, function () {
          var isi = document.getElementById('peserta-isi');
          if (isi) isi.innerHTML = htmlPeserta();
        });
      }
    });
  }

  // Pilih atlet untuk sebuah sesi (centang = masuk sesi, lepas = keluar sesi).
  function bukaAturJadwal(sesi, onSelesai) {
    var host = document.getElementById('modal-host');
    if (!host) return;
    var ada = document.getElementById('m-atur-jadwal');
    if (ada && ada.parentNode) ada.parentNode.removeChild(ada);

    host.insertAdjacentHTML('beforeend',
      UI.modalShell('m-atur-jadwal', 'Atur Jadwal — ' + labelSesi(sesi),
        UI.backButton({ closeModal: 'm-atur-jadwal' }) +
        '<p class="muted small">Centang atlet yang berlatih pada sesi ini. Atlet aktif yang dicentang menempati kuota (' +
        terisi(sesi) + ' dari ' + Utils.esc(sesi.kuota || 0) + ').</p>' +
        '<div id="atur-jadwal-atlet"></div>',
        '<button type="button" class="btn btn-ghost" data-back-close="m-atur-jadwal">Batal</button>' +
        '<button type="button" class="btn" id="atur-jadwal-simpan">Simpan</button>'));
    UI.openModal('m-atur-jadwal');

    var awal = {};
    peserta(sesi).forEach(function (a) { awal[a.id_atlet] = true; });

    var api = Picker.atlet(document.getElementById('atur-jadwal-atlet'), {
      name: 'atur_jadwal_atlet',
      label: 'Atlet pada Sesi Ini',
      mode: 'multi',
      value: Object.keys(awal),
      help: 'Cari lalu centang atlet yang berlatih pada sesi ini.'
    });

    var el = document.getElementById('m-atur-jadwal');
    if (!el) return;
    el.addEventListener('click', function (e) {
      if (!e.target.closest('#atur-jadwal-simpan')) return;
      var pilih = {};
      api.getValue().forEach(function (id) { pilih[id] = true; });
      var tambah = [];
      var kurang = [];
      Object.keys(pilih).forEach(function (id) {
        if (!awal[id]) tambah.push(id);
      });
      Object.keys(awal).forEach(function (id) {
        if (!pilih[id]) kurang.push(id);
      });
      var kurangKuota = terisi(sesi) + tambah.length - kurang.length - Number(sesi.kuota || 0);
      if (kurangKuota > 0) {
        Utils.toast('Kuota sesi tidak cukup (sisa ' + sisa(sesi) + '). Naikkan kuota lewat Kelola Jadwal & Kuota.', 'danger');
        return;
      }
      tambah.forEach(function (id) {
        var a = UI.athleteById(id);
        if (a) setSesiAtlet(a, sesi.id, true);
      });
      kurang.forEach(function (id) {
        var a = UI.athleteById(id);
        if (a) setSesiAtlet(a, sesi.id, false);
      });
      UI.closeModal('m-atur-jadwal');
      if (el.parentNode) el.parentNode.removeChild(el);
      Utils.toast('Jadwal sesi diperbarui.', 'success');
      if (typeof onSelesai === 'function') onSelesai();
    });
  }

  return {
    init: init,
    dedupSesi: dedupSesi,
    semua: semua,
    aktif: aktif,
    byId: byId,
    grupLokasi: grupLokasi,
    HARI: HARI,
    labelSesi: labelSesi,
    labelPendek: labelPendek,
    labelPanjang: labelPanjang,
    tooltipSesi: tooltipSesi,
    singkatanLokasi: singkatanLokasi,
    hariSingkat: hariSingkat,
    terisi: terisi,
    sisa: sisa,
    sisaUntukForm: sisaUntukForm,
    peserta: peserta,
    semuaPeserta: semuaPeserta,
    sesiAtlet: sesiAtlet,
    punyaSesi: punyaSesi,
    belumDijadwalkan: belumDijadwalkan,
    ringkasan: ringkasan,
    peringatanPenuh: peringatanPenuh,
    chipsHtml: chipsHtml,
    pickerJadwal: pickerJadwal,
    kelolaJadwal: kelolaJadwal,
    bukaKelola: bukaKelola,
    bukaPeserta: bukaPeserta,
    simpanSesi: simpanSesi,
    setSesiAtlet: setSesiAtlet,
    simpanJadwalAtlet: simpanJadwalAtlet
  };
})();
