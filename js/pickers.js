var Picker = (function () {
  var KOLEKSI_LOKASI = 'lokasi_latihan';
  // Lokasi utama dengan ID TETAP. Seeding hanya membuat lokasi bila ID belum
  // ada, sehingga tidak pernah menumpuk walau dimuat berulang / banyak tab.
  var DEFAULT_LOKASI = [
    { id: 'loc_scpp', nama: 'Sport Center Puncak Permai' },
    { id: 'loc_kintono', nama: 'Kintono Badminton Hall' },
    { id: 'loc_unesa', nama: 'Lap. Atletik Unesa' }
  ];
  // Nama lama yang diganti namanya (ID tetap, agar data lama tidak putus).
  var RENAME_LOKASI = [{ dari: 'Kintono Hall', ke: 'Kintono Badminton Hall' }];
  var LOKASI_LAMA = ['Lapangan Utama', 'Lapangan 2', 'GOR Surabaya'];
  var KOLEKSI_PENGGUNA_LOKASI = ['absensi_asisten', 'logbook_entries'];
  // Penanda migrasi deduplikasi (sekali jalan, tetapi aman diulang).
  var KUNCI_MIGRASI = 'lokasi_migrasi_v2';

  // Normalisasi nama untuk perbandingan & deduplikasi: huruf kecil, titik dan
  // tanda baca diabaikan, spasi ganda jadi satu - "lap. atletik unesa" dan
  // "lap atletik unesa" dianggap nama yang sama.
  function normalNama(nama) {
    return String(nama || '')
      .toLowerCase()
      .replace(/[.,()\-_/]/g, ' ')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* ==================== MASTER LOKASI LATIHAN ==================== */

  function masterSemua() {
    return Utils.sortBy(Store.all(KOLEKSI_LOKASI), 'nama', 'asc');
  }

  function masterAktif() {
    return masterSemua().filter(function (l) {
      return l.aktif !== false;
    });
  }

  function masterById(id) {
    return Store.findOne(KOLEKSI_LOKASI, function (l) {
      return l.id === id;
    });
  }

  function masterCariNama(nama) {
    var n = normalNama(nama);
    if (!n) return null;
    return Store.findOne(KOLEKSI_LOKASI, function (l) {
      return normalNama(l.nama) === n;
    });
  }

  function defaultByNama(nama) {
    var n = normalNama(nama);
    for (var i = 0; i < DEFAULT_LOKASI.length; i++) {
      if (normalNama(DEFAULT_LOKASI[i].nama) === n) return DEFAULT_LOKASI[i];
    }
    return null;
  }

  // Kembalikan ID lokasi untuk sebuah nama: cari di master (id apa pun),
  // kalau belum ada buat dengan ID tetap (untuk lokasi utama) - tidak pernah
  // membuat duplikat untuk nama yang sama.
  function pastikanLokasi(nama) {
    var ada = masterCariNama(nama);
    if (ada) return ada.id;
    var def = defaultByNama(nama);
    var id = def ? def.id : ('lok_' + normalNama(nama).replace(/\s+/g, '_').slice(0, 24) + '_' + Store.all(KOLEKSI_LOKASI).length);
    if (masterById(id)) return id;
    Store.insert(KOLEKSI_LOKASI, {
      id: id,
      nama: def ? def.nama : String(nama || '').trim(),
      aktif: true
    });
    return id;
  }

  function masterSimpan(payload, id) {
    if (id) {
      Store.update(KOLEKSI_LOKASI, id, payload);
      return masterById(id);
    }
    return Store.insert(KOLEKSI_LOKASI, Object.assign({
      id: 'lok_' + Date.now().toString(36) + Math.floor(Math.random() * 1000),
      aktif: true
    }, payload));
  }

  function masterToggle(id) {
    var l = masterById(id);
    if (!l) return null;
    return Store.update(KOLEKSI_LOKASI, id, { aktif: l.aktif === false });
  }

  function masterHapus(id) {
    return Store.remove(KOLEKSI_LOKASI, id);
  }

  // Seeding idempotent: setiap lokasi utama dibuat HANYA bila ID tetapnya
  // belum ada. Bila record dengan nama sama sudah ada (ID lama), tidak dibuat
  // tambahan - deduplikasi yang akan menyatukannya ke ID tetap.
  function initMaster() {
    try {
      DEFAULT_LOKASI.forEach(function (d) {
        if (Store.find(KOLEKSI_LOKASI, d.id)) return;
        if (masterCariNama(d.nama)) return;
        Store.insert(KOLEKSI_LOKASI, {
          id: d.id,
          nama: d.nama,
          aktif: true
        });
      });
    } catch (e) {}
  }

  // Ganti nama lokasi lama (mis. "Kintono Hall" -> "Kintono Badminton Hall")
  // pada SEMUA record yang cocok (bukan hanya yang pertama), lalu rapikan
  // juga teks/lokasi_nama pada record lama. Tidak ada data yang dihapus.
  function migrasiRenameLokasi() {
    try {
      RENAME_LOKASI.forEach(function (r) {
        var nDari = normalNama(r.dari);
        Store.all(KOLEKSI_LOKASI).forEach(function (l) {
          if (l && normalNama(l.nama) === nDari) {
            Store.update(KOLEKSI_LOKASI, l.id, { nama: r.ke });
          }
        });
        var koleksiData = ['absensi_asisten', 'logbook_entries', 'attendance'];
        koleksiData.forEach(function (koleksi) {
          Store.all(koleksi).forEach(function (rec) {
            if (!rec) return;
            var patch = {};
            if (Array.isArray(rec.lokasi_nama) && rec.lokasi_nama.indexOf(r.dari) !== -1) {
              patch.lokasi_nama = rec.lokasi_nama.map(function (n) {
                return n === r.dari ? r.ke : n;
              });
            }
            if (rec.lokasi && String(rec.lokasi).indexOf(r.dari) !== -1) {
              patch.lokasi = String(rec.lokasi).split(r.dari).join(r.ke);
            }
            if (rec.lokasi_lainnya && String(rec.lokasi_lainnya).indexOf(r.dari) !== -1) {
              patch.lokasi_lainnya = String(rec.lokasi_lainnya).split(r.dari).join(r.ke);
            }
            if (Object.keys(patch).length) Store.update(koleksi, rec.id, patch);
          });
        });
      });
    } catch (e) {}
  }

  // Penyelarasan master untuk instalasi yang sudah berjalan: pastikan lokasi
  // utama tersedia (ID tetap, idempotent) dan nonaktifkan lokasi lama tanpa
  // menghapusnya.
  function migrasiMasterLokasi() {
    try {
      migrasiRenameLokasi();
      initMaster();
      LOKASI_LAMA.forEach(function (nama) {
        var lama = masterCariNama(nama);
        if (lama && lama.aktif !== false) {
          Store.update(KOLEKSI_LOKASI, lama.id, { aktif: false });
        }
      });
    } catch (e) {}
  }

  /* ==================== DEDUPLIKASI (MIGRASI v2) ==================== */

  // Satu kali jalan (aman diulang): gabungkan lokasi duplikat - nama yang
  // sama setelah dinormalisasi ("lap. atletik unesa" == "lap atletik unesa")
  // dijadikan satu entri kanonik (ID tetap loc_* bila lokasi utama), semua
  // referensi (kehadiran, logbook, jadwal, dsb) dialihkan ke ID kanonik,
  // lalu record duplikatnya dihapus. Tidak ada data kehadiran yang hilang.
  function dedupLokasi() {
    try {
      var semua = Store.all(KOLEKSI_LOKASI);
      var grup = {};
      var urut = [];
      semua.forEach(function (l) {
        if (!l) return;
        var k = normalNama(l.nama);
        if (!k) return;
        if (!grup[k]) {
          grup[k] = [];
          urut.push(k);
        }
        grup[k].push(l);
      });

      var petaId = {};     // id duplikat -> id kanonik
      var petaNama = {};   // nama ternormalisasi -> nama kanonik
      var varianNama = {}; // nama kanonik -> [varian ejaan lama]
      var hapusId = {};

      urut.forEach(function (k) {
        var anggota = grup[k];
        var namaAsli = anggota.map(function (l) {
          return String(l.nama || '');
        });
        var def = defaultByNama(k);
        // Target ID: ID tetap untuk lokasi utama, selain itu ID pemenang.
        var target = def ? def.id : null;
        if (target && masterById(target) && anggota.filter(function (l) {
          return l.id === target;
        }).length === 0) {
          // ID tetap sudah dipakai record lain (nama lain) - jangan rebut.
          target = null;
        }
        var pemenang = null;
        if (target) {
          anggota.forEach(function (l) {
            if (l.id === target) pemenang = l;
          });
        }
        if (!pemenang) {
          // Pemenang: yang paling awal dibuat (stabil), sisanya duplikat.
          pemenang = anggota[0];
          anggota.forEach(function (l) {
            if (String(l.dibuat_pada || '') < String(pemenang.dibuat_pada || '')) pemenang = l;
          });
        }
        var namaKanonik = def ? def.nama : pemenang.nama;

        if (target && pemenang.id !== target) {
          // Adopsi ID tetap: salin record pemenang ke ID tetap, referensi ikut.
          Store.insert(KOLEKSI_LOKASI, Object.assign({}, pemenang, { id: target, nama: namaKanonik }));
          petaId[pemenang.id] = target;
          hapusId[pemenang.id] = true;
          pemenang = { id: target };
        } else if (pemenang.nama !== namaKanonik) {
          Store.update(KOLEKSI_LOKASI, pemenang.id, { nama: namaKanonik });
        }

        petaNama[k] = namaKanonik;
        namaAsli.forEach(function (n) {
          if (n && n.trim() !== namaKanonik) {
            if (!varianNama[namaKanonik]) varianNama[namaKanonik] = [];
            if (varianNama[namaKanonik].indexOf(n) === -1) {
              varianNama[namaKanonik].push(n);
            }
          }
        });
        anggota.forEach(function (l) {
          if (l.id === pemenang.id) return;
          petaId[l.id] = pemenang.id;
          hapusId[l.id] = true;
        });
      });

      benahiReferensiLokasi(petaId, petaNama, varianNama);

      Object.keys(hapusId).forEach(function (id) {
        if (petaId[id] !== id) Store.remove(KOLEKSI_LOKASI, id);
      });
      return {
        digabung: Object.keys(hapusId).length,
        grup: urut.length
      };
    } catch (e) {
      return { digabung: 0, grup: 0 };
    }
  }

  // Perbaiki seluruh referensi lokasi pada SEMUA koleksi data (kehadiran,
  // logbook, jadwal, dsb) agar menunjuk ke ID/nama kanonik. Field teks lama
  // selain nama lokasi (mis. "Lainnya" isian sendiri) tidak diubah.
  function benahiReferensiLokasi(petaId, petaNama, varianNama) {
    var prefix = CONFIG.PREFIX;
    var kunciLewati = {};
    kunciLewati[KOLEKSI_LOKASI] = true;
    kunciLewati['seq'] = true;
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (!key || key.indexOf(prefix) !== 0) continue;
      var koleksi = key.slice(prefix.length);
      if (kunciLewati[koleksi]) continue;
      var rows = Store.all(koleksi);
      if (!Array.isArray(rows) || !rows.length) continue;
      rows.forEach(function (rec) {
        if (!rec || typeof rec !== 'object' || rec.id === undefined) return;
        var patch = {};
        if (Array.isArray(rec.lokasi_ids)) {
          var ids = [];
          rec.lokasi_ids.forEach(function (id) {
            var tujuan = petaId[id] || id;
            if (ids.indexOf(tujuan) === -1) ids.push(tujuan);
          });
          if (ids.join(',') !== rec.lokasi_ids.join(',')) patch.lokasi_ids = ids;
        }
        if (rec.lokasi_id && petaId[rec.lokasi_id]) patch.lokasi_id = petaId[rec.lokasi_id];
        if (Array.isArray(rec.lokasi_nama)) {
          var nama = [];
          rec.lokasi_nama.forEach(function (n) {
            var t = petaNama[normalNama(n)];
            var nilai = t !== undefined ? t : n;
            if (nama.indexOf(nilai) === -1) nama.push(nilai);
          });
          if (nama.join(' | ') !== rec.lokasi_nama.join(' | ')) patch.lokasi_nama = nama;
        } else if (typeof rec.lokasi_nama === 'string' && rec.lokasi_nama) {
          var tSkalar = petaNama[normalNama(rec.lokasi_nama)];
          if (tSkalar !== undefined && tSkalar !== rec.lokasi_nama) patch.lokasi_nama = tSkalar;
        }
        if (typeof rec.lokasi === 'string' && rec.lokasi) {
          var teks = rec.lokasi;
          Object.keys(varianNama).forEach(function (kanonik) {
            varianNama[kanonik].forEach(function (varian) {
              if (!varian || varian === kanonik) return;
              teks = teks.split(varian).join(kanonik);
            });
          });
          if (teks !== rec.lokasi) patch.lokasi = teks;
        }
        if (Object.keys(patch).length) Store.update(koleksi, rec.id, patch);
      });
    }
  }

  // Jalankan migrasi deduplikasi satu kali (ditandai di localStorage).
  function migrasiDedup() {
    try {
      if (localStorage.getItem(CONFIG.PREFIX + KUNCI_MIGRASI)) return;
      var hasil = dedupLokasi();
      localStorage.setItem(CONFIG.PREFIX + KUNCI_MIGRASI, JSON.stringify({
        digabung: hasil.digabung,
        grup: hasil.grup,
        pada: new Date().toISOString()
      }));
      if (hasil.digabung > 0 && typeof Utils !== 'undefined' && Utils.toast) {
        Utils.toast('Perapian data lokasi: ' + hasil.digabung + ' duplikat digabung.', 'success');
      }
    } catch (e) {}
  }

  /* ==================== NILAI LOKASI PADA RECORD ==================== */

  // Membaca nilai lokasi dari sebuah record (data baru maupun data lama).
  function nilaiLokasi(rec) {
    var out = { ids: [], nama: [], lainnya: '', teks: '' };
    if (!rec) return out;
    if (Array.isArray(rec.lokasi_ids)) out.ids = rec.lokasi_ids.slice();
    if (Array.isArray(rec.lokasi_nama)) out.nama = rec.lokasi_nama.slice();
    out.lainnya = rec.lokasi_lainnya ? String(rec.lokasi_lainnya) : '';
    if (!out.nama.length && !out.lainnya && rec.lokasi) {
      out.teks = String(rec.lokasi);
    } else {
      var bagian = out.nama.slice();
      if (out.lainnya) bagian.push(out.lainnya);
      out.teks = bagian.join(', ');
    }
    return out;
  }

  function labelLokasi(rec) {
    var n = nilaiLokasi(rec);
    return n.teks || (rec && rec.lokasi ? String(rec.lokasi) : '');
  }

  // Chip kecil untuk tabel riwayat / rekap.
  function chipLokasi(rec) {
    var n = nilaiLokasi(rec);
    var daftar = n.nama.slice();
    if (n.lainnya) daftar.push(n.lainnya);
    if (!daftar.length && n.teks) daftar.push(n.teks);
    if (!daftar.length && rec && rec.lokasi) daftar.push(String(rec.lokasi));
    if (!daftar.length) return '<span class="muted">-</span>';
    return '<div class="lokasi-chips">' + daftar.map(function (t) {
      return '<span class="lokasi-chip">' + Utils.esc(t) + '</span>';
    }).join('') + '</div>';
  }

  // Susun field lokasi untuk disimpan ke record (teks lama tetap diisi
  // agar data lama & tampilan lama tidak rusak).
  function payloadLokasi(nilai) {
    var n = nilai || { ids: [], nama: [], lainnya: '' };
    var bagian = (n.nama || []).slice();
    var lainnya = n.lainnya ? String(n.lainnya) : '';
    if (lainnya) bagian.push(lainnya);
    return {
      lokasi: bagian.join(', '),
      lokasi_ids: (n.ids || []).slice(),
      lokasi_nama: (n.nama || []).slice(),
      lokasi_lainnya: lainnya
    };
  }

  // Migrasi aman untuk data lama (lokasi masih berupa teks).
  // Menambahkan lokasi_ids/lokasi_nama bila nama bisa dicocokkan dengan
  // master; sisanya masuk lokasi_lainnya. Field lama tidak dihapus.
  function migrasiLokasi() {
    var total = 0;
    KOLEKSI_PENGGUNA_LOKASI.forEach(function (koleksi) {
      Store.all(koleksi).forEach(function (rec) {
        if (!rec || rec.lokasi_ids !== undefined) return;
        var teks = rec.lokasi ? String(rec.lokasi) : '';
        if (!teks) {
          Store.update(koleksi, rec.id, { lokasi_ids: [], lokasi_nama: [], lokasi_lainnya: '' });
          total++;
          return;
        }
        var ids = [];
        var nama = [];
        var sisa = [];
        teks.split(',').forEach(function (bagian) {
          var t = bagian.trim();
          if (!t) return;
          var cocok = masterCariNama(t);
          if (cocok) {
            if (ids.indexOf(cocok.id) === -1) {
              ids.push(cocok.id);
              nama.push(cocok.nama);
            }
          } else {
            sisa.push(t);
          }
        });
        Store.update(koleksi, rec.id, {
          lokasi_ids: ids,
          lokasi_nama: nama,
          lokasi_lainnya: sisa.join(', ')
        });
        total++;
      });
    });
    return total;
  }

  function init() {
    initMaster();
    migrasiMasterLokasi();
    migrasiLokasi();
    migrasiDedup();
  }

  /* ==================== KOMPONEN: PILIH LOKASI ==================== */

  // Checkbox kartu/chip besar untuk lokasi latihan (bisa pilih lebih dari satu).
  // host: elemen tujuan, opts: { name, label, required, help, value: {ids, lainnya}, onChange }
  function lokasi(host, opts) {
    opts = opts || {};
    var name = opts.name || 'lokasi_ids';
    var value = opts.value || { ids: [], lainnya: '' };
    var dipilih = {};
    (value.ids || []).forEach(function (id) {
      dipilih[id] = true;
    });
    var lainnyaAktif = !!value.lainnya;
    var teksLainnya = value.lainnya || '';

    host.className = (host.className ? host.className + ' ' : '') + 'picker-lokasi-host';
    host.innerHTML =
      '<div class="field lokasi-field">' +
      '<label class="label">' + Utils.esc(opts.label || 'Lokasi Latihan') +
      (opts.required ? ' <span class="req">*</span>' : '') + '</label>' +
      '<div class="lokasi-toolbar">' +
      (opts.single ? '' : '<button type="button" class="btn btn-sm btn-ghost" data-lokasi-semua>' + UI.icon('check', 16) + ' Pilih semua</button>') +
      '<button type="button" class="btn btn-sm btn-ghost" data-lokasi-reset>' + UI.icon('x', 16) + ' Hapus pilihan</button>' +
      '<span class="picker-counter" data-lokasi-counter></span>' +
      '</div>' +
      '<div class="lokasi-grid" data-lokasi-grid></div>' +
      (opts.tanpaLainnya ? '' :
        '<div class="lokasi-lainnya-box" data-lokasi-lainnya-box hidden>' +
        '<input class="input" type="text" name="lokasi_lainnya" data-lokasi-lainnya placeholder="Tulis lokasi lain..." value="' + Utils.esc(teksLainnya) + '">' +
        '</div>') +
      (opts.help ? '<div class="help">' + Utils.esc(opts.help) + '</div>' : '') +
      '<div class="field-error" data-error-for="lokasi"></div>' +
      '<input type="hidden" name="' + Utils.esc(name) + '" value="">' +
      '</div>';

    var grid = host.querySelector('[data-lokasi-grid]');
    var boxLainnya = host.querySelector('[data-lokasi-lainnya-box]');
    var inputLainnya = host.querySelector('[data-lokasi-lainnya]');
    var counter = host.querySelector('[data-lokasi-counter]');

    function daftarTampil() {
      if (opts.hanyaUtama) {
        // Sumber data tunggal: lokasi utama dari master (ID tetap), urutan tetap.
        var out = [];
        DEFAULT_LOKASI.forEach(function (d) {
          var l = masterById(d.id) || masterCariNama(d.nama);
          if (l) out.push(l);
        });
        return out;
      }
      return masterAktif();
    }

    function renderGrid() {
      var daftar = daftarTampil();
      grid.className = 'lokasi-grid' + (opts.hanyaUtama ? ' lokasi-grid-tiga' : '');
      if (!daftar.length) {
        grid.innerHTML = UI.emptyState('Belum ada lokasi latihan. Tambahkan lewat menu Kelola Lokasi Latihan.', 'settings');
      } else {
        grid.innerHTML = daftar.map(function (l) {
          var aktif = !!dipilih[l.id];
          return '<label class="lokasi-card' + (aktif ? ' active' : '') + '" data-lokasi-card="' + Utils.esc(l.id) + '">' +
            '<input type="checkbox" value="' + Utils.esc(l.id) + '"' + (aktif ? ' checked' : '') + '>' +
            '<span class="lokasi-check">' + UI.icon('check', 16) + '</span>' +
            '<span class="lokasi-nama">' + Utils.esc(l.nama) + '</span>' +
            '</label>';
        }).join('');
      }
      if (!opts.tanpaLainnya) {
        var kartuLainnya = '<label class="lokasi-card lokasi-card-lainnya' + (lainnyaAktif ? ' active' : '') + '" data-lokasi-lainnya-kartu>' +
          '<input type="checkbox" data-lokasi-lainnya-toggle' + (lainnyaAktif ? ' checked' : '') + '>' +
          '<span class="lokasi-check">' + UI.icon('plus', 16) + '</span>' +
          '<span class="lokasi-nama">Lainnya</span></label>';
        grid.insertAdjacentHTML('beforeend', kartuLainnya);
      }
      if (boxLainnya) boxLainnya.hidden = !lainnyaAktif;
      perbaruiCounter();
    }

    function perbaruiCounter() {
      var n = Object.keys(dipilih).length + (lainnyaAktif ? 1 : 0);
      counter.textContent = n ? (n + ' lokasi dipilih') : 'Belum ada lokasi dipilih';
      var hidden = host.querySelector('input[type="hidden"][name="' + name + '"]');
      if (hidden) hidden.value = Object.keys(dipilih).join(',');
    }

    function beriSinyal() {
      perbaruiCounter();
      if (typeof opts.onChange === 'function') opts.onChange(getValue());
      var hidden = host.querySelector('input[type="hidden"][name="' + name + '"]');
      if (hidden && hidden.dispatchEvent) {
        try {
          hidden.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (e) {}
      }
    }

    function getValue() {
      var ids = Object.keys(dipilih);
      var nama = ids.map(function (id) {
        var l = masterById(id);
        return l ? l.nama : id;
      });
      var teksLain = lainnyaAktif ? String((inputLainnya ? inputLainnya.value : teksLainnya) || '').trim() : '';
      return {
        ids: ids,
        nama: nama,
        lainnya: teksLain,
        teks: payloadLokasi({ ids: ids, nama: nama, lainnya: teksLain }).lokasi
      };
    }

    function setValue(v) {
      dipilih = {};
      (v && v.ids ? v.ids : []).forEach(function (id) {
        dipilih[id] = true;
      });
      lainnyaAktif = !!(v && v.lainnya);
      teksLainnya = (v && v.lainnya) || '';
      if (inputLainnya) inputLainnya.value = teksLainnya;
      renderGrid();
    }

    host.addEventListener('change', function (e) {
      var t = e.target;
      if (t && t.hasAttribute && t.hasAttribute('data-lokasi-lainnya-toggle')) {
        lainnyaAktif = t.checked;
        if (opts.single && lainnyaAktif) {
          dipilih = {};
          renderGrid();
        }
        var kartuLain = host.querySelector('[data-lokasi-lainnya-kartu]');
        if (kartuLain) kartuLain.classList.toggle('active', lainnyaAktif);
        if (boxLainnya) boxLainnya.hidden = !lainnyaAktif;
        if (!lainnyaAktif) {
          if (inputLainnya) inputLainnya.value = '';
        } else {
          setTimeout(function () {
            if (inputLainnya) inputLainnya.focus();
          }, 30);
        }
        beriSinyal();
        return;
      }
      if (t && t.type === 'checkbox' && t.value && t.closest && t.closest('[data-lokasi-card]')) {
        if (opts.single) {
          dipilih = {};
          if (t.checked) {
            dipilih[t.value] = true;
            lainnyaAktif = false;
            if (inputLainnya) inputLainnya.value = '';
          }
          renderGrid();
          beriSinyal();
          return;
        }
        if (t.checked) dipilih[t.value] = true;
        else delete dipilih[t.value];
        var kartu = t.closest('[data-lokasi-card]');
        kartu.classList.toggle('active', t.checked);
        beriSinyal();
      }
    });

    host.addEventListener('input', function (e) {
      if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-lokasi-lainnya')) {
        teksLainnya = e.target.value;
        beriSinyal();
      }
    });

    host.addEventListener('click', function (e) {
      if (e.target.closest('[data-lokasi-semua]')) {
        daftarTampil().forEach(function (l) {
          dipilih[l.id] = true;
        });
        renderGrid();
        beriSinyal();
        return;
      }
      if (e.target.closest('[data-lokasi-reset]')) {
        dipilih = {};
        lainnyaAktif = false;
        if (inputLainnya) inputLainnya.value = '';
        renderGrid();
        beriSinyal();
      }
    });

    renderGrid();
    return {
      getValue: getValue,
      setValue: setValue,
      el: host
    };
  }

  /* ==================== KOMPONEN: PILIH ATLET ==================== */

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
    var daftar = (api.sumber ? api.sumber() : Shared.activeAthletes()) || [];
    var dipilih = {};
    api.getValue().forEach(function (id) {
      dipilih[id] = true;
    });
    var kueri = '';
    var mode = api.mode;

    var overlay = document.createElement('div');
    overlay.className = 'picker-overlay';
    overlay.innerHTML =
      '<div class="picker-pop" role="dialog" aria-modal="true" aria-label="Pilih atlet">' +
      '<div class="picker-pop-head">' +
      '<div class="picker-search">' + UI.icon('search', 18) +
      '<input type="search" data-picker-cari placeholder="Cari nama atau ID atlet..." aria-label="Cari atlet">' +
      '</div>' +
      '<button type="button" class="icon-btn" data-picker-tutup aria-label="Tutup">' + UI.icon('close', 20) + '</button>' +
      '</div>' +
      '<div class="picker-pop-chips" data-picker-chips></div>' +
      '<div class="picker-pop-tools">' +
      (mode === 'multi' ? '<button type="button" class="btn btn-sm btn-secondary" data-picker-semua>Pilih semua hasil pencarian</button>' : '') +
      '<button type="button" class="btn btn-sm btn-ghost" data-picker-reset>Hapus semua pilihan</button>' +
      '<span class="picker-counter" data-picker-counter></span>' +
      '</div>' +
      '<div class="picker-pop-list" data-picker-list></div>' +
      '<div class="picker-pop-foot">' +
      '<button type="button" class="btn picker-done" data-picker-selesai>Selesai</button>' +
      '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    document.body.classList.add('picker-open');

    var pop = overlay.querySelector('.picker-pop');
    var listHost = overlay.querySelector('[data-picker-list]');
    var chipsHost = overlay.querySelector('[data-picker-chips]');
    var counter = overlay.querySelector('[data-picker-counter]');
    var cari = overlay.querySelector('[data-picker-cari]');

    // Posisi panel: bottom sheet penuh di HP, dropdown di desktop.
    function posisikan() {
      var kecil = window.matchMedia && window.matchMedia('(max-width: 640px)').matches;
      pop.classList.toggle('sheet', kecil);
      if (kecil) {
        pop.style.top = '';
        pop.style.left = '';
        return;
      }
      var rect = api.trigger.getBoundingClientRect();
      var lebar = Math.min(420, window.innerWidth - 24);
      pop.style.width = lebar + 'px';
      var kiri = Math.max(12, Math.min(rect.left, window.innerWidth - lebar - 12));
      var bawah = rect.bottom + 8;
      var tinggiMaks = Math.max(280, window.innerHeight - bawah - 16);
      pop.style.left = kiri + 'px';
      pop.style.top = bawah + 'px';
      pop.style.maxHeight = Math.min(560, tinggiMaks) + 'px';
    }
    posisikan();

    function hasilFilter() {
      var q = kueri.trim().toLowerCase();
      if (!q) return daftar;
      return daftar.filter(function (a) {
        return String(a.nama || '').toLowerCase().indexOf(q) !== -1 ||
          String(a.id_atlet || '').toLowerCase().indexOf(q) !== -1;
      });
    }

    function renderChips() {
      var ids = Object.keys(dipilih);
      if (!ids.length) {
        chipsHost.innerHTML = '<span class="small muted">Belum ada atlet dipilih.</span>';
        return;
      }
      chipsHost.innerHTML = ids.map(function (id) {
        var a = cariAtlet(daftar, id);
        var nama = a ? a.nama : id;
        return '<span class="picker-chip">' + Utils.esc(nama) +
          '<button type="button" class="picker-chip-x" data-chip-hapus="' + Utils.esc(id) + '" aria-label="Hapus ' + Utils.esc(nama) + '">' +
          UI.icon('x', 14) + '</button></span>';
      }).join('');
    }

    function renderCounter() {
      var n = Object.keys(dipilih).length;
      counter.textContent = n + ' atlet dipilih';
    }

    function renderList() {
      var hasil = hasilFilter();
      if (!hasil.length) {
        listHost.innerHTML = '<div class="picker-kosong">Atlet tidak ditemukan</div>';
        return;
      }
      listHost.innerHTML = hasil.map(function (a) {
        var on = !!dipilih[a.id_atlet];
        return '<label class="picker-row' + (on ? ' active' : '') + '" data-row-atlet="' + Utils.esc(a.id_atlet) + '">' +
          '<input type="' + (mode === 'single' ? 'radio' : 'checkbox') + '"' +
          (mode === 'single' ? ' name="picker-atlet-satu"' : '') +
          ' value="' + Utils.esc(a.id_atlet) + '"' + (on ? ' checked' : '') + '>' +
          UI.avatar(a, 36) +
          '<span class="picker-row-teks"><b>' + Utils.esc(a.nama) + '</b>' +
          '<span class="small muted">' + Utils.esc(a.id_atlet) + '</span></span>' +
          '<span class="picker-row-check">' + UI.icon('check', 16) + '</span>' +
          '</label>';
      }).join('');
    }

    function render() {
      renderChips();
      renderCounter();
      renderList();
    }

    // Perbarui status centang tanpa membangun ulang daftar, supaya fokus
    // keyboard (Tab/Spasi) tidak hilang setiap kali mencentang.
    function perbaruiBaris() {
      renderChips();
      renderCounter();
      var rows = listHost.querySelectorAll('[data-row-atlet]');
      for (var i = 0; i < rows.length; i++) {
        var id = rows[i].getAttribute('data-row-atlet');
        var on = !!dipilih[id];
        rows[i].classList.toggle('active', on);
        var input = rows[i].querySelector('input');
        if (input) input.checked = on;
      }
    }

    function cariAtlet(daftarAtlet, id) {
      for (var i = 0; i < daftarAtlet.length; i++) {
        if (daftarAtlet[i].id_atlet === id) return daftarAtlet[i];
      }
      return null;
    }

    function terapkan() {
      var ids = Object.keys(dipilih);
      if (mode === 'single' && ids.length > 1) ids = ids.slice(0, 1);
      if (mode === 'pair' && ids.length > 2) ids = ids.slice(0, 2);
      api.setValue(ids);
    }

    function toggle(id, on) {
      if (mode === 'single') {
        dipilih = {};
        if (on) dipilih[id] = true;
        terapkan();
        render();
        tutupPanel();
        return;
      }
      if (on) {
        if (mode === 'pair' && Object.keys(dipilih).length >= 2 && !dipilih[id]) {
          Utils.toast('Pasangan ganda maksimal 2 atlet.', 'danger');
          perbaruiBaris();
          return;
        }
        dipilih[id] = true;
      } else {
        delete dipilih[id];
      }
      terapkan();
      perbaruiBaris();
    }

    render();

    panelAktif = { overlay: overlay, api: api, onResize: posisikan };
    window.addEventListener('resize', posisikan);

    setTimeout(function () {
      if (cari && cari.focus) cari.focus();
    }, 30);

    overlay.addEventListener('mousedown', function (e) {
      if (e.target === overlay) tutupPanel();
    });

    overlay.addEventListener('click', function (e) {
      if (e.target.closest('[data-picker-tutup]') || e.target.closest('[data-picker-selesai]')) {
        tutupPanel();
        return;
      }
      var chipX = e.target.closest('[data-chip-hapus]');
      if (chipX) {
        delete dipilih[chipX.getAttribute('data-chip-hapus')];
        terapkan();
        perbaruiBaris();
        return;
      }
      if (e.target.closest('[data-picker-semua]')) {
        hasilFilter().forEach(function (a) {
          dipilih[a.id_atlet] = true;
        });
        terapkan();
        perbaruiBaris();
        return;
      }
      if (e.target.closest('[data-picker-reset]')) {
        dipilih = {};
        terapkan();
        perbaruiBaris();
        return;
      }
      // Klik baris = klik label; centang diurus oleh event 'change' (satu
      // sumber kebenaran) supaya tidak dobel-toggle oleh aktivasi label.
    });

    overlay.addEventListener('change', function (e) {
      var t = e.target;
      if (t && t.value && t.closest && t.closest('[data-row-atlet]')) {
        toggle(t.value, t.checked || t.type === 'radio');
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

  // Komponen pilihan atlet dengan pencarian lalu centang.
  // host: elemen tujuan, opts: {
  //   mode: 'multi' | 'single' | 'pair', name, label, required, help,
  //   value: [idAtlet, ...], onChange
  // }
  function atlet(host, opts) {
    opts = opts || {};
    var mode = opts.mode || 'multi';
    var name = opts.name || 'id_atlet';
    var dipilih = [];
    (opts.value || []).forEach(function (id) {
      if (id && dipilih.indexOf(id) === -1) dipilih.push(id);
    });

    host.className = (host.className ? host.className + ' ' : '') + 'picker-atlet-host';
    host.innerHTML =
      '<div class="field">' +
      '<label class="label">' + Utils.esc(opts.label || 'Atlet') +
      (opts.required ? ' <span class="req">*</span>' : '') + '</label>' +
      '<button type="button" class="picker-trigger" data-picker-buka aria-haspopup="dialog">' +
      UI.icon('users', 20) +
      '<span class="picker-trigger-teks" data-picker-ringkas></span>' +
      '<span class="picker-trigger-panah"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></span>' +
      '</button>' +
      '<div class="picker-ringkas" data-picker-ringkas-kecil></div>' +
      (opts.help ? '<div class="help">' + Utils.esc(opts.help) + '</div>' : '') +
      '<div class="field-error" data-error-for="' + Utils.esc(name) + '"></div>' +
      '<input type="hidden" name="' + Utils.esc(name) + '" value="">' +
      '</div>';

    var trigger = host.querySelector('[data-picker-buka]');
    var ringkas = host.querySelector('[data-picker-ringkas]');
    var ringkasKecil = host.querySelector('[data-picker-ringkas-kecil]');
    var hidden = host.querySelector('input[type="hidden"][name="' + name + '"]');

    function namaAtlet(id) {
      var a = Store.findOne('athletes', function (x) {
        return x.id_atlet === id;
      });
      return a ? a.nama : id;
    }

    function renderRingkas() {
      hidden.value = dipilih.join(',');
      if (!dipilih.length) {
        ringkas.textContent = mode === 'single' ? 'Pilih atlet' : 'Pilih atlet (bisa lebih dari satu)';
        ringkasKecil.innerHTML = '';
        trigger.classList.remove('ada');
        return;
      }
      trigger.classList.add('ada');
      if (mode === 'single') {
        ringkas.textContent = namaAtlet(dipilih[0]) + ' (' + dipilih[0] + ')';
      } else {
        ringkas.textContent = dipilih.length + ' atlet dipilih';
      }
      ringkasKecil.innerHTML = dipilih.map(function (id) {
        return '<span class="picker-chip picker-chip-static">' + Utils.esc(namaAtlet(id)) +
          ' <b class="small muted">' + Utils.esc(id) + '</b>' +
          '<button type="button" class="picker-chip-x" data-ringkas-hapus="' + Utils.esc(id) + '" aria-label="Hapus ' + Utils.esc(namaAtlet(id)) + '">' +
          UI.icon('x', 14) + '</button></span>';
      }).join('');
    }

    function setValue(ids) {
      var sebelum = dipilih.join(',');
      dipilih = [];
      (ids || []).forEach(function (id) {
        if (id && dipilih.indexOf(id) === -1) dipilih.push(id);
      });
      if (mode === 'single' && dipilih.length > 1) dipilih = dipilih.slice(0, 1);
      if (mode === 'pair' && dipilih.length > 2) dipilih = dipilih.slice(0, 2);
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
      mode: mode,
      sumber: opts.sumber || null,
      trigger: trigger,
      el: host
    };

    trigger.addEventListener('click', function () {
      bukaPanel(api);
    });

    host.addEventListener('click', function (e) {
      var x = e.target.closest('[data-ringkas-hapus]');
      if (!x) return;
      e.preventDefault();
      var id = x.getAttribute('data-ringkas-hapus');
      setValue(dipilih.filter(function (v) {
        return v !== id;
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

  /* ==================== KELOLA LOKASI LATIHAN ==================== */

  // Kartu "Kelola Lokasi Latihan" untuk halaman Setting (Pelatih Kepala/Admin).
  function kelolaLokasi(host) {
    function render() {
      var daftar = masterSemua();
      host.innerHTML =
        '<p class="muted small">Daftar lokasi latihan untuk form absensi, logbook, dan menu lainnya. ' +
        'Lokasi yang dinonaktifkan tidak muncul di form isian baru, tetapi data lama tetap tampil.</p>' +
        '<div class="flex items-center justify-between flex-wrap gap-1 mb-2">' +
        '<span class="small muted">' + daftar.length + ' lokasi terdaftar</span>' +
        '<button type="button" class="btn btn-sm" data-lokasi-tambah>' + UI.icon('plus', 18) + ' Tambah Lokasi</button>' +
        '</div>' +
        (daftar.length ? '<div class="table-wrap"><table class="table"><thead><tr>' +
          '<th>Nama Lokasi</th><th>Status</th><th class="align-center">Aksi</th>' +
          '</tr></thead><tbody>' +
          daftar.map(function (l) {
            return '<tr>' +
              '<td><b>' + Utils.esc(l.nama) + '</b></td>' +
              '<td>' + UI.statusBadge(l.aktif === false ? 'nonaktif' : 'aktif') + '</td>' +
              '<td class="align-center"><div class="flex gap-1" style="justify-content:center;flex-wrap:wrap">' +
              '<button type="button" class="btn btn-sm btn-secondary" data-lokasi-edit="' + Utils.esc(l.id) + '">Edit</button>' +
              '<button type="button" class="btn btn-sm btn-ghost" data-lokasi-toggle="' + Utils.esc(l.id) + '">' +
              (l.aktif === false ? 'Aktifkan' : 'Nonaktifkan') + '</button>' +
              '<button type="button" class="btn btn-sm btn-danger" data-lokasi-hapus="' + Utils.esc(l.id) + '">Hapus</button>' +
              '</div></td></tr>';
          }).join('') + '</tbody></table></div>'
          : UI.emptyState('Belum ada lokasi latihan.', 'settings'));
    }

    function bukaForm(lok) {
      document.getElementById('modal-host').innerHTML =
        UI.modalShell('m-lokasi', lok ? 'Edit Lokasi Latihan' : 'Tambah Lokasi Latihan',
          UI.backButton({ closeModal: 'm-lokasi' }) +
          '<form id="form-lokasi" novalidate>' +
          UI.field({ name: 'nama', label: 'Nama Lokasi', required: true, value: lok ? lok.nama : '', placeholder: 'contoh: Lapangan Utama' }) +
          UI.field({
            name: 'aktif', label: 'Status', type: 'select', value: !lok || lok.aktif !== false ? '1' : '0',
            options: [{ value: '1', label: 'Aktif' }, { value: '0', label: 'Nonaktif' }]
          }) +
          '</form>',
          '<button type="button" class="btn btn-ghost" data-back-close="m-lokasi">Batal</button>' +
          '<button type="submit" class="btn" form="form-lokasi">Simpan Lokasi</button>');
      UI.openModal('m-lokasi');
      var form = document.getElementById('form-lokasi');
      UI.bindSubmit(form, function () {
        Utils.clearErrors(form);
        var d = Utils.formData(form);
        var errors = {};
        if (!d.nama || !String(d.nama).trim()) errors.nama = 'Nama lokasi wajib diisi.';
        var kembar = masterCariNama(d.nama);
        if (kembar && (!lok || kembar.id !== lok.id)) errors.nama = 'Lokasi sudah ada.';
        if (Object.keys(errors).length) {
          Utils.showErrors(form, errors);
          Utils.toast('Periksa kembali isian yang ditandai.', 'danger');
          return;
        }
        masterSimpan({
          nama: String(d.nama).trim(),
          aktif: d.aktif === '1'
        }, lok ? lok.id : null);
        UI.closeModal('m-lokasi');
        Utils.toast('Lokasi latihan berhasil disimpan.', 'success');
        render();
      });
    }

    render();

    host.addEventListener('click', function (e) {
      if (e.target.closest('[data-lokasi-tambah]')) {
        bukaForm(null);
        return;
      }
      var edit = e.target.closest('[data-lokasi-edit]');
      if (edit) {
        bukaForm(masterById(edit.getAttribute('data-lokasi-edit')));
        return;
      }
      var toggle = e.target.closest('[data-lokasi-toggle]');
      if (toggle) {
        var l = masterToggle(toggle.getAttribute('data-lokasi-toggle'));
        if (l) Utils.toast('Status lokasi diperbarui.', 'success');
        render();
        return;
      }
      var hapus = e.target.closest('[data-lokasi-hapus]');
      if (hapus) {
        var target = masterById(hapus.getAttribute('data-lokasi-hapus'));
        if (!target) return;
        UI.confirmDialog('Hapus lokasi "' + target.nama + '"? Data lama yang memakai lokasi ini tetap tersimpan.', 'Hapus Lokasi').then(function (ok) {
          if (!ok) return;
          masterHapus(target.id);
          Utils.toast('Lokasi latihan dihapus.', 'success');
          render();
        });
      }
    });
  }

  return {
    init: init,
    atlet: atlet,
    lokasi: lokasi,
    kelolaLokasi: kelolaLokasi,
    masterSemua: masterSemua,
    masterAktif: masterAktif,
    masterById: masterById,
    masterCariNama: masterCariNama,
    masterSimpan: masterSimpan,
    masterToggle: masterToggle,
    masterHapus: masterHapus,
    normalNama: normalNama,
    pastikanLokasi: pastikanLokasi,
    dedupLokasi: dedupLokasi,
    nilaiLokasi: nilaiLokasi,
    labelLokasi: labelLokasi,
    chipLokasi: chipLokasi,
    payloadLokasi: payloadLokasi,
    migrasiLokasi: migrasiLokasi
  };
})();
