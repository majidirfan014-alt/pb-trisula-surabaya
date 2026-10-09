var PagesPublic = (function () {
  var daftarFoto = [];
  var fotoAktif = 0;
  var landing = null;

  function cfg() {
    if (!landing) landing = LandingStore.get();
    return landing;
  }

  function iconSosmed(nama) {
    var p = {
      instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1.1"/>',
      facebook: '<path d="M15 3h-2.4A3.6 3.6 0 0 0 9 6.6V10H6v4h3v7h4v-7h3l1-4h-4V7.2c0-.7.5-1.2 1.2-1.2H16z"/>',
      youtube: '<rect x="2.5" y="5.8" width="19" height="12.4" rx="4"/><path d="M10.2 9.4l4.8 2.6-4.8 2.6z"/>',
      whatsapp: '<path d="M20.5 11.8a8.5 8.5 0 0 1-12.4 7.5L3.5 20.5l1.3-4.4A8.5 8.5 0 1 1 20.5 11.8z"/><path d="M8.9 9.1c.3 2.3 2.4 4.5 4.8 5l1-1.4 1.9.9-.4 1.5c-2.8.4-6.1-2.4-6.9-5.2l1.5-.6z"/>'
    };
    return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + (p[nama] || p.instagram) + '</svg>';
  }

  function countUp(el, target) {
    if (!el) return;
    var tujuan = Math.max(0, Number(target) || 0);
    var raf = window.requestAnimationFrame || function (cb) {
      return setTimeout(function () {
        cb(Date.now());
      }, 16);
    };
    var dari = parseInt(el.textContent, 10);
    if (isNaN(dari)) dari = 0;
    if (dari === tujuan) {
      el.textContent = String(tujuan);
      return;
    }
    var durasi = 750;
    var mulai = null;
    function step(ts) {
      if (mulai === null) mulai = ts;
      var p = Math.min(1, (ts - mulai) / durasi);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(dari + (tujuan - dari) * eased));
      if (p < 1) raf(step);
      else el.textContent = String(tujuan);
    }
    raf(step);
  }

  // --- Penanganan field opsional -------------------------------------------
  // Semua isian landing page bersifat opsional. Elemen yang kosong disembunyikan
  // (display:none) supaya tidak menyisakan ruang kosong, teks "undefined"/"null",
  // atau tombol tanpa teks. Untuk judul hero, subjudul, dan foto kolase, nilai
  // kosong memakai nilai default agar halaman tetap rapi.
  function cariBungkus(el, selektor) {
    if (!el || !selektor || !el.closest) return el;
    return el.closest(selektor) || el;
  }

  function sembunyikan(el) {
    if (el) el.style.display = 'none';
  }

  function tampilkan(el) {
    if (el) el.style.display = '';
  }

  function isiTeks(id, nilai, opsi) {
    opsi = opsi || {};
    var el = document.getElementById(id);
    if (!el) return;
    var v = (nilai === undefined || nilai === null) ? '' : String(nilai).trim();
    if (!v && opsi.fallback !== undefined && opsi.fallback !== null) {
      v = String(opsi.fallback).trim();
    }
    var target = cariBungkus(el, opsi.bungkus);
    if (!v) {
      sembunyikan(target);
      return;
    }
    tampilkan(target);
    el.textContent = v;
  }

  function renderTeks() {
    var c = cfg();
    var def = CONFIG.LANDING_DEFAULT || {};
    var m = c.merek || {};
    var h = c.hero || {};
    var t = c.tentang || {};
    var f = c.footer || {};
    var dm = def.merek || {};
    var dh = def.hero || {};

    isiTeks('brand-nama', m.nama, { fallback: dm.nama });
    isiTeks('brand-sub', m.sub, { fallback: dm.sub });
    var brandText = document.querySelector('.brand-text');
    if (brandText) {
      if (String(m.nama || '').trim() || String(m.sub || '').trim()) tampilkan(brandText);
      else sembunyikan(brandText);
    }

    isiTeks('cta-navbar', h.tombolNavbar, { bungkus: 'a' });
    isiTeks('hero-badge', h.badge, { bungkus: '.hero-tag' });
    isiTeks('hero-judul1', h.judul1, { fallback: dh.judul1 });
    isiTeks('hero-judul2', h.judul2, { fallback: dh.judul2 });
    isiTeks('hero-sub', h.subjudul, { fallback: dh.subjudul });
    isiTeks('hero-deskripsi', h.deskripsi);
    isiTeks('hero-tombol-utama', h.tombolUtama, { bungkus: 'a' });
    isiTeks('hero-tombol-kedua', h.tombolKedua, { bungkus: 'a' });

    var logo = document.querySelectorAll('img.brand-logo');
    for (var i = 0; i < logo.length; i++) {
      if (m.logo) logo[i].src = m.logo;
      if (m.nama) logo[i].alt = 'Logo ' + m.nama;
    }

    isiTeks('tentang-judul', t.judul);
    isiTeks('tentang-teks1', t.teks1);
    isiTeks('tentang-teks2', t.teks2);
    isiTeks('tentang-judul-kartu', t.judulKartu);
    isiTeks('tentang-tombol', t.tombol, { bungkus: 'a' });

    var adaLangkah = false;
    ['langkah1', 'langkah2', 'langkah3'].forEach(function (k) {
      var val = t[k];
      var judulEl = document.getElementById('tentang-' + k + '-judul');
      var baris = cariBungkus(judulEl, '.list-row');
      var v = (val === undefined || val === null) ? '' : String(val).trim();
      if (!v) {
        sembunyikan(baris);
        return;
      }
      adaLangkah = true;
      tampilkan(baris);
      var bagian = v.split('|');
      var isiEl = document.getElementById('tentang-' + k + '-isi');
      if (judulEl) judulEl.textContent = bagian[0];
      if (isiEl) isiEl.textContent = bagian.slice(1).join('|');
    });

    var kartu = document.querySelector('#tentang .card.kartu-aksen');
    if (kartu) {
      var judulKartuBersih = String(t.judulKartu || '').trim();
      if (!judulKartuBersih && !adaLangkah) {
        sembunyikan(kartu);
      } else {
        tampilkan(kartu);
        if (!judulKartuBersih) sembunyikan(cariBungkus(document.getElementById('tentang-judul-kartu'), '.card-title'));
      }
    }

    isiTeks('footer-teks', f.teks);
    isiTeks('footer-hak-cipta', f.hakCipta);
    var footerBottom = document.getElementById('footer-hak-cipta');
    if (footerBottom && !String(f.teks || '').trim() && !String(f.hakCipta || '').trim()) {
      sembunyikan(footerBottom);
    }
  }

  function renderStrip() {
    var host = document.getElementById('strip');
    if (!host) return;
    var c = cfg().kontak || {};
    var sosmed = (cfg().sosmed || []).filter(function (s) {
      return s && String(s.url || '').trim();
    });

    var kiri = '';
    if (c.phone) {
      kiri += '<a class="strip-item" href="tel:' + Utils.esc(c.phoneLink || c.phone) + '">' +
        '<svg class="icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 4h4l2 5-2 2a12 12 0 0 0 4 4l2-2 5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z"/></svg>' +
        Utils.esc(c.phone) + '</a>';
    }
    if (c.email) {
      kiri += '<a class="strip-item strip-item-hide" href="mailto:' + Utils.esc(c.email) + '">' +
        '<svg class="icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>' +
        Utils.esc(c.email) + '</a>';
    }
    if (c.alamatSingkat) {
      kiri += '<span class="strip-item strip-item-hide">' +
        '<svg class="icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>' +
        Utils.esc(c.alamatSingkat) + '</span>';
    }

    var kanan = sosmed.map(function (s) {
      return '<a class="sosmed" href="' + Utils.esc(s.url) + '" target="_blank" rel="noopener" aria-label="' + Utils.esc(s.nama) + '">' +
        iconSosmed(s.ikon) + '</a>';
    }).join('');

    if (!kiri && !kanan) {
      host.innerHTML = '';
      sembunyikan(host);
      return;
    }
    tampilkan(host);
    host.innerHTML = '<div class="container strip-isi">' +
      '<div class="strip-kiri">' + kiri + '</div>' +
      '<div class="strip-kanan">' + kanan + '</div>' +
      '</div>';
  }

  function renderMarquee() {
    var host = document.getElementById('marquee-track');
    if (!host) return;
    var items = (cfg().marquee || []).filter(function (t) {
      return String(t || '').trim();
    });
    var wrap = host.closest ? host.closest('.marquee') : host.parentElement;
    if (!items.length) {
      host.innerHTML = '';
      sembunyikan(wrap);
      return;
    }
    tampilkan(wrap);
    var bintang = '<span class="marquee-bintang"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9z"/></svg></span>';
    var isi = items.map(function (t) {
      return '<span class="marquee-teks">' + Utils.esc(t) + '</span>' + bintang;
    }).join('');
    host.innerHTML = '<div class="marquee-isi">' + isi + '</div>' +
      '<div class="marquee-isi" aria-hidden="true">' + isi + '</div>';
  }

  function pasangGambar(img, file, alt) {
    if (!file) {
      img.style.display = 'none';
      return;
    }
    img.alt = alt || '';
    function siap() {
      img.classList.add('siap');
    }
    img.addEventListener('load', siap);
    img.addEventListener('error', function () {
      img.style.display = 'none';
    });
    img.src = file;
    if (img.complete && img.naturalWidth > 0) siap();
  }

  function renderKolase() {
    var cfgK = cfg().kolase || [];
    var defK = (CONFIG.LANDING_DEFAULT || {}).kolase || [];
    function isiSlot(i) {
      var item = cfgK[i] || {};
      if (item.file && String(item.file).trim()) return item;
      var fallback = defK[i] || {};
      if (fallback.file) return { file: fallback.file, alt: item.alt || fallback.alt, caption: item.caption || fallback.caption };
      return item;
    }
    var gambar = document.querySelectorAll('#hero-kolase img[data-kolase]');
    for (var i = 0; i < gambar.length; i++) {
      var img = gambar[i];
      var item = isiSlot(parseInt(img.getAttribute('data-kolase'), 10));
      pasangGambar(img, item.file, item.alt || item.caption);
    }
    var placeholders = document.querySelectorAll('#hero-kolase .foto-placeholder span');
    for (var j = 0; j < placeholders.length; j++) {
      var it = isiSlot(j);
      placeholders[j].textContent = it && it.file ? String(it.file).split('/').pop() : 'kosong';
    }
  }

  function renderFooter() {
    var c = cfg().kontak || {};
    var t = cfg().tentang || {};
    var kontak = document.getElementById('footer-kontak');
    if (kontak) {
      var html = '';
      if (c.email) {
        html += '<li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg><a href="mailto:' + Utils.esc(c.email) + '">' + Utils.esc(c.email) + '</a></li>';
      }
      if (c.phone) {
        html += '<li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 4h4l2 5-2 2a12 12 0 0 0 4 4l2-2 5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z"/></svg><a href="tel:' + Utils.esc(c.phoneLink || c.phone) + '">' + Utils.esc(c.phone) + '</a></li>';
      }
      if (t.jam) {
        html += '<li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><span>' + Utils.esc(t.jam) + '</span></li>';
      }
      kontak.innerHTML = html;
      var kolomKontak = (kontak.closest && kontak.closest('div')) || kontak.parentElement;
      if (!html) {
        sembunyikan(kontak.previousElementSibling);
        sembunyikan(kolomKontak);
      } else {
        tampilkan(kontak.previousElementSibling);
        tampilkan(kolomKontak);
      }
    }
    var lokasi = document.getElementById('footer-lokasi');
    if (lokasi) {
      var adaLokasi = !!String(t.lokasi || '').trim();
      lokasi.innerHTML = adaLokasi
        ? '<li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg><span>' + Utils.esc(t.lokasi) + '</span></li>'
        : '';
      if (!adaLokasi) {
        sembunyikan(lokasi.previousElementSibling);
        sembunyikan(lokasi);
      } else {
        tampilkan(lokasi.previousElementSibling);
        tampilkan(lokasi);
      }
    }
  }

  function renderSummary() {
    var users = Store.all('users');
    var totalAtlet = users.filter(function (u) {
      return u.role === 'atlet' && u.status !== 'nonaktif';
    }).length;
    var totalAsisten = users.filter(function (u) {
      return u.role === 'asisten' && u.status !== 'nonaktif';
    }).length;

    countUp(document.getElementById('summary-total-atlet'), totalAtlet);
    countUp(document.getElementById('summary-total-asisten'), totalAsisten);

    var totalAtlet2 = Store.count('athletes', function (a) {
      return a.status !== 'nonaktif';
    });
    var elTotal2 = document.getElementById('summary-total-atlet-2');
    if (elTotal2) elTotal2.textContent = String(totalAtlet2);

    var elJadwal2 = document.getElementById('summary-jadwal-2');
    if (elJadwal2) elJadwal2.textContent = 'Selasa & Jumat';

    var matches = Utils.sortBy(Store.all('matches'), 'tanggal', 'desc');
    var last = matches[0];
    var lastBox = document.getElementById('summary-pertandingan-detail');
    if (lastBox) {
      if (last) {
        lastBox.innerHTML =
          '<b>' + Utils.esc(last.turnamen) + '</b>' +
          '<div class="small muted">' + Utils.esc(last.lawan) + ' · ' + Utils.esc(last.hasil) + '</div>';
      } else {
        lastBox.innerHTML = '<div class="small muted">Belum ada catatan pertandingan.</div>';
      }
    }
  }

  // ---- Satu sumber data untuk foto utama, thumbnail, caption, dan lightbox ----
  // Bentuk item: { src, kategori, judul, keterangan, utama }
  // Nama lama (file, caption) tetap diterima agar data tersimpan tidak rusak.
  function bangunDaftarFoto() {
    return (cfg().galeri || []).map(function (item, i) {
      item = item || {};
      var src = String(item.src || item.file || '').trim();
      var namaFile = src ? src.split('/').pop() : ('foto-' + (i + 1));
      var judul = String(item.judul || item.caption || '').trim() || namaFile;
      var keterangan = String(item.keterangan || '').trim();
      return {
        id: item.id || 'f' + i,
        src: src,
        kategori: String(item.kategori || '').trim() || 'Lainnya',
        judul: judul,
        keterangan: keterangan,
        alt: item.alt || (judul + (keterangan ? ' - ' + keterangan : '')),
        utama: !!item.utama
      };
    });
  }

  function teksKet(f) {
    return f.keterangan ? (f.keterangan + ' \u00b7 Klik untuk memperbesar') : 'Klik untuk memperbesar';
  }

  function fotoMarkup(item, indeks, isUtama) {
    var namaFile = item.src ? item.src.split('/').pop() : item.judul;
    return '<figure class="' + (isUtama ? 'keluarga-utama' : 'keluarga-foto') +
      (isUtama ? '" id="keluarga-utama' : '') +
      '" data-foto-index="' + indeks + '" tabindex="0" role="button"' +
      ' aria-label="' + (isUtama ? 'Perbesar foto: ' : 'Pilih foto: ') + Utils.esc(item.alt) + '">' +
      '<div class="foto-media">' +
      '<div class="foto-placeholder">' + UI.icon('users', 30) + '<span>' + Utils.esc(namaFile) + '</span></div>' +
      '<img' + (isUtama ? ' id="keluarga-utama-img"' : '') +
      ' src="' + Utils.esc(item.src) + '" alt="' + Utils.esc(item.alt) + '"' +
      (isUtama ? ' decoding="async"' : ' loading="lazy" decoding="async"') + '>' +
      '</div>' +
      (isUtama
        ? '<div class="foto-overlay">' +
          '<b id="keluarga-utama-judul">' + Utils.esc(item.judul) + '</b>' +
          '<span id="keluarga-utama-ket">' + Utils.esc(teksKet(item)) + '</span>' +
          '</div>' +
          '<button type="button" class="keluarga-auto" id="keluarga-auto" aria-pressed="true"' +
          ' aria-label="Jeda putar otomatis">Jeda auto</button>'
        : '') +
      '</figure>';
  }

  var slideTimer = null;
  var slideNyala = true;
  var muatToken = 0;

  function hentikanSlide() {
    if (slideTimer) {
      clearInterval(slideTimer);
      slideTimer = null;
    }
  }

  function mulaiSlide() {
    hentikanSlide();
    if (!slideNyala || !daftarFoto.length) return;
    slideTimer = setInterval(function () {
      if (document.hidden) return;
      if (!document.getElementById('lightbox') || document.getElementById('lightbox').hidden) {
        pilihFoto(fotoAktif + 1);
      }
    }, 5000);
  }

  function pilihFoto(indeks) {
    if (!daftarFoto.length) return;
    fotoAktif = ((indeks % daftarFoto.length) + daftarFoto.length) % daftarFoto.length;
    var f = daftarFoto[fotoAktif];
    var fig = document.getElementById('keluarga-utama');
    var img = document.getElementById('keluarga-utama-img');
    var judulEl = document.getElementById('keluarga-utama-judul');
    var ketEl = document.getElementById('keluarga-utama-ket');

    if (fig) {
      fig.setAttribute('data-foto-index', String(fotoAktif));
      fig.setAttribute('aria-label', 'Perbesar foto: ' + f.alt);
    }
    if (judulEl) judulEl.textContent = f.judul;
    if (ketEl) ketEl.textContent = teksKet(f);

    document.querySelectorAll('#keluarga-galeri .keluarga-foto').forEach(function (el) {
      var aktif = parseInt(el.getAttribute('data-foto-index'), 10) === fotoAktif;
      el.classList.toggle('aktif', aktif);
      el.setAttribute('aria-current', aktif ? 'true' : 'false');
    });

    if (!img) return;
    var token = ++muatToken;
    img.classList.remove('siap');
    setTimeout(function () {
      if (token !== muatToken) return;
      if (!f.src) {
        img.removeAttribute('src');
        img.style.display = 'none';
        return;
      }
      img.style.display = '';
      img.onload = function () {
        if (token !== muatToken) return;
        img.classList.add('siap');
      };
      img.onerror = function () {
        if (token !== muatToken) return;
        img.style.display = 'none';
        img.classList.remove('siap');
      };
      img.src = f.src;
      if (img.complete && img.naturalWidth > 0) img.classList.add('siap');
    }, 150);
  }

  function sejajarkanSisi() {
    var utama = document.getElementById('keluarga-utama');
    var sisi = document.getElementById('keluarga-sisi');
    if (!utama || !sisi) return;
    sisi.style.maxHeight = '';
    if (window.matchMedia && window.matchMedia('(max-width: 1023px)').matches) return;
    sisi.style.maxHeight = Math.round(utama.getBoundingClientRect().height) + 'px';
  }

  function renderKeluarga() {
    var host = document.getElementById('keluarga-galeri');
    if (!host) return;
    daftarFoto = bangunDaftarFoto();
    hentikanSlide();

    if (!daftarFoto.length) {
      host.innerHTML = '<div class="keluarga-kosong">' +
        '<p class="mb-0"><b>Belum ada foto.</b> Tambahkan foto lewat menu <b>Pelatih Kepala / Landing Page</b>, ' +
        'atau letakkan file di folder <code>assets/galeri/</code>.</p>' +
        '</div>';
      return;
    }

    var utamaIdx = 0;
    for (var i = 0; i < daftarFoto.length; i++) {
      if (daftarFoto[i].utama) {
        utamaIdx = i;
        break;
      }
    }
    fotoAktif = utamaIdx;

    var sisa = [];
    daftarFoto.forEach(function (f, idx) {
      if (idx !== utamaIdx) sisa.push({ f: f, idx: idx });
    });

    var urutan = [];
    ['Pelatih', 'Atlet'].forEach(function (k) {
      var ada = sisa.filter(function (x) {
        return x.f.kategori === k;
      });
      if (ada.length) urutan.push({ label: k, item: ada });
    });
    sisa.forEach(function (x) {
      var sudah = urutan.some(function (g) {
        return g.label === x.f.kategori;
      });
      if (!sudah) urutan.push({ label: x.f.kategori, item: [x] });
    });

    var html = fotoMarkup(daftarFoto[utamaIdx], utamaIdx, true);

    if (urutan.length) {
      html += '<div class="keluarga-sisi" id="keluarga-sisi">';
      urutan.forEach(function (g) {
        html += '<div class="keluarga-grup">' +
          '<div class="keluarga-label"><span class="keluarga-titik" aria-hidden="true"></span>' +
          Utils.esc(g.label) + '</div>' +
          '<div class="keluarga-grid">';
        g.item.forEach(function (x) {
          html += fotoMarkup(x.f, x.idx, false);
        });
        html += '</div></div>';
      });
      html += '</div>';
    } else {
      html += '<div class="keluarga-sisi" id="keluarga-sisi"></div>';
    }

    host.innerHTML = html;

    host.querySelectorAll('.foto-media img').forEach(function (img) {
      function siap() {
        img.classList.add('siap');
      }
      if (img.complete && img.naturalWidth > 0) siap();
      else {
        img.addEventListener('load', siap);
        img.addEventListener('error', function () {
          img.style.display = 'none';
        });
      }
    });

    host.querySelectorAll('.keluarga-foto').forEach(function (el) {
      var idx = parseInt(el.getAttribute('data-foto-index'), 10) || 0;
      el.addEventListener('click', function () {
        pilihFoto(idx);
        mulaiSlide();
      });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          pilihFoto(idx);
          mulaiSlide();
        }
      });
    });

    var fig = document.getElementById('keluarga-utama');
    if (fig) {
      fig.addEventListener('click', function () {
        bukaLightbox(parseInt(fig.getAttribute('data-foto-index'), 10) || 0);
      });
      fig.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          bukaLightbox(parseInt(fig.getAttribute('data-foto-index'), 10) || 0);
        }
      });
      fig.addEventListener('mouseenter', hentikanSlide);
      fig.addEventListener('mouseleave', function () {
        if (slideNyala) mulaiSlide();
      });
    }

    var tombolAuto = document.getElementById('keluarga-auto');
    if (tombolAuto) {
      tombolAuto.addEventListener('click', function (e) {
        e.stopPropagation();
        slideNyala = !slideNyala;
        tombolAuto.setAttribute('aria-pressed', slideNyala ? 'true' : 'false');
        tombolAuto.setAttribute('aria-label', slideNyala ? 'Jeda putar otomatis' : 'Putar otomatis');
        tombolAuto.textContent = slideNyala ? 'Jeda auto' : 'Putar auto';
        if (slideNyala) mulaiSlide();
        else hentikanSlide();
      });
    }

    pilihFoto(utamaIdx);
    mulaiSlide();
    sejajarkanSisi();
  }

  function renderLightbox() {
    if (document.getElementById('lightbox')) return;
    var wrap = document.createElement('div');
    wrap.className = 'lightbox';
    wrap.id = 'lightbox';
    wrap.hidden = true;
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-label', 'Pratinjau foto');
    wrap.innerHTML =
      '<button type="button" class="lightbox-tutup" aria-label="Tutup foto">' + UI.icon('close', 24) + '</button>' +
      '<button type="button" class="lightbox-nav lightbox-prev" aria-label="Foto sebelumnya">' + UI.icon('arrowLeft', 24) + '</button>' +
      '<figure class="lightbox-isi">' +
      '<img id="lightbox-img" alt="">' +
      '<figcaption id="lightbox-caption"></figcaption>' +
      '</figure>' +
      '<button type="button" class="lightbox-nav lightbox-next" aria-label="Foto berikutnya">' + UI.icon('arrowLeft', 24) + '</button>';
    document.body.appendChild(wrap);

    var nextBtn = wrap.querySelector('.lightbox-next');
    if (nextBtn) {
      var svg = nextBtn.querySelector('svg');
      if (svg) svg.style.transform = 'scaleX(-1)';
    }

    wrap.addEventListener('click', function (e) {
      if (e.target === wrap || e.target.closest('.lightbox-tutup')) {
        tutupLightbox();
        return;
      }
      if (e.target.closest('.lightbox-prev')) {
        geser(-1);
        return;
      }
      if (e.target.closest('.lightbox-next')) {
        geser(1);
      }
    });

    var startX = null;
    wrap.addEventListener('touchstart', function (e) {
      if (e.touches && e.touches.length) startX = e.touches[0].clientX;
    }, { passive: true });
    wrap.addEventListener('touchend', function (e) {
      if (startX === null || !e.changedTouches || !e.changedTouches.length) return;
      var dx = e.changedTouches[0].clientX - startX;
      startX = null;
      if (Math.abs(dx) > 48) geser(dx < 0 ? 1 : -1);
    }, { passive: true });

    document.addEventListener('keydown', function (e) {
      var lb = document.getElementById('lightbox');
      if (!lb || lb.hidden) return;
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault();
        tutupLightbox();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        geser(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        geser(1);
      }
    });
  }

  function bukaLightbox(indeks) {
    if (!daftarFoto.length) return;
    var lb = document.getElementById('lightbox');
    if (!lb) return;
    hentikanSlide();
    pilihFoto(indeks);
    var f = daftarFoto[fotoAktif];
    var img = document.getElementById('lightbox-img');
    var cap = document.getElementById('lightbox-caption');
    if (img) {
      img.src = f.src || '';
      img.alt = f.alt || '';
    }
    if (cap) {
      var bagian = [f.judul];
      if (f.keterangan) bagian.push(f.keterangan);
      bagian.push((fotoAktif + 1) + '/' + daftarFoto.length);
      cap.textContent = bagian.join('  |  ');
    }
    lb.hidden = false;
    document.body.classList.add('modal-open');
    var t = lb.querySelector('.lightbox-tutup');
    if (t && t.focus) t.focus();
  }

  function tutupLightbox() {
    var lb = document.getElementById('lightbox');
    if (lb) lb.hidden = true;
    document.body.classList.remove('modal-open');
    if (slideNyala) mulaiSlide();
  }

  function geser(arah) {
    if (!daftarFoto.length) return;
    bukaLightbox(fotoAktif + arah);
  }

  function renderGallery() {
    var host = document.getElementById('public-gallery');
    if (!host) return;
    var athletes = Utils.sortBy(Store.all('athletes'), 'nama', 'asc').filter(function (a) {
      return a.status !== 'nonaktif';
    });

    if (!athletes.length) {
      host.innerHTML = '<div class="empty-state">' + UI.icon('users', 40) + '<p>Belum ada atlet terdaftar.</p></div>';
      return;
    }

    host.innerHTML = athletes.map(function (a) {
      var initial = (a.nama || '?').trim().charAt(0).toUpperCase();
      var media = a.foto
        ? '<img src="' + a.foto + '" alt="Foto ' + Utils.esc(a.nama) + '" loading="lazy">'
        : '<div class="gallery-initial" aria-hidden="true">' + Utils.esc(initial) + '</div>';
      return '<figure class="gallery-item">' +
        '<div class="gallery-photo">' + media + '</div>' +
        '<figcaption>' +
        '<b>' + Utils.esc(a.nama) + '</b>' +
        '<span>' + Utils.esc(a.sekolah || '-') + '</span>' +
        '<div class="gallery-tags">' + UI.badge(a.jk === 'Perempuan' ? 'Putri' : 'Putra', 'primary') + '</div>' +
        '</figcaption></figure>';
    }).join('');
  }

  /* ---- status aktif navbar (pil biru) + scroll-spy ---- */
  var navSpyJeda = 0;

  function menuNav() {
    var kumpul = document.querySelectorAll('.nav-link');
    var out = [];
    for (var i = 0; i < kumpul.length; i++) out.push(kumpul[i]);
    return out;
  }

  function terapkanNavAktif(href) {
    menuNav().forEach(function (a) {
      var cocok = (a.getAttribute('href') || '') === href;
      a.classList.toggle('active', cocok);
      if (cocok) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  function hrefDariHash() {
    var hash = (window.location.hash || '').replace(/^#/, '');
    if (!hash) return '#beranda';
    var cocok = '#beranda';
    menuNav().forEach(function (a) {
      if ((a.getAttribute('href') || '') === '#' + hash) cocok = '#' + hash;
    });
    return cocok;
  }

  function navScrollSpy() {
    if (Date.now() < navSpyJeda) return;
    var menu = menuNav().filter(function (a) {
      return (a.getAttribute('href') || '').charAt(0) === '#';
    });
    if (!menu.length) return;
    var batas = 96;
    var aktif = menu[0];
    menu.forEach(function (a) {
      var id = (a.getAttribute('href') || '').slice(1);
      var sec = id ? document.getElementById(id) : null;
      if (!sec) return;
      if (sec.getBoundingClientRect().top - batas <= 0) aktif = a;
    });
    var tinggi = window.innerHeight || 0;
    var akar = document.documentElement;
    var gulir = window.pageYOffset || (akar ? akar.scrollTop : 0) || 0;
    if (document.body && tinggi + gulir >= document.body.scrollHeight - 4) {
      aktif = menu[menu.length - 1];
    }
    terapkanNavAktif(aktif.getAttribute('href'));
  }

  function bindNavAktif() {
    if (!menuNav().length) return;
    var adaHash = !!((window.location.hash || '').replace(/^#/, ''));
    terapkanNavAktif(hrefDariHash());
    if (adaHash) navSpyJeda = Date.now() + 800;

    document.addEventListener('click', function (e) {
      var link = e.target && e.target.closest ? e.target.closest('.nav-link') : null;
      if (!link) return;
      var href = link.getAttribute('href') || '';
      if (href.charAt(0) !== '#') return;
      terapkanNavAktif(href);
      navSpyJeda = Date.now() + 800;
    });

    var jalan = false;
    function saatGulir() {
      if (jalan) return;
      jalan = true;
      setTimeout(function () {
        jalan = false;
        navScrollSpy();
      }, 90);
    }
    window.addEventListener('scroll', saatGulir, { passive: true });
    window.addEventListener('hashchange', function () {
      navSpyJeda = Date.now() + 800;
      terapkanNavAktif(hrefDariHash());
    });
    setTimeout(navScrollSpy, 80);
  }

  function bindNav() {
    var toggle = document.getElementById('menu-toggle');
    var menu = document.getElementById('mobile-menu');
    if (toggle && menu) {
      toggle.addEventListener('click', function () {
        var open = menu.classList.toggle('open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      menu.addEventListener('click', function (e) {
        if (e.target.closest('a')) {
          menu.classList.remove('open');
          toggle.setAttribute('aria-expanded', 'false');
        }
      });
    }
  }

  function renderSemua() {
    renderTeks();
    renderStrip();
    renderMarquee();
    renderKolase();
    renderFooter();
    renderSummary();
    renderKeluarga();
    renderGallery();
  }

  function init() {
    landing = null;
    renderLightbox();
    renderSemua();
    bindNav();
    bindNavAktif();
    LandingStore.subscribe(function () {
      landing = null;
      renderSemua();
    });
    Store.subscribe('users', Utils.debounce(renderSummary, 150));
    Store.subscribe('athletes', Utils.debounce(function () {
      renderSummary();
      renderGallery();
    }, 150));
    Store.subscribe('matches', Utils.debounce(renderSummary, 150));

    var session = null;
    try {
      session = JSON.parse(localStorage.getItem(CONFIG.PREFIX + 'session'));
    } catch (e) {
      session = null;
    }
    if (session && session.exp > Date.now()) {
      var masuk = document.getElementById('nav-masuk');
      if (masuk) {
        masuk.href = 'app.html#/beranda';
        masuk.textContent = 'Ke Dashboard';
      }
    }
  }

  return {
    init: init,
    renderKeluarga: renderKeluarga
  };
})();
