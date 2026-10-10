/* ======================================================================
   Kartu Atlet - kartu identitas atlet ukuran standar 85,6 x 54 mm.

   Catatan tata letak: tinggi kartu ditentukan oleh aspect-ratio, sehingga
   header memakai flex-basis (persen tinggi) dan isi memakai flex:1.
   JANGAN memakai padding-top persen, sebab persen padding dihitung dari
   LEBAR kartu sehingga isi terdorong ke bawah dan terpotong.
   ====================================================================== */
var KartuAtlet = (function () {

  var janjiLib = null;
  var SUDAH_DICETAK = false;

  function muatLib() {
    if (typeof html2canvas !== 'undefined' && typeof window.jspdf !== 'undefined') {
      return Promise.resolve(true);
    }
    if (janjiLib) return janjiLib;
    var berkas = [
      'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
    ];
    janjiLib = new Promise(function (resolve, reject) {
      var selesai = false;
      function akhir(ok) {
        if (selesai) return;
        selesai = true;
        ok ? resolve(true) : reject(new Error('Library kartu gagal dimuat. Periksa koneksi internet.'));
      }
      setTimeout(function () {
        if (typeof html2canvas === 'undefined') akhir(false);
      }, 15000);
      var idx = 0;
      function lanjut() {
        if (idx >= berkas.length) {
          akhir(typeof html2canvas !== 'undefined');
          return;
        }
        var s = document.createElement('script');
        s.src = berkas[idx++];
        s.onload = lanjut;
        s.onerror = lanjut;
        document.head.appendChild(s);
      }
      lanjut();
    });
    return janjiLib;
  }

  function nilai(v) {
    var s = String(v === undefined || v === null ? '' : v).trim();
    return s ? s : '-';
  }

  function kartuHtml(athlete) {
    var a = athlete || {};
    var foto = a.foto
      ? '<img class="kartu-foto-isi" src="' + Utils.esc(a.foto) + '" alt="Foto ' + Utils.esc(nilai(a.nama)) + '">'
      : '<div class="kartu-foto-isi kartu-foto-kosong" aria-hidden="true">' +
        Utils.esc((a.nama || '?').trim().charAt(0).toUpperCase()) + '</div>';
    return '<div class="kartu-atlet" id="kartu-atlet" role="img" aria-label="Kartu atlet ' + Utils.esc(nilai(a.nama)) + '">' +
      '<div class="kartu-strip">' +
      '<img class="kartu-logo" src="assets/logo-pb-trisula.png" alt="Logo PB Trisula Surabaya">' +
      '<div class="kartu-brand"><b>PB TRISULA SURABAYA</b><span>Kartu Identitas Atlet</span></div>' +
      '</div>' +
      '<div class="kartu-aksen"></div>' +
      '<div class="kartu-isi">' +
      '<div class="kartu-foto">' + foto + '</div>' +
      '<div class="kartu-kanan">' +
      '<div class="kartu-nama">' + Utils.esc(nilai(a.nama)) + '</div>' +
      '<div class="kartu-id">' + Utils.esc(nilai(a.id_atlet)) + '</div>' +
      '<div class="kartu-grid">' +
      '<div><span>Tanggal Lahir</span><b>' + Utils.esc(a.tgl_lahir ? Utils.fmtDate(a.tgl_lahir, true) : '-') + '</b></div>' +
      '<div><span>Usia</span><b>' + Utils.esc(a.tgl_lahir ? String(Utils.age(a.tgl_lahir)) + ' tahun' : '-') + '</b></div>' +
      '<div><span>Asal PB</span><b>' + Utils.esc(nilai(a.asal_pb)) + '</b></div>' +
      '<div><span>Asal Sekolah</span><b>' + Utils.esc(nilai(a.sekolah)) + '</b></div>' +
      '</div></div>' +
      '<div class="kartu-qr">' +
      '<div class="kartu-qr-box" data-qr="' + Utils.esc(a.id_atlet || '') + '"></div>' +
      '<div class="kartu-qr-teks">Scan</div>' +
      '</div>' +
      '</div>' +
      '<div class="kartu-foot"></div>' +
      '</div>';
  }

  function kartuBelakangHtml() {
    return '<div class="kartu-atlet kartu-belakang">' +
      '<div class="kartu-belakang-isi">' +
      '<img class="kartu-logo-besar" src="assets/logo-pb-trisula.png" alt="">' +
      '<div class="kartu-belakang-nama">PB TRISULA SURABAYA</div>' +
      '<div class="kartu-belakang-sub">Kartu ini milik PB Trisula Surabaya</div>' +
      '<div class="kartu-belakang-kontak">' + Utils.esc(nilaKontak()) + '</div>' +
      '</div>' +
      '<div class="kartu-foot"></div>' +
      '</div>';
  }

  function nilaKontak() {
    try {
      var k = (typeof LandingStore !== 'undefined' && LandingStore) ? (LandingStore.get().kontak || {}) : {};
      var t = (typeof LandingStore !== 'undefined' && LandingStore) ? (LandingStore.get().tentang || {}) : {};
      var baris = [];
      if (k.phone) baris.push('Telp: ' + k.phone);
      if (k.email) baris.push(k.email);
      if (t.lokasi) baris.push(t.lokasi);
      return baris.join('  |  ');
    } catch (e) {
      return 'Surabaya';
    }
  }

  function pasangQr(host) {
    var kotak = host ? host.querySelector('[data-qr]') : null;
    if (!kotak) return;
    var isi = kotak.getAttribute('data-qr');
    var bungkus = kotak.closest ? kotak.closest('.kartu-qr') : null;
    if (!isi) {
      if (bungkus) bungkus.style.display = 'none';
      return;
    }
    if (typeof QRCode === 'undefined') {
      // library gagal dimuat -> sembunyikan kotak QR agar kartu tetap rapi
      if (bungkus) bungkus.style.display = 'none';
      return;
    }
    try {
      kotak.innerHTML = '';
      new QRCode(kotak, {
        text: String(isi),
        width: 96,
        height: 96,
        colorDark: '#0b3d91',
        colorLight: '#ffffff',
        correctLevel: (QRCode.CorrectLevel && QRCode.CorrectLevel.M) || 0
      });
      if (bungkus) bungkus.style.display = '';
    } catch (e) {
      if (bungkus) bungkus.style.display = 'none';
    }
  }

  function render(host, athlete) {
    if (!host) return;
    var lengkap = !!(athlete && athlete.nama && athlete.id_atlet && athlete.tgl_lahir && athlete.sekolah);
    host.innerHTML = kartuHtml(athlete) +
      '<div class="kartu-aksi">' +
      '<button type="button" class="btn" data-kartu-png>' + UI.icon('save', 20) + ' Unduh PNG</button>' +
      '<button type="button" class="btn btn-secondary" data-kartu-pdf>' + UI.icon('save', 20) + ' Unduh PDF</button>' +
      '<button type="button" class="btn btn-ghost" data-kartu-cetak>' + UI.icon('eye', 20) + ' Cetak Kartu</button>' +
      '<button type="button" class="btn btn-ghost" data-kartu-cetak-bolak>' + UI.icon('eye', 20) + ' Cetak Depan-Belakang</button>' +
      '</div>' +
      '<p class="small muted" style="text-align:center">Kartu berukuran standar 85,6 x 54 mm. ' +
      (lengkap ? '' : '<b>Lengkapi data di Profil Atlet</b> agar kartu terisi penuh. ') +
      'Saat mencetak, matikan opsi <b>Header dan footer</b> pada dialog cetak browser.</p>';
    pasangQr(host);

    host.addEventListener('click', function (e) {
      if (e.target.closest('[data-kartu-png]')) {
        unduhPng(host, athlete);
        return;
      }
      if (e.target.closest('[data-kartu-pdf]')) {
        unduhPdf(host, athlete);
        return;
      }
      if (e.target.closest('[data-kartu-cetak]')) {
        cetakKartu(host, false);
        return;
      }
      if (e.target.closest('[data-kartu-cetak-bolak]')) {
        cetakKartu(host, true);
      }
    });
  }

  function namaFile(athlete, ekstensi) {
    var nama = String((athlete && athlete.nama) || 'atlet').replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-');
    return 'Kartu-Atlet_' + ((athlete && athlete.id_atlet) || 'tanpa-id') + '_' + nama + '.' + ekstensi;
  }

  function ambilKartu(host) {
    return host ? host.querySelector('.kartu-atlet') : null;
  }

  function salinKartu(kartu) {
    var area = document.getElementById('cetak-area');
    if (!area) {
      area = document.createElement('div');
      area.id = 'cetak-area';
      document.body.appendChild(area);
    }
    area.innerHTML = '';
    var halaman = document.createElement('div');
    halaman.className = 'cetak-halaman';
    halaman.appendChild(kartu.cloneNode(true));
    area.appendChild(halaman);
    return { area: area, halaman: halaman };
  }

  function tungguGambar(wadah) {
    var gambar = wadah.querySelectorAll ? wadah.querySelectorAll('img') : [];
    var janji = [];
    for (var i = 0; i < gambar.length; i++) {
      (function (img) {
        janji.push(new Promise(function (resolve) {
          if (img.complete) {
            resolve();
            return;
          }
          var selesai = false;
          function akhir() {
            if (selesai) return;
            selesai = true;
            resolve();
          }
          img.addEventListener('load', akhir);
          img.addEventListener('error', akhir);
          setTimeout(akhir, 3000);
        }));
      })(gambar[i]);
    }
    // beri waktu QR code untuk selesai digambar
    janji.push(new Promise(function (resolve) {
      setTimeout(resolve, 250);
    }));
    return Promise.all(janji);
  }

  function cetakKartu(host, denganBelakang) {
    var kartu = ambilKartu(host);
    if (!kartu) return;
    var salin = salinKartu(kartu);
    if (denganBelakang) {
      var belakang = document.createElement('div');
      belakang.className = 'cetak-halaman';
      belakang.innerHTML = kartuBelakangHtml();
      salin.area.appendChild(belakang);
    }
    // QR pada salinan perlu dibuat ulang (cloneNode tidak membawa canvas QR)
    var kotak = salin.halaman.querySelector('[data-qr]');
    if (kotak && typeof QRCode !== 'undefined' && kotak.getAttribute('data-qr')) {
      try {
        kotak.innerHTML = '';
        new QRCode(kotak, {
          text: String(kotak.getAttribute('data-qr')),
          width: 96, height: 96,
          colorDark: '#0b3d91', colorLight: '#ffffff',
          correctLevel: (QRCode.CorrectLevel && QRCode.CorrectLevel.M) || 0
        });
      } catch (e) {}
    }
    tungguGambar(salin.area).then(function () {
      document.body.classList.add('mode-cetak');
      setTimeout(function () {
        window.print();
        setTimeout(function () {
          document.body.classList.remove('mode-cetak');
          salin.area.innerHTML = '';
        }, 400);
      }, 120);
    });
  }

  function unduhPng(host, athlete) {
    var kartu = ambilKartu(host);
    if (!kartu || typeof html2canvas === 'undefined') {
      Utils.toast('Modul unduh gambar belum siap.', 'danger');
      return;
    }
    Utils.toast('Menyiapkan gambar kartu...', 'info');
    tungguGambar(kartu).then(function () {
      return html2canvas(kartu, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false
      });
    }).then(function (canvas) {
      canvas.toBlob(function (blob) {
        if (!blob) {
          Utils.toast('Gagal membuat gambar kartu.', 'danger');
          return;
        }
        Ekspor.simpanBlob(blob, namaFile(athlete, 'png'));
        Utils.toast('File berhasil diunduh.', 'success');
      }, 'image/png');
    }).catch(function (err) {
      Utils.toast(err && err.message ? err.message : 'Gagal membuat gambar kartu.', 'danger');
    });
  }

  function unduhPdf(host, athlete) {
    var kartu = ambilKartu(host);
    if (!kartu || typeof html2canvas === 'undefined') {
      Utils.toast('Modul unduh PDF belum siap.', 'danger');
      return;
    }
    Utils.toast('Menyiapkan PDF kartu...', 'info');
    var jsPDF = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : null;
    if (!jsPDF) {
      Utils.toast('Modul PDF belum siap.', 'danger');
      return;
    }
    tungguGambar(kartu).then(function () {
      return html2canvas(kartu, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false
      });
    }).then(function (canvas) {
      var doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
      var gambar = canvas.toDataURL('image/png');
      var lebar = 85.6;
      var tinggi = 54;
      var x = (297 - lebar) / 2;
      var y = (210 - tinggi) / 2;
      doc.addImage(gambar, 'PNG', x, y, lebar, tinggi);
      doc.save(namaFile(athlete, 'pdf'));
      Utils.toast('File berhasil diunduh.', 'success');
    }).catch(function (err) {
      Utils.toast(err && err.message ? err.message : 'Gagal membuat PDF kartu.', 'danger');
    });
  }

  return {
    html: kartuHtml,
    render: render,
    unduhPng: unduhPng,
    unduhPdf: unduhPdf,
    cetakKartu: cetakKartu
  };
})();
