var PagesLanding = (function () {
  var TABS = [
    { id: 'kontak', label: 'Kontak & Top Bar' },
    { id: 'hero', label: 'Hero' },
    { id: 'kolase', label: 'Foto Kolase Hero' },
    { id: 'galeri', label: 'Galeri Foto' },
    { id: 'marquee', label: 'Teks Berjalan' },
    { id: 'tentang', label: 'Tentang & Footer' },
    { id: 'merek', label: 'Logo & Merek' }
  ];

  var tabAktif = 'kontak';
  var draft = null;
  var tersimpan = null;
  var pageRoot = null;
  var simpanLock = 0;
  var belumSimpan = false;

  function tandaiBelumSimpan() {
    belumSimpan = true;
    App.setDirty(true);
    perbaruiStatusSimpan();
  }

  function clone(o) {
    return JSON.parse(JSON.stringify(o === undefined ? null : o)) || {};
  }

  function ambil() {
    if (!draft) {
      draft = LandingStore.get();
      tersimpan = LandingStore.get();
    }
    return draft;
  }

  function register() {
    App.register('landing-page', {
      title: 'Pengaturan Landing Page',
      subtitle: 'Ubah isi halaman Beranda tanpa mengedit kode',
      render: render
    });
  }

  function barSimpan() {
    return '<div class="sticky-save lp-simpan">' +
      '<div class="flex flex-wrap gap-1 items-center justify-between">' +
      '<button type="button" class="btn btn-sm btn-ghost" data-lp-reset>Kembalikan ke Default</button>' +
      '<div class="flex gap-1 items-center">' +
      '<span class="lp-status-simpan" data-lp-status>' + UI.icon('check', 16) + ' Tersimpan</span>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-lp-batal>Batalkan</button>' +
      '<button type="button" class="btn btn-sm" data-lp-simpan>' + UI.icon('save', 18) + ' Simpan Perubahan</button>' +
      '</div></div></div>';
  }

  // Perbarui label status simpan (Tersimpan / Belum disimpan).
  function perbaruiStatusSimpan() {
    var el = document.querySelector('[data-lp-status]');
    if (!el) return;
    if (belumSimpan) {
      el.className = 'lp-status-simpan belum';
      el.innerHTML = UI.icon('alert', 16) + ' Belum disimpan';
    } else {
      el.className = 'lp-status-simpan';
      el.innerHTML = UI.icon('check', 16) + ' Tersimpan';
    }
  }

  var IKON_UNGGAH = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2"/></svg>';

  function infoBerkas(nama, ukuran) {
    var kb = Math.round((Number(ukuran) || 0) / 1024);
    return (nama || 'foto') + ' · ' + (kb > 0 ? kb + ' KB' : 'ukuran tidak diketahui');
  }

  var TOMBOL_SINKRON = '<button type="button" class="btn btn-sm btn-secondary" data-lp-sinkron>' + UI.icon('refresh', 18) + ' Sinkronkan ke Cloud</button>';

  function slotFoto(key, file, caption, label, hideCaption, info) {
    var src = LandingStore.urlFoto(file);
    var ada = !!src;
    var rusak = !!file && !ada;   // nilai ada di data tapi gambar tidak bisa dimuat
    var infoTeks = rusak
      ? 'Foto tidak dapat dimuat di perangkat ini. Unggah ulang agar tampil di semua perangkat.'
      : (info || '');
    var media = '<div class="lp-foto-media' + (ada ? ' ada' : '') + '" data-lp-drop="' + key + '">' +
      '<div class="lp-foto-kosong">' + UI.icon(rusak ? 'alert' : 'users', 26) +
      '<span>' + (rusak ? 'Foto tidak dapat dimuat' : 'Belum ada foto') + '</span>' +
      '<span class="lp-foto-seret">atau seret foto ke area ini</span></div>' +
      (ada ? '<img data-lp-img src="' + Utils.esc(src) + '" alt="' + Utils.esc(label || 'Foto') + '">' : '') +
      '<div class="lp-foto-proses" data-lp-proses="' + key + '" hidden>' +
      '<div class="lp-spinner" aria-hidden="true"></div>' +
      '<span data-lp-proses-teks="1">Memproses...</span></div>' +
      '</div>';
    return '<div class="lp-foto" data-lp-foto="' + key + '">' +
      '<div class="lp-foto-label">' + Utils.esc(label) + '</div>' +
      media +
      '<div class="lp-foto-aksi">' +
      '<label class="btn lp-btn-unggah">' + IKON_UNGGAH + '<span data-lp-teks-unggah>' +
      (ada ? 'Ganti Foto' : (rusak ? 'Unggah Ulang' : 'Unggah Foto')) + '</span>' +
      '<input type="file" hidden accept="image/jpeg,image/jpg,image/png,image/webp" data-lp-file="' + key + '"></label>' +
      '<button type="button" class="btn lp-btn-hapus"' + (ada ? '' : ' disabled') + ' data-lp-hapus="' + key + '"><span data-lp-teks-hapus>Hapus</span></button>' +
      '</div>' +
      '<div class="lp-foto-info"' + (infoTeks ? '' : ' hidden') + ' data-lp-info="' + key + '">' + Utils.esc(infoTeks) + '</div>' +
      (hideCaption ? '' : UI.field({ name: 'caption_' + key, label: 'Caption singkat', value: caption || '' })) +
      '<div class="field-error" data-lp-error="' + key + '"></div>' +
      '</div>';
  }

  function pasangGambarLP(host) {
    if (!host || !host.querySelectorAll) return;
    var imgs = host.querySelectorAll('img[data-lp-img]');
    for (var i = 0; i < imgs.length; i++) {
      (function (img) {
        function ok() {
          img.classList.add('siap');
        }
        function fail() {
          img.classList.remove('siap');
          img.style.display = 'none';
          var media = img.closest ? img.closest('.lp-foto-media, .lp-galeri-thumb') : null;
          if (media) media.classList.remove('ada');
        }
        if (img.complete) {
          if (img.naturalWidth > 0) ok();
          else fail();
          return;
        }
        img.addEventListener('load', ok);
        img.addEventListener('error', fail);
      })(imgs[i]);
    }
  }

  // ---- Status proses per slot (cegah ganda, batal, & overlay macet) ----------
  var prosesAktif = {};   // key -> { batal: bool }

  function mulaiProsesUI(key, teks) {
    var el = document.querySelector('[data-lp-proses="' + key + '"]');
    if (el) {
      el.hidden = false;
      var t = el.querySelector('[data-lp-proses-teks]');
      if (t) t.textContent = teks || 'Memproses...';
    }
    var slot = document.querySelector('[data-lp-foto="' + key + '"]');
    if (slot) {
      var media = slot.querySelector('.lp-foto-media');
      if (media) media.classList.add('memproses');
      var label = slot.querySelector('.lp-btn-unggah');
      if (label) label.classList.add('nonaktif');
      var input = slot.querySelector('input[type="file"]');
      if (input) input.disabled = true;
      var teksUnggah = slot.querySelector('[data-lp-teks-unggah]');
      if (teksUnggah) teksUnggah.textContent = 'Memproses...';
      var tombolHapus = slot.querySelector('.lp-btn-hapus');
      if (tombolHapus) {
        tombolHapus.disabled = false;
        var teksHapus = tombolHapus.querySelector('[data-lp-teks-hapus]');
        if (teksHapus) teksHapus.textContent = 'Batalkan';
      }
    }
  }

  function ubahProsesUI(key, teks) {
    var t = document.querySelector('[data-lp-proses="' + key + '"] [data-lp-proses-teks]');
    if (t) t.textContent = teks || 'Memproses...';
    var el = document.querySelector('[data-lp-proses="' + key + '"]');
    if (el && el.hidden) el.hidden = false;
  }

  function selesaiProsesUI(key) {
    var el = document.querySelector('[data-lp-proses="' + key + '"]');
    if (el) {
      el.hidden = true;
      var t = el.querySelector('[data-lp-proses-teks]');
      if (t) t.textContent = 'Memproses...';
    }
    var slot = document.querySelector('[data-lp-foto="' + key + '"]');
    if (slot) {
      var media = slot.querySelector('.lp-foto-media');
      if (media) media.classList.remove('memproses');
      var label = slot.querySelector('.lp-btn-unggah');
      if (label) label.classList.remove('nonaktif');
      var input = slot.querySelector('input[type="file"]');
      if (input) input.disabled = false;
    }
  }

  function tampilkanError(key, pesan, tombolHtml) {
    var slot = document.querySelector('[data-lp-error="' + key + '"]');
    if (slot) {
      slot.innerHTML = pesan ? (Utils.esc(pesan) + (tombolHtml || '')) : '';
    }
    if (pesan) Utils.toast(pesan, 'danger');
  }

  function bersihkanError(key) {
    tampilkanError(key, '');
  }

  function withTimeout(janji, ms) {
    return new Promise(function (resolve, reject) {
      var t = setTimeout(function () {
        reject(new Error('Proses terlalu lama, coba foto yang lebih kecil.'));
      }, ms);
      janji.then(function (v) {
        clearTimeout(t);
        resolve(v);
      }, function (e) {
        clearTimeout(t);
        reject(e);
      });
    });
  }

  // Perbarui HANYA satu slot (tanpa render ulang tab) supaya cepat.
  function perbaruiSlot(key) {
    var slot = document.querySelector('[data-lp-foto="' + key + '"]');
    if (!slot) return;
    var d = ambil();
    var file = '';
    var info = '';
    if (key === 'logo') {
      file = d.merek.logo;
      info = d.merek.logo_info;
    } else if (key.indexOf('kolase_') === 0) {
      var i = parseInt(key.split('_')[1], 10);
      var k = (d.kolase || [])[i] || {};
      file = k.file;
      info = k.file_info;
    }
    var src = LandingStore.urlFoto(file);
    var rusak = !!file && !src;
    var media = slot.querySelector('.lp-foto-media');
    var img = slot.querySelector('img[data-lp-img]');
    if (src) {
      if (!img && media) {
        img = document.createElement('img');
        img.setAttribute('data-lp-img', '');
        img.alt = 'Foto';
        media.insertBefore(img, media.querySelector('.lp-foto-proses'));
      }
      if (img) {
        img.src = src;
        img.style.display = '';
        img.classList.add('siap');
      }
      if (media) media.classList.add('ada');
    } else {
      if (img && img.parentNode) img.parentNode.removeChild(img);
      if (media) media.classList.remove('ada');
    }
    var kosong = slot.querySelector('.lp-foto-kosong span');
    if (kosong) kosong.textContent = rusak ? 'Foto tidak dapat dimuat' : 'Belum ada foto';
    var teksUnggah = slot.querySelector('[data-lp-teks-unggah]');
    if (teksUnggah) teksUnggah.textContent = src ? 'Ganti Foto' : (rusak ? 'Unggah Ulang' : 'Unggah Foto');
    var tombolHapus = slot.querySelector('.lp-btn-hapus');
    if (tombolHapus && !prosesAktif[key]) {
      tombolHapus.disabled = !src;
      var teksHapus = tombolHapus.querySelector('[data-lp-teks-hapus]');
      if (teksHapus) teksHapus.textContent = 'Hapus';
    }
    var infoEl = slot.querySelector('[data-lp-info]');
    if (infoEl) {
      var infoTeks = rusak
        ? 'Foto tidak dapat dimuat di perangkat ini. Unggah ulang agar tampil di semua perangkat.'
        : (info || '');
      infoEl.textContent = infoTeks;
      infoEl.hidden = !infoTeks;
    }
    var errEl = slot.querySelector('[data-lp-error]');
    if (errEl && !errEl.textContent) errEl.textContent = '';
  }

  function render(root, user, app) {
    pageRoot = root;
    // Jangan buang draft yang belum disimpan bila halaman dirender ulang
    // (mis. oleh sinkron cloud) — foto & isian pengguna harus tetap ada.
    if (!draft || !belumSimpan) {
      draft = null;
      tersimpan = null;
      ambil();
    } else if (!tersimpan) {
      tersimpan = LandingStore.get();
    }
    if (draft && belumSimpan) {
      // App.render() menandai bersih sebelum render halaman; aktifkan lagi
      // agar peringatan "Data belum disimpan" tetap berlaku.
      App.setDirty(true);
    }
    root.innerHTML = '<div class="page">' +
      UI.pageHeader('Pengaturan Landing Page', 'Semua isi halaman Beranda bisa diubah dari sini.',
        '<a class="btn btn-secondary" href="index.html" target="_blank" rel="noopener">' + UI.icon('eye', 20) + ' Lihat Landing Page</a>') +
      UI.tabs(TABS, tabAktif) +
      '<div id="lp-body"></div>' +
      '</div>';

    var page = root.querySelector('.page');
    renderTab();

    page.addEventListener('click', function (e) {
      var tab = e.target.closest('[data-tab]');
      if (tab) {
        tabAktif = tab.getAttribute('data-tab');
        page.querySelectorAll('.tab').forEach(function (t) {
          t.classList.toggle('active', t === tab);
        });
        renderTab();
        return;
      }
      if (e.target.closest('[data-lp-simpan]')) {
        simpanTab();
        return;
      }
      if (e.target.closest('[data-lp-batal]')) {
        batalTab();
        return;
      }
      if (e.target.closest('[data-lp-reset]')) {
        resetTab();
        return;
      }
      if (e.target.closest('[data-lp-tambah-marquee]')) {
        tambahMarquee(page);
        return;
      }
      if (e.target.closest('[data-lp-tambah-galeri]')) {
        document.getElementById('lp-file-galeri').click();
        return;
      }
      var coba = e.target.closest('[data-lp-coba-lagi]');
      if (coba) {
        cobaLagiCloud(coba.getAttribute('data-lp-coba-lagi'));
        return;
      }
      var sinkron = e.target.closest('[data-lp-sinkron]');
      if (sinkron) {
        sinkronkanSemua(sinkron);
        return;
      }
      var hapus = e.target.closest('[data-lp-hapus]');
      if (hapus && !hapus.disabled) {
        var key = hapus.getAttribute('data-lp-hapus');
        if (prosesAktif[key]) {
          // Tombol berubah jadi "Batalkan" selama proses.
          prosesAktif[key].batal = true;
          delete prosesAktif[key];
          selesaiProsesUI(key);
          perbaruiSlot(key);
          Utils.toast('Proses foto dibatalkan.', 'info');
          return;
        }
        if (key.indexOf('kolase_') === 0) {
          var idx = parseInt(key.split('_')[1], 10);
          LandingStore.hapusFotoRef(ambil().kolase[idx].file);
          ambil().kolase[idx].file = '';
          ambil().kolase[idx].file_info = '';
          tandaiBelumSimpan();
          perbaruiSlot(key);
        } else if (key === 'logo') {
          LandingStore.hapusFotoRef(ambil().merek.logo);
          ambil().merek.logo = '';
          ambil().merek.logo_info = '';
          tandaiBelumSimpan();
          perbaruiSlot(key);
        } else if (key.indexOf('galeri_') === 0) {
          hapusGaleri(key.split('_')[1]);
        } else if (key.indexOf('marquee_') === 0) {
          var mi = parseInt(key.split('_')[1], 10);
          var list = ambil().marquee || [];
          if (mi >= 0 && mi < list.length) {
            list.splice(mi, 1);
            tandaiBelumSimpan();
            renderTab();
          }
        }
        return;
      }
      var up = e.target.closest('[data-lp-naik]');
      if (up) {
        geserItem(up.getAttribute('data-lp-naik'), parseInt(up.getAttribute('data-lp-idx'), 10), -1);
        return;
      }
      var down = e.target.closest('[data-lp-turun]');
      if (down) {
        geserItem(down.getAttribute('data-lp-turun'), parseInt(down.getAttribute('data-lp-idx'), 10), 1);
        return;
      }
      var utama = e.target.closest('[data-lp-utama]');
      if (utama) {
        ambil().galeri.forEach(function (g) {
          g.utama = (g.id === utama.getAttribute('data-lp-utama'));
        });
        tandaiBelumSimpan();
        renderTab();
        return;
      }
    });

    page.addEventListener('change', function (e) {
      var file = e.target.closest('[data-lp-file]');
      if (file) {
        unggahSatu(file);
        return;
      }
      var multi = e.target.closest('[data-lp-file-galeri]');
      if (multi) {
        unggahBanyak(multi);
        return;
      }
      var kategori = e.target.closest('[data-lp-kategori]');
      if (kategori) {
        var item = cariGaleri(kategori.getAttribute('data-lp-kategori'));
        if (item) {
          item.kategori = kategori.value;
          tandaiBelumSimpan();
        }
      }
    });

    page.addEventListener('input', function (e) {
      if (e.target.closest('#lp-body')) tandaiBelumSimpan();
      var judulEl = e.target.closest('[data-lp-judul]');
      if (judulEl) {
        var itJ = cariGaleri(judulEl.getAttribute('data-lp-judul'));
        if (itJ) itJ.judul = judulEl.value;
      }
      var ketEl = e.target.closest('[data-lp-keterangan]');
      if (ketEl) {
        var itK = cariGaleri(ketEl.getAttribute('data-lp-keterangan'));
        if (itK) itK.keterangan = ketEl.value;
      }
      var mq = e.target.closest('[data-lp-marquee-edit]');
      if (mq) {
        var idxMq = parseInt(mq.getAttribute('data-lp-marquee-edit'), 10);
        var listMq = ambil().marquee;
        if (listMq && !isNaN(idxMq) && idxMq >= 0 && idxMq < listMq.length) {
          listMq[idxMq] = mq.value;
        }
      }
    });

    // Seret-dan-lepas foto ke area pratinjau slot / area galeri.
    page.addEventListener('dragover', function (e) {
      var zona = e.target.closest ? e.target.closest('[data-lp-drop]') : null;
      if (!zona) return;
      e.preventDefault();
      zona.classList.add('seret');
    });
    page.addEventListener('dragleave', function (e) {
      var zona = e.target.closest ? e.target.closest('[data-lp-drop]') : null;
      if (zona) zona.classList.remove('seret');
    });
    page.addEventListener('drop', function (e) {
      var zona = e.target.closest ? e.target.closest('[data-lp-drop]') : null;
      if (!zona) return;
      e.preventDefault();
      zona.classList.remove('seret');
      var files = e.dataTransfer && e.dataTransfer.files;
      if (!files || !files.length) return;
      var key = zona.getAttribute('data-lp-drop');
      if (key === 'galeri') {
        unggahBanyakFotos(Array.prototype.slice.call(files));
      } else {
        unggahDariBerkas(key, files[0]);
      }
    });
  }

  function cariGaleri(id) {
    var list = ambil().galeri || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function hapusGaleri(id) {
    var d = ambil();
    var item = null;
    (d.galeri || []).forEach(function (g) {
      if (g.id === id) item = g;
    });
    if (item) LandingStore.hapusFotoRef(item.src || item.file);
    d.galeri = (d.galeri || []).filter(function (g) {
      return g.id !== id;
    });
    tandaiBelumSimpan();
    renderTab();
  }

  function geserItem(jenis, idx, arah) {
    var d = ambil();
    var list = jenis === 'galeri' ? d.galeri : d.marquee;
    var tujuan = idx + arah;
    if (tujuan < 0 || tujuan >= list.length) return;
    var tmp = list[idx];
    list[idx] = list[tujuan];
    list[tujuan] = tmp;
    tandaiBelumSimpan();
    renderTab();
  }

  function kartuGaleriHtml(g, i) {
    var srcG = LandingStore.urlFoto(g.src || g.file);
    return '<div class="lp-galeri-item" data-lp-galeri-item="' + Utils.esc(g.id) + '">' +
      '<div class="lp-galeri-thumb' + (srcG ? ' ada' : '') + '">' +
      '<div class="lp-foto-kosong">' + UI.icon('users', 22) + '<span>Tanpa foto</span></div>' +
      (srcG ? '<img data-lp-img src="' + Utils.esc(srcG) + '" alt="">' : '') +
      '</div>' +
      '<div class="lp-galeri-isi">' +
      '<input class="input" data-lp-judul="' + Utils.esc(g.id) + '" value="' + Utils.esc(g.judul || g.caption || '') + '" placeholder="Judul foto (contoh: Pelatih: Coach Budi)" aria-label="Judul foto">' +
      '<input class="input" data-lp-keterangan="' + Utils.esc(g.id) + '" value="' + Utils.esc(g.keterangan || '') + '" placeholder="Keterangan kecil (contoh: Pelatih Kepala)" aria-label="Keterangan foto">' +
      (g.file_info ? '<div class="lp-foto-info">' + Utils.esc(g.file_info) + '</div>' : '') +
      '<select class="input lp-galeri-kategori" data-lp-kategori="' + Utils.esc(g.id) + '" aria-label="Kategori foto">' +
      (CONFIG.LANDING_KATEGORI || []).map(function (k) {
        return '<option value="' + Utils.esc(k) + '"' + (g.kategori === k ? ' selected' : '') + '>' + Utils.esc(k) + '</option>';
      }).join('') + '</select>' +
      '<div class="lp-galeri-aksi">' +
      '<button type="button" class="btn btn-sm btn-ghost" data-lp-naik="galeri" data-lp-idx="' + i + '" aria-label="Naik">↑</button>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-lp-turun="galeri" data-lp-idx="' + i + '" aria-label="Turun">↓</button>' +
      '<button type="button" class="btn btn-sm btn-secondary" data-lp-utama="' + Utils.esc(g.id) + '">' + (g.utama ? 'Foto Utama' : 'Jadikan Utama') + '</button>' +
      '<button type="button" class="btn btn-sm btn-danger" data-lp-hapus="galeri_' + Utils.esc(g.id) + '">Hapus</button>' +
      '</div></div></div>';
  }

  // Tambahkan satu kartu galeri tanpa render ulang seluruh tab.
  function tambahKartuGaleri(g, idx) {
    var list = document.querySelector('.lp-galeri-list');
    if (!list) return;
    var wrap = document.createElement('div');
    wrap.innerHTML = kartuGaleriHtml(g, idx);
    var node = wrap.firstChild;
    if (node) {
      list.appendChild(node);
      pasangGambarLP(node);
    }
  }

  // Apakah referensi foto masih dipakai oleh data yang sudah tersimpan?
  // (agar foto yang dibebaskan tidak merusak data tersimpan)
  function refDiDataTersimpan(ref) {
    var t = tersimpan || {};
    if (!ref) return false;
    if (t.merek && t.merek.logo === ref) return true;
    var dipakai = false;
    (t.kolase || []).forEach(function (k) {
      if (k && k.file === ref) dipakai = true;
    });
    (t.galeri || []).forEach(function (g) {
      if (g && (g.src === ref || g.file === ref)) dipakai = true;
    });
    return dipakai;
  }

  // Tombol "Coba Lagi": unggah ulang foto lokal (idb:/data:) ke cloud.
  function cobaLagiCloud(key) {
    var d = ambil();
    var nilai = '';
    if (key === 'logo') nilai = d.merek.logo;
    else if (key.indexOf('kolase_') === 0) {
      var i = parseInt(key.split('_')[1], 10);
      nilai = (d.kolase[i] || {}).file || '';
    }
    if (!nilai || /^https?:/.test(String(nilai))) {
      tampilkanError(key, 'Tidak ada foto lokal yang perlu diunggah ulang.');
      return;
    }
    bersihkanError(key);
    prosesAktif[key] = { batal: false };
    mulaiProsesUI(key, 'Mengunggah ke cloud...');
    LandingStore.sinkronkanKeCloud(nilai, { folder: 'foto/landing', nama: 'foto.jpg' }).then(function (hasil) {
      if (prosesAktif[key]) delete prosesAktif[key];
      selesaiProsesUI(key);
      if (hasil.lokal) {
        tampilkanError(key, 'Masih gagal: ' + (hasil.galat || 'tidak diketahui') + ' — foto tetap tersimpan lokal.',
          '<div class="mt-1"><button type="button" class="btn btn-sm btn-secondary" data-lp-coba-lagi="' + Utils.esc(key) + '">Coba Lagi</button></div>');
        perbaruiSlot(key);
        return;
      }
      if (key === 'logo') {
        d.merek.logo = hasil.nilai;
      } else if (key.indexOf('kolase_') === 0) {
        var idx = parseInt(key.split('_')[1], 10);
        if (d.kolase[idx]) d.kolase[idx].file = hasil.nilai;
      }
      tandaiBelumSimpan();
      perbaruiSlot(key);
      Utils.toast('Foto berhasil disinkronkan ke cloud.', 'success');
    });
  }

  // Tombol "Sinkronkan ke Cloud": unggah semua foto lokal (draft + data
  // tersimpan) ke cloud, lalu perbarui nilainya menjadi URL publik.
  function sinkronkanSemua(btn) {
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Menyinkronkan...';
    }
    var d = ambil();
    function lokal(v) {
      return typeof v === 'string' && (v.indexOf('idb:') === 0 || v.indexOf('data:') === 0);
    }
    var antre = [];
    (d.kolase || []).forEach(function (k, i) {
      if (k && lokal(k.file)) antre.push({ key: 'kolase_' + i, nilai: k.file });
    });
    (d.galeri || []).forEach(function (g) {
      if (g && lokal(g.src || g.file)) antre.push({ key: 'galeri_' + g.id, nilai: g.src || g.file });
    });
    if (lokal(d.merek.logo)) antre.push({ key: 'logo', nilai: d.merek.logo });

    var sukses = 0;
    var galatTerakhir = '';
    var janji = Promise.resolve();
    antre.forEach(function (p) {
      janji = janji.then(function () {
        return LandingStore.sinkronkanKeCloud(p.nilai, { folder: 'foto/landing', nama: 'foto.jpg' }).then(function (hasil) {
          if (hasil.lokal) {
            galatTerakhir = hasil.galat || galatTerakhir;
            return;
          }
          sukses++;
          if (p.key === 'logo') {
            d.merek.logo = hasil.nilai;
          } else if (p.key.indexOf('kolase_') === 0) {
            var i = parseInt(p.key.split('_')[1], 10);
            if (d.kolase[i]) d.kolase[i].file = hasil.nilai;
          } else {
            var item = cariGaleri(p.key.slice(7));
            if (item) item.src = hasil.nilai;
          }
        });
      });
    });

    janji.then(function () {
      // Data tersimpan yang masih lokal ikut disinkronkan.
      return LandingStore.sinkronkanSemuaLokal('foto/landing');
    }).then(function (hasil) {
      if (sukses) tandaiBelumSimpan();
      renderTab();
      var totalSukses = sukses + (hasil ? hasil.sukses : 0);
      var totalGagal = (hasil ? hasil.gagal : 0) + (galatTerakhir ? 1 : 0);
      if (totalSukses) {
        Utils.toast(totalSukses + ' foto berhasil disinkronkan ke cloud.' +
          (totalGagal ? ' ' + totalGagal + ' gagal.' : ''), totalGagal ? 'info' : 'success');
      } else if (!antre.length && hasil && hasil.semua) {
        // Bukan error — memang tidak ada yang perlu disinkronkan.
        Utils.toast('Semua foto sudah tersinkron.', 'info');
      } else if (!antre.length && !hasil) {
        Utils.toast('Semua foto sudah tersinkron.', 'info');
      } else {
        Utils.toast('Gagal sinkron ke cloud: ' + (galatTerakhir || (hasil && hasil.pesan) || 'tidak diketahui'), 'danger');
      }
    }, function () {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Sinkronkan ke Cloud';
      }
      Utils.toast('Gagal menyinkronkan ke cloud.', 'danger');
    });
  }

  function unggahSatu(input) {
    var file = input.files && input.files[0];
    if (!file) return;
    var key = input.getAttribute('data-lp-file');
    input.value = '';
    unggahDariBerkas(key, file);
  }

  function unggahDariBerkas(key, file) {
    if (!file) return;
    if (prosesAktif[key]) return;   // cegah proses ganda pada slot yang sama
    var token = { batal: false };
    prosesAktif[key] = token;
    bersihkanError(key);
    mulaiProsesUI(key, 'Membaca foto...');

    var janji = LandingStore.bacaFoto(file, {
      onTahap: function (t) {
        if (!token.batal) ubahProsesUI(key, t);
      }
    }).then(function (f) {
      if (token.batal) throw new Error('DIBATALKAN');
      ubahProsesUI(key, 'Menyimpan...');
      // Simpan ke penyimpanan terpusat (cloud) — URL publik yang dipakai
      // sebagai src, sehingga tampil di semua perangkat tanpa login.
      return LandingStore.simpanFoto(f.blob, {
        folder: 'foto/landing',
        nama: f.nama || file.name || 'foto.jpg'
      }).then(function (hasil) {
        return { hasil: hasil, info: infoBerkas(f.nama || file.name, f.ukuran) };
      });
    }).then(function (bungkus) {
      if (token.batal) {
        LandingStore.hapusFotoRef(bungkus.hasil.nilai);
        return;
      }
      var hasil = bungkus.hasil;
      var d = ambil();
      if (key === 'logo') {
        if (d.merek.logo && d.merek.logo !== hasil.nilai && !refDiDataTersimpan(d.merek.logo)) {
          LandingStore.hapusFotoRef(d.merek.logo);
        }
        d.merek.logo = hasil.nilai;
        d.merek.logo_info = bungkus.info;
      } else if (key.indexOf('kolase_') === 0) {
        var i = parseInt(key.split('_')[1], 10);
        if (!d.kolase[i]) d.kolase[i] = { file: '', caption: '', alt: '' };
        if (d.kolase[i].file && d.kolase[i].file !== hasil.nilai && !refDiDataTersimpan(d.kolase[i].file)) {
          LandingStore.hapusFotoRef(d.kolase[i].file);
        }
        d.kolase[i].file = hasil.nilai;
        d.kolase[i].file_info = bungkus.info;
        if (!d.kolase[i].caption) d.kolase[i].caption = String(file.name || '').replace(/\.[^.]+$/, '');
        if (!d.kolase[i].alt) d.kolase[i].alt = file.name || '';
      }
      tandaiBelumSimpan();
      perbaruiSlot(key);   // hanya slot ini yang diperbarui
      if (hasil.lokal) {
        // Jangan berpura-pura berhasil: foto tersimpan lokal, alasannya jelas.
        tampilkanError(key,
          'Gagal unggah ke cloud: ' + (hasil.galat || 'tidak diketahui') + ' — foto sementara hanya di perangkat ini.',
          '<div class="mt-1"><button type="button" class="btn btn-sm btn-secondary" data-lp-coba-lagi="' + Utils.esc(key) + '">Coba Lagi</button></div>');
      } else {
        Utils.toast('Foto tersimpan di cloud dan tampil di semua perangkat.', 'success');
      }
    });

    withTimeout(janji, 15000).catch(function (err) {
      if (err && err.message === 'DIBATALKAN') return;
      if (err && /terlalu lama/.test(err.message)) token.batal = true;
      tampilkanError(key, err && err.message ? err.message : 'Gagal memproses foto.');
    }).then(function () {
      // finally: overlay & tombol SELALU dikembalikan, baik sukses/gagal/batal
      if (prosesAktif[key] === token) delete prosesAktif[key];
      selesaiProsesUI(key);
      perbaruiSlot(key);
    });
  }

  function unggahBanyak(input) {
    var files = Array.prototype.slice.call(input.files || []);
    input.value = '';
    unggahBanyakFotos(files);
  }

  function mulaiProsesGaleri(teks) {
    var el = document.querySelector('[data-lp-proses="galeri"]');
    if (el) {
      el.hidden = false;
      var t = el.querySelector('[data-lp-proses-teks]');
      if (t) t.textContent = teks;
    }
  }

  function ubahProsesGaleri(teks) {
    var t = document.querySelector('[data-lp-proses="galeri"] [data-lp-proses-teks]');
    if (t) t.textContent = teks;
  }

  function selesaiProsesGaleri() {
    var el = document.querySelector('[data-lp-proses="galeri"]');
    if (el) {
      el.hidden = true;
      var t = el.querySelector('[data-lp-proses-teks]');
      if (t) t.textContent = 'Memproses...';
    }
  }

  function unggahBanyakFotos(files) {
    if (!files || !files.length) return;
    if (prosesAktif['galeri']) return;
    var token = { batal: false };
    prosesAktif['galeri'] = token;
    bersihkanError('galeri');
    var total = files.length;
    var berjalan = 0;
    var gagal = [];
    var galatCloud = [];
    var lokalSaja = 0;
    mulaiProsesGaleri('Memproses 0 dari ' + total);

    function satu(f) {
      if (token.batal) return Promise.resolve();
      berjalan++;
      ubahProsesGaleri('Memproses ' + berjalan + ' dari ' + total);
      return LandingStore.bacaFoto(f).then(function (res) {
        if (token.batal) return null;
        return LandingStore.simpanFoto(res.blob, {
          folder: 'foto/galeri',
          nama: res.nama || f.name || 'galeri.jpg'
        }).then(function (hasil) {
          return { hasil: hasil, res: res };
        });
      }).then(function (bungkus) {
        if (!bungkus) return;
        if (token.batal) {
          LandingStore.hapusFotoRef(bungkus.hasil.nilai);
          return;
        }
        if (bungkus.hasil.lokal) {
          lokalSaja++;
          galatCloud.push((f && f.name ? f.name : 'foto') + ': ' + (bungkus.hasil.galat || 'tidak diketahui'));
        }
        var d = ambil();
        var item = {
          id: 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          src: bungkus.hasil.nilai,
          file_info: infoBerkas(bungkus.res.nama || f.name, bungkus.res.ukuran),
          judul: String(bungkus.res.nama || f.name || '').replace(/\.[^.]+$/, ''),
          keterangan: '',
          kategori: 'Atlet'
        };
        d.galeri.push(item);
        tandaiBelumSimpan();
        tambahKartuGaleri(item, d.galeri.length - 1);
      }).catch(function (err) {
        gagal.push((f && f.name ? f.name : 'foto') + ': ' + (err && err.message ? err.message : 'gagal diproses'));
      });
    }

    // Paralel terbatas: maksimal 2 foto sekaligus.
    var antre = files.slice();
    function pekerja() {
      if (token.batal || !antre.length) return Promise.resolve();
      var f = antre.shift();
      return satu(f).then(pekerja);
    }
    Promise.all([pekerja(), pekerja()]).then(function () {
      if (prosesAktif['galeri'] === token) delete prosesAktif['galeri'];
      selesaiProsesGaleri();
      var gabung = gagal.concat(galatCloud);
      if (gabung.length) {
        tampilkanError('galeri', 'Sebagian foto gagal: ' + gabung.join(' | '),
          '<div class="mt-1"><button type="button" class="btn btn-sm btn-secondary" data-lp-sinkron>Coba Lagi / Sinkronkan ke Cloud</button></div>');
      }
      var sukses = total - gagal.length;
      if (token.batal) {
        Utils.toast('Pengunggahan foto galeri dibatalkan.', 'info');
      } else if (sukses > 0) {
        var pesan = sukses + ' foto galeri berhasil ditambahkan.' +
          (gagal.length ? ' ' + gagal.length + ' gagal diproses.' : '') +
          (lokalSaja ? ' ' + lokalSaja + ' foto belum terunggah ke cloud (lokal).' : '');
        Utils.toast(pesan, gabung.length ? 'info' : 'success');
      }
    });
  }

  function bacaForm() {
    var form = document.getElementById('lp-body');
    if (!form) return;
    var d = ambil();
    function val(n) {
      var el = form.querySelector('[name="' + n + '"]');
      return el ? el.value.trim() : '';
    }
    if (tabAktif === 'kontak') {
      d.kontak.phone = val('phone');
      d.kontak.phoneLink = val('phoneLink');
      d.kontak.email = val('email');
      d.kontak.alamatSingkat = val('alamatSingkat');
      (d.sosmed || []).forEach(function (s, i) {
        s.url = val('sosmed_' + i);
      });
    } else if (tabAktif === 'hero') {
      d.hero.badge = val('badge');
      d.hero.judul1 = val('judul1');
      d.hero.judul2 = val('judul2');
      d.hero.subjudul = val('subjudul');
      d.hero.deskripsi = val('deskripsi');
      d.hero.tombolUtama = val('tombolUtama');
      d.hero.tombolKedua = val('tombolKedua');
      d.hero.tombolNavbar = val('tombolNavbar');
    } else if (tabAktif === 'kolase') {
      (d.kolase || []).forEach(function (k, i) {
        k.caption = val('caption_kolase_' + i);
        if (k.caption && !k.alt) k.alt = k.caption;
      });
    } else if (tabAktif === 'tentang') {
      d.tentang.judul = val('judul');
      d.tentang.teks1 = val('teks1');
      d.tentang.teks2 = val('teks2');
      d.tentang.judulKartu = val('judulKartu');
      d.tentang.langkah1 = val('langkah1');
      d.tentang.langkah2 = val('langkah2');
      d.tentang.langkah3 = val('langkah3');
      d.tentang.jam = val('jam');
      d.tentang.lokasi = val('lokasi');
      d.tentang.tombol = val('tombol');
      d.footer.teks = val('footerTeks');
      d.footer.hakCipta = val('hakCipta');
    } else if (tabAktif === 'merek') {
      d.merek.nama = val('nama');
      d.merek.sub = val('sub');
    }
  }

  function dataValidasi() {
    var d = ambil();
    if (tabAktif === 'kontak') {
      return {
        phone: d.kontak.phone,
        email: d.kontak.email,
        alamatSingkat: d.kontak.alamatSingkat,
        sosmedList: d.sosmed || []
      };
    }
    return d[tabAktif] || {};
  }

  function simpanTab() {
    var now = Date.now();
    if (now - simpanLock < 700) return;
    simpanLock = now;
    bacaForm();
    var errors = LandingStore.validasiBagian(tabAktif, dataValidasi());
    if (errors.length) {
      simpanLock = 0;
      Utils.toast(errors[0], 'danger');
      var host = document.getElementById('lp-body');
      if (host) {
        var box = host.querySelector('.lp-error-box');
        if (box) {
          box.hidden = false;
          box.innerHTML = errors.map(function (e) {
            return '<div>' + Utils.esc(e) + '</div>';
          }).join('');
        }
      }
      return;
    }
    try {
      var nilai = tabAktif === 'kontak' ? { kontak: draft.kontak, sosmed: draft.sosmed }
        : tabAktif === 'tentang' ? { tentang: draft.tentang, footer: draft.footer }
          : null;
      if (nilai) {
        Object.keys(nilai).forEach(function (k) {
          LandingStore.saveBagian(k, nilai[k]);
        });
      } else {
        LandingStore.saveBagian(tabAktif, draft[tabAktif]);
      }
      tersimpan = LandingStore.get();
      draft = LandingStore.get();
      belumSimpan = false;
      App.setDirty(false);
      perbaruiStatusSimpan();
      Utils.toast('Perubahan berhasil disimpan', 'success');
      renderTab();
    } catch (e) {
      simpanLock = 0;
      Utils.toast(e.message, 'danger');
    }
  }

  function batalTab() {
    var d = tersimpan;
    if (tabAktif === 'kontak') {
      draft.kontak = clone(d.kontak);
      draft.sosmed = clone(d.sosmed);
    } else if (tabAktif === 'tentang') {
      draft.tentang = clone(d.tentang);
      draft.footer = clone(d.footer);
    } else {
      draft[tabAktif] = clone(d[tabAktif]);
    }
      belumSimpan = false;
      App.setDirty(false);
      perbaruiStatusSimpan();
    renderTab();
    Utils.toast('Perubahan dibatalkan.', 'info');
  }

  function resetTab() {
    UI.confirmDialog('Kembalikan isi "' + (TABS.filter(function (t) {
      return t.id === tabAktif;
    })[0] || {}).label + '" ke bawaan pabrik? Perubahan akan langsung disimpan.', 'Kembalikan ke Default').then(function (ok) {
      if (!ok) return;
      var def = LandingStore.defaults();
      // Bersihkan foto lokal yang tersimpan di bagian ini (setelah konfirmasi).
      var lama = ambil();
      if (tabAktif === 'kolase') {
        (lama.kolase || []).forEach(function (k) {
          LandingStore.hapusFotoRef(k && k.file);
        });
      } else if (tabAktif === 'galeri') {
        (lama.galeri || []).forEach(function (g) {
          LandingStore.hapusFotoRef(g && (g.src || g.file));
        });
      } else if (tabAktif === 'merek') {
        LandingStore.hapusFotoRef(lama.merek && lama.merek.logo);
      }
      if (tabAktif === 'kontak') {
        draft.kontak = clone(def.kontak);
        draft.sosmed = clone(def.sosmed);
        LandingStore.saveBagian('kontak', draft.kontak);
        LandingStore.saveBagian('sosmed', draft.sosmed);
      } else if (tabAktif === 'tentang') {
        draft.tentang = clone(def.tentang);
        draft.footer = clone(def.footer);
        LandingStore.saveBagian('tentang', draft.tentang);
        LandingStore.saveBagian('footer', draft.footer);
      } else {
        draft[tabAktif] = clone(def[tabAktif]);
        LandingStore.saveBagian(tabAktif, draft[tabAktif]);
      }
      tersimpan = LandingStore.get();
      belumSimpan = false;
      App.setDirty(false);
      perbaruiStatusSimpan();
      Utils.toast('Perubahan berhasil disimpan', 'success');
      renderTab();
    });
  }

  function tambahMarquee(page) {
    var input = page.querySelector('#lp-marquee-baru');
    var nilai = input ? input.value.trim() : '';
    if (!nilai) {
      Utils.toast('Isi kata/frasa yang ingin ditambahkan.', 'danger');
      return;
    }
    ambil().marquee.push(nilai);
    tandaiBelumSimpan();
    renderTab();
  }

  function renderTab() {
    var body = document.getElementById('lp-body');
    if (!body) return;
    var d = ambil();
    var html = '<div class="lp-error-box" hidden></div>';

    if (tabAktif === 'kontak') {
      html += '<div class="card lp-kartu">' +
        '<div class="card-title">' + UI.icon('user', 20) + 'Kontak & Top Bar</div>' +
        '<div class="form-grid cols-2">' +
        UI.field({ name: 'phone', label: 'Nomor Telepon / WhatsApp',  value: d.kontak.phone, help: 'contoh: 0812-3456-7890' }) +
        UI.field({ name: 'phoneLink', label: 'Nomor untuk tautan telepon', value: d.kontak.phoneLink, help: 'contoh: +6281234567890' }) +
        UI.field({ name: 'email', label: 'Email',  value: d.kontak.email, type: 'email' }) +
        UI.field({ name: 'alamatSingkat', label: 'Alamat Singkat (Top Bar)',  value: d.kontak.alamatSingkat, help: 'contoh: Surabaya' }) +
        '</div>' +
        '<h4 class="mt-2">Tautan Media Sosial</h4>' +
        '<p class="muted small">Kosongkan kolom untuk menyembunyikan ikon yang bersangkutan.</p>' +
        (d.sosmed || []).map(function (s, i) {
          return UI.field({ name: 'sosmed_' + i, label: 'Tautan ' + s.nama, value: s.url, placeholder: 'https://...' });
        }).join('') +
        '</div>' + barSimpan();

    } else if (tabAktif === 'hero') {
      html += '<div class="card lp-kartu">' +
        '<div class="card-title">' + UI.icon('star', 20) + 'Hero (Bagian Utama)</div>' +
        UI.field({ name: 'badge', label: 'Teks Badge',  value: d.hero.badge }) +
        '<div class="form-grid cols-2">' +
        UI.field({ name: 'judul1', label: 'Judul Baris 1',  value: d.hero.judul1 }) +
        UI.field({ name: 'judul2', label: 'Judul Baris 2 (gradasi)',  value: d.hero.judul2 }) +
        UI.field({ name: 'subjudul', label: 'Subjudul',  value: d.hero.subjudul }) +
        UI.field({ name: 'tombolNavbar', label: 'Teks Tombol Navbar',  value: d.hero.tombolNavbar }) +
        UI.field({ name: 'tombolUtama', label: 'Teks Tombol Utama',  value: d.hero.tombolUtama }) +
        UI.field({ name: 'tombolKedua', label: 'Teks Tombol Kedua',  value: d.hero.tombolKedua }) +
        '</div>' +
        UI.field({ name: 'deskripsi', label: 'Paragraf Deskripsi',  type: 'textarea', rows: 4, value: d.hero.deskripsi }) +
        '</div>' + barSimpan();

    } else if (tabAktif === 'kolase') {
      html += '<div class="card lp-kartu">' +
        '<div class="card-title">' + UI.icon('users', 20) + 'Foto Kolase Hero (4 Foto)</div>' +
        '<p class="muted small">Format JPG, JPEG, PNG, atau WEBP. Ukuran file asli maksimal 10 MB, otomatis dikompres hingga hasil di bawah 2 MB (maks. lebar 1600px). Bisa juga menyeret foto ke area pratinjau.</p>' +
        '<div class="mb-2">' + TOMBOL_SINKRON + '</div>' +
        '<div class="lp-foto-grid">' +
        (d.kolase || []).map(function (k, i) {
          return slotFoto('kolase_' + i, k.file, k.caption, 'Foto ' + (i + 1) + (i === 0 ? ' (Utama)' : ''), false, k.file_info);
        }).join('') +
        '</div></div>' + barSimpan();

    } else if (tabAktif === 'galeri') {
      html += '<div class="card lp-kartu">' +
        '<div class="card-title">' + UI.icon('users', 20) + 'Galeri Foto</div>' +
        '<div class="flex flex-wrap gap-1 items-center mb-2">' +
        '<label class="btn btn-secondary">' + IKON_UNGGAH + '<span>Tambah Foto (boleh lebih dari satu)</span>' +
        '<input type="file" hidden multiple accept="image/jpeg,image/jpg,image/png,image/webp" data-lp-file-galeri id="lp-file-galeri"></label>' +
        '<button type="button" class="btn btn-ghost" data-lp-tambah-galeri>Pilih dari Penjelajah</button>' +
        TOMBOL_SINKRON +
        '<div class="lp-foto-proses lp-proses-inline" data-lp-proses="galeri" hidden>' +
        '<div class="lp-spinner" aria-hidden="true"></div>' +
        '<span data-lp-proses-teks>Memproses...</span></div>' +
        '</div>' +
        '<p class="muted small">Format JPG, JPEG, PNG, WEBP. Ukuran file asli maksimal 10 MB per foto, otomatis dikompres hingga hasil di bawah 2 MB. Bisa juga menyeret foto ke daftar di bawah.</p>' +
        '<div class="field-error" data-lp-error="galeri"></div>' +
        '<div class="lp-galeri-list" data-lp-drop="galeri">' +
        (d.galeri || []).map(function (g, i) {
          return kartuGaleriHtml(g, i);
        }).join('') +
        '</div></div>' + barSimpan();

    } else if (tabAktif === 'marquee') {
      html += '<div class="card lp-kartu">' +
        '<div class="card-title">' + UI.icon('activity', 20) + 'Teks Berjalan (Marquee)</div>' +
        '<div class="flex gap-1 mb-2">' +
        '<input class="input" id="lp-marquee-baru" placeholder="contoh: Prestasi Juara">' +
        '<button type="button" class="btn btn-sm" data-lp-tambah-marquee>' + UI.icon('plus', 18) + ' Tambah</button>' +
        '</div>' +
        '<div class="lp-marquee-list">' +
        (d.marquee || []).map(function (m, i) {
          return '<div class="lp-marquee-item">' +
            '<input class="input grow" data-lp-marquee-edit="' + i + '" value="' + Utils.esc(m) + '" placeholder="Teks berjalan" aria-label="Ubah frasa ke-' + (i + 1) + '">' +
            '<button type="button" class="btn btn-sm btn-ghost" data-lp-naik="marquee" data-lp-idx="' + i + '" aria-label="Naik">↑</button>' +
            '<button type="button" class="btn btn-sm btn-ghost" data-lp-turun="marquee" data-lp-idx="' + i + '" aria-label="Turun">↓</button>' +
            '<button type="button" class="btn btn-sm btn-danger" data-lp-hapus="marquee_' + i + '">Hapus</button>' +
            '</div>';
        }).join('') +
        '</div></div>' + barSimpan();

    } else if (tabAktif === 'tentang') {
      html += '<div class="card lp-kartu">' +
        '<div class="card-title">' + UI.icon('info', 20) + 'Tentang &amp; Footer</div>' +
        UI.field({ name: 'judul', label: 'Judul Section Tentang',  value: d.tentang.judul }) +
        UI.field({ name: 'teks1', label: 'Paragraf Tentang (1)',  type: 'textarea', rows: 4, value: d.tentang.teks1 }) +
        UI.field({ name: 'teks2', label: 'Paragraf Tentang (2)', type: 'textarea', rows: 3, value: d.tentang.teks2 }) +
        '<div class="form-grid cols-2">' +
        UI.field({ name: 'jam', label: 'Jam / Jadwal Latihan',  value: d.tentang.jam }) +
        UI.field({ name: 'lokasi', label: 'Lokasi Latihan',  value: d.tentang.lokasi }) +
        UI.field({ name: 'judulKartu', label: 'Judul Kartu "Cara kerjanya"', value: d.tentang.judulKartu }) +
        UI.field({ name: 'tombol', label: 'Teks Tombol Tentang', value: d.tentang.tombol }) +
        '</div>' +
        UI.field({ name: 'langkah1', label: 'Langkah 1 (Judul|Isi)', value: d.tentang.langkah1 }) +
        UI.field({ name: 'langkah2', label: 'Langkah 2 (Judul|Isi)', value: d.tentang.langkah2 }) +
        UI.field({ name: 'langkah3', label: 'Langkah 3 (Judul|Isi)', value: d.tentang.langkah3 }) +
        '<h4 class="mt-2">Footer</h4>' +
        UI.field({ name: 'footerTeks', label: 'Teks Footer', type: 'textarea', rows: 2, value: d.footer.teks }) +
        UI.field({ name: 'hakCipta', label: 'Teks Hak Cipta', value: d.footer.hakCipta }) +
        '</div>' + barSimpan();

    } else if (tabAktif === 'merek') {
      html += '<div class="card lp-kartu">' +
        '<div class="card-title">' + UI.icon('star', 20) + 'Logo &amp; Merek</div>' +
        '<div class="form-grid cols-2">' +
        UI.field({ name: 'nama', label: 'Nama Klub (Navbar)',  value: d.merek.nama }) +
        UI.field({ name: 'sub', label: 'Teks Kecil (Navbar)',  value: d.merek.sub }) +
        '</div>' +
        slotFoto('logo', d.merek.logo, '', 'Logo Klub', true, d.merek.logo_info) +
        '<div class="mt-2">' + TOMBOL_SINKRON + '</div>' +
        '</div>' + barSimpan();
    }

    body.innerHTML = html;
    pasangGambarLP(body);
    perbaruiStatusSimpan();
  }

  return {
    register: register
  };
})();
