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
      '<div class="flex gap-1">' +
      '<button type="button" class="btn btn-sm btn-ghost" data-lp-batal>Batalkan</button>' +
      '<button type="button" class="btn btn-sm" data-lp-simpan>' + UI.icon('save', 18) + ' Simpan Perubahan</button>' +
      '</div></div></div>';
  }

  var IKON_UNGGAH = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2"/></svg>';

  function infoBerkas(nama, ukuran) {
    var kb = Math.round((Number(ukuran) || 0) / 1024);
    return (nama || 'foto') + ' · ' + (kb > 0 ? kb + ' KB' : 'ukuran tidak diketahui');
  }

  function slotFoto(key, file, caption, label, hideCaption, info) {
    var src = LandingStore.urlFoto(file);
    var ada = !!src;
    var media = '<div class="lp-foto-media' + (ada ? ' ada' : '') + '" data-lp-drop="' + key + '">' +
      '<div class="lp-foto-kosong">' + UI.icon('users', 26) + '<span>Belum ada foto</span>' +
      '<span class="lp-foto-seret">atau seret foto ke area ini</span></div>' +
      (ada ? '<img data-lp-img src="' + Utils.esc(src) + '" alt="' + Utils.esc(label || 'Foto') + '">' : '') +
      '<div class="lp-foto-proses" data-lp-proses="' + key + '" hidden>Memproses...</div>' +
      '</div>';
    return '<div class="lp-foto" data-lp-foto="' + key + '">' +
      '<div class="lp-foto-label">' + Utils.esc(label) + '</div>' +
      media +
      '<div class="lp-foto-aksi">' +
      '<label class="btn lp-btn-unggah">' + IKON_UNGGAH + '<span>' + (ada ? 'Ganti Foto' : 'Unggah Foto') + '</span>' +
      '<input type="file" hidden accept="image/jpeg,image/jpg,image/png,image/webp" data-lp-file="' + key + '"></label>' +
      '<button type="button" class="btn lp-btn-hapus"' + (ada ? '' : ' disabled') + ' data-lp-hapus="' + key + '">Hapus</button>' +
      '</div>' +
      '<div class="lp-foto-info"' + (info ? '' : ' hidden') + ' data-lp-info="' + key + '">' + Utils.esc(info || '') + '</div>' +
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

  function tampilkanProses(key, tampil) {
    var el = document.querySelector('[data-lp-proses="' + key + '"]');
    if (el) el.hidden = !tampil;
  }

  function tampilkanError(key, pesan) {
    var slot = document.querySelector('[data-lp-error="' + key + '"]');
    if (slot) slot.textContent = pesan || '';
    if (pesan) Utils.toast(pesan, 'danger');
  }

  function bersihkanError(key) {
    tampilkanError(key, '');
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
      var hapus = e.target.closest('[data-lp-hapus]');
      if (hapus && !hapus.disabled) {
        var key = hapus.getAttribute('data-lp-hapus');
        if (key.indexOf('kolase_') === 0) {
          var idx = parseInt(key.split('_')[1], 10);
          LandingStore.hapusFotoRef(ambil().kolase[idx].file);
          ambil().kolase[idx].file = '';
          ambil().kolase[idx].file_info = '';
          tandaiBelumSimpan();
          renderTab();
        } else if (key === 'logo') {
          LandingStore.hapusFotoRef(ambil().merek.logo);
          ambil().merek.logo = '';
          ambil().merek.logo_info = '';
          tandaiBelumSimpan();
          renderTab();
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

  function unggahSatu(input) {
    var file = input.files && input.files[0];
    if (!file) return;
    var key = input.getAttribute('data-lp-file');
    input.value = '';
    unggahDariBerkas(key, file);
  }

  function unggahDariBerkas(key, file) {
    if (!file) return;
    bersihkanError(key);
    tampilkanProses(key, true);
    LandingStore.bacaFoto(file).then(function (f) {
      return Utils.keCloud(f.data, 'foto/landing', f.nama || file.name || 'foto.jpg').then(function (src) {
        // URL cloud disimpan apa adanya; foto lokal disimpan ke IndexedDB
        // dan konfigurasi hanya menyimpan referensinya.
        return LandingStore.simpanFoto(src).then(function (nilai) {
          return { nilai: nilai, info: infoBerkas(f.nama || file.name, f.ukuran) };
        });
      });
    }).then(function (hasil) {
      tampilkanProses(key, false);
      var d = ambil();
      if (key === 'logo') {
        d.merek.logo = hasil.nilai;
        d.merek.logo_info = hasil.info;
      } else if (key.indexOf('kolase_') === 0) {
        var i = parseInt(key.split('_')[1], 10);
        if (!d.kolase[i]) d.kolase[i] = { file: '', caption: '', alt: '' };
        d.kolase[i].file = hasil.nilai;
        d.kolase[i].file_info = hasil.info;
        if (!d.kolase[i].caption) d.kolase[i].caption = String(file.name || '').replace(/\.[^.]+$/, '');
        if (!d.kolase[i].alt) d.kolase[i].alt = file.name || '';
      }
      tandaiBelumSimpan();
      renderTab();
      Utils.toast(/^https?:/.test(hasil.nilai) ? 'Foto tersimpan di cloud.' : 'Foto berhasil dipilih.', 'success');
    }).catch(function (err) {
      tampilkanProses(key, false);
      tampilkanError(key, err && err.message ? err.message : 'Gagal memproses foto.');
    });
  }

  function unggahBanyak(input) {
    var files = Array.prototype.slice.call(input.files || []);
    input.value = '';
    unggahBanyakFotos(files);
  }

  function unggahBanyakFotos(files) {
    if (!files || !files.length) return;
    bersihkanError('galeri');
    tampilkanProses('galeri', true);
    var d = ambil();
    var gagal = [];
    var janji = files.map(function (f) {
      return LandingStore.bacaFoto(f).then(function (res) {
        return Utils.keCloud(res.data, 'foto/galeri', res.nama || f.name || 'galeri.jpg').then(function (src) {
          return LandingStore.simpanFoto(src).then(function (nilai) {
            d.galeri.push({
              id: 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
              src: nilai,
              file_info: infoBerkas(res.nama || f.name, res.ukuran),
              judul: String(res.nama || f.name || '').replace(/\.[^.]+$/, ''),
              keterangan: '',
              kategori: 'Atlet'
            });
          });
        });
      }).catch(function (err) {
        gagal.push((f && f.name ? f.name : 'foto') + ': ' + (err && err.message ? err.message : 'gagal diproses'));
      });
    });
    Promise.all(janji).then(function () {
      tampilkanProses('galeri', false);
      tandaiBelumSimpan();
      renderTab();
      if (gagal.length) {
        tampilkanError('galeri', gagal.join(' | '));
      }
      var sukses = files.length - gagal.length;
      if (sukses > 0) {
        Utils.toast(sukses + ' foto galeri berhasil ditambahkan.' + (gagal.length ? ' ' + gagal.length + ' gagal.' : ''), gagal.length ? 'info' : 'success');
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
        '<p class="muted small">Format JPG, JPEG, PNG, atau WEBP. Maksimal 2 MB per foto, otomatis diperkecil (maks. lebar 1600px). Bisa juga menyeret foto ke area pratinjau.</p>' +
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
        '<div class="lp-foto-proses lp-proses-inline" data-lp-proses="galeri" hidden>Memproses...</div>' +
        '</div>' +
        '<p class="muted small">Format JPG, JPEG, PNG, WEBP. Maksimal 2 MB per foto. Bisa juga menyeret foto ke daftar di bawah.</p>' +
        '<div class="field-error" data-lp-error="galeri"></div>' +
        '<div class="lp-galeri-list" data-lp-drop="galeri">' +
        (d.galeri || []).map(function (g, i) {
          var srcG = LandingStore.urlFoto(g.src || g.file);
          return '<div class="lp-galeri-item">' +
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
        '</div>' + barSimpan();
    }

    body.innerHTML = html;
    pasangGambarLP(body);
  }

  return {
    register: register
  };
})();
