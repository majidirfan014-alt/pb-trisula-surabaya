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

  function slotFoto(key, file, caption, label, hideCaption) {
    var media = '<div class="lp-foto-media">' +
      '<div class="lp-foto-kosong">' + UI.icon('users', 26) + '<span>Belum ada foto</span></div>' +
      (file ? '<img data-lp-img src="' + Utils.esc(file) + '" alt="' + Utils.esc(label || 'Foto') + '">' : '') +
      '</div>';
    return '<div class="lp-foto" data-lp-foto="' + key + '">' +
      '<div class="lp-foto-label">' + Utils.esc(label) + '</div>' +
      media +
      '<div class="lp-foto-aksi">' +
      '<label class="btn btn-sm btn-secondary">Unggah/Ganti Foto' +
      '<input type="file" hidden accept="image/jpeg,image/jpg,image/png,image/webp" data-lp-file="' + key + '"></label>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-lp-hapus="' + key + '">Hapus</button>' +
      '</div>' +
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

  function render(root, user, app) {
    pageRoot = root;
    draft = null;
    tersimpan = null;
    ambil();
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
      if (hapus) {
        var key = hapus.getAttribute('data-lp-hapus');
        if (key.indexOf('kolase_') === 0) {
          var idx = parseInt(key.split('_')[1], 10);
          ambil().kolase[idx].file = '';
          renderTab();
        } else if (key === 'logo') {
          ambil().merek.logo = '';
          renderTab();
        } else if (key.indexOf('galeri_') === 0) {
          hapusGaleri(key.split('_')[1]);
        } else if (key.indexOf('marquee_') === 0) {
          var mi = parseInt(key.split('_')[1], 10);
          var list = ambil().marquee || [];
          if (mi >= 0 && mi < list.length) {
            list.splice(mi, 1);
            App.setDirty(true);
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
          App.setDirty(true);
        }
      }
    });

    page.addEventListener('input', function (e) {
      if (e.target.closest('#lp-body')) App.setDirty(true);
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
    d.galeri = (d.galeri || []).filter(function (g) {
      return g.id !== id;
    });
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
    renderTab();
  }

  function unggahSatu(input) {
    var file = input.files && input.files[0];
    if (!file) return;
    var key = input.getAttribute('data-lp-file');
    input.value = '';
    LandingStore.bacaFoto(file).then(function (f) {
      var d = ambil();
      if (key === 'logo') {
        d.merek.logo = f.data;
      } else if (key.indexOf('kolase_') === 0) {
        var i = parseInt(key.split('_')[1], 10);
        if (!d.kolase[i]) d.kolase[i] = { file: '', caption: '', alt: '' };
        d.kolase[i].file = f.data;
        if (!d.kolase[i].caption) d.kolase[i].caption = f.nama.replace(/\.[^.]+$/, '');
        if (!d.kolase[i].alt) d.kolase[i].alt = f.nama;
      }
      App.setDirty(true);
      renderTab();
    }).catch(function (err) {
      var slot = document.querySelector('[data-lp-error="' + key + '"]');
      if (slot) slot.textContent = err.message;
      Utils.toast(err.message, 'danger');
    });
  }

  function unggahBanyak(input) {
    var files = Array.prototype.slice.call(input.files || []);
    if (!files.length) return;
    var d = ambil();
    var janji = files.map(function (f) {
      return LandingStore.bacaFoto(f).then(function (res) {
        d.galeri.push({
          id: 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          src: res.data,
          judul: res.nama.replace(/\.[^.]+$/, ''),
          keterangan: '',
          kategori: 'Atlet'
        });
      }).catch(function (err) {
        Utils.toast(err.message, 'danger');
      });
    });
    Promise.all(janji).then(function () {
      App.setDirty(true);
      renderTab();
    });
    input.value = '';
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
    App.setDirty(true);
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
        '<p class="muted small">Format JPG, JPEG, PNG, atau WEBP. Maksimal 2 MB per foto, otomatis diperkecil (maks. lebar 1600px).</p>' +
        '<div class="lp-foto-grid">' +
        (d.kolase || []).map(function (k, i) {
          return slotFoto('kolase_' + i, k.file, k.caption, 'Foto ' + (i + 1) + (i === 0 ? ' (Utama)' : ''));
        }).join('') +
        '</div></div>' + barSimpan();

    } else if (tabAktif === 'galeri') {
      html += '<div class="card lp-kartu">' +
        '<div class="card-title">' + UI.icon('users', 20) + 'Galeri Foto</div>' +
        '<div class="flex flex-wrap gap-1 items-center mb-2">' +
        '<label class="btn btn-secondary">Tambah Foto (boleh lebih dari satu)' +
        '<input type="file" hidden multiple accept="image/jpeg,image/jpg,image/png,image/webp" data-lp-file-galeri id="lp-file-galeri"></label>' +
        '<button type="button" class="btn btn-ghost" data-lp-tambah-galeri>Pilih dari Penjelajah</button>' +
        '</div>' +
        '<p class="muted small">Format JPG, JPEG, PNG, WEBP. Maksimal 2 MB per foto.</p>' +
        '<div class="lp-galeri-list">' +
        (d.galeri || []).map(function (g, i) {
          return '<div class="lp-galeri-item">' +
            '<div class="lp-galeri-thumb">' +
            '<div class="lp-foto-kosong">' + UI.icon('users', 22) + '<span>Tanpa foto</span></div>' +
            ((g.src || g.file) ? '<img data-lp-img src="' + Utils.esc(g.src || g.file) + '" alt="">' : '') +
            '</div>' +
            '<div class="lp-galeri-isi">' +
            '<input class="input" data-lp-judul="' + Utils.esc(g.id) + '" value="' + Utils.esc(g.judul || g.caption || '') + '" placeholder="Judul foto (contoh: Pelatih: Coach Budi)" aria-label="Judul foto">' +
            '<input class="input" data-lp-keterangan="' + Utils.esc(g.id) + '" value="' + Utils.esc(g.keterangan || '') + '" placeholder="Keterangan kecil (contoh: Pelatih Kepala)" aria-label="Keterangan foto">' +
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
        slotFoto('logo', d.merek.logo, '', 'Logo Klub', true) +
        '</div>' + barSimpan();
    }

    body.innerHTML = html;
    pasangGambarLP(body);
  }

  return {
    register: register
  };
})();
