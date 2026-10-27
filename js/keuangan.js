/* ======================================================================
   Keuangan & Iuran - tagihan iuran atlet, verifikasi pembayaran (bukti
   transfer disimpan sebagai Blob di IndexedDB lewat FileStore), kuitansi
   bernomor KWT/YYYY/MM/0001, laporan (Chart.js), ekspor xlsx/csv.

   Semua data lokal di koleksi:
     pbts_keuangan_tagihan      - tagihan per atlet per periode
     pbts_keuangan_pembayaran   - pembayaran + status verifikasi + kuitansi
     pbts_keuangan_rekening     - rekening tujuan transfer
     pbts_keuangan_audit        - jejak audit (catatAudit)

   Role Asisten Pelatih TIDAK memperoleh menu ini (lihat js/app.js).
   ====================================================================== */
var Keuangan = (function () {
  var K_TAGIHAN = 'keuangan_tagihan';
  var K_BAYAR = 'keuangan_pembayaran';
  var K_REKENING = 'keuangan_rekening';
  var K_AUDIT = 'keuangan_audit';

  var JENIS_TAGIHAN = ['SPP', 'Pertandingan', 'Persahabatan', 'Lainnya'];
  var STATUS_TAGIHAN = [
    { value: 'belum', label: 'Belum Bayar', tone: 'danger' },
    { value: 'menunggu', label: 'Menunggu Verifikasi', tone: 'warn' },
    { value: 'lunas', label: 'Lunas', tone: 'ok' }
  ];
  var NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  /* ==================== UTIL ==================== */

  function rupiah(n) {
    return 'Rp ' + Number(n || 0).toLocaleString('id-ID');
  }

  function terbilang(n) {
    n = Math.floor(Math.abs(Number(n) || 0));
    if (n === 0) return 'Nol Rupiah';
    var satuan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh',
      'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
    function t(x) {
      if (x < 12) return satuan[x];
      if (x < 20) return t(x - 10) + ' Belas';
      if (x < 100) return t(Math.floor(x / 10)) + ' Puluh ' + t(x % 10);
      if (x < 200) return 'Seratus ' + t(x - 100);
      if (x < 1000) return t(Math.floor(x / 100)) + ' Ratus ' + t(x % 100);
      if (x < 2000) return 'Seribu ' + t(x - 1000);
      if (x < 1000000) return t(Math.floor(x / 1000)) + ' Ribu ' + t(x % 1000);
      if (x < 1000000000) return t(Math.floor(x / 1000000)) + ' Juta ' + t(x % 1000000);
      return t(Math.floor(x / 1000000000)) + ' Miliar ' + t(x % 1000000000);
    }
    return t(n).replace(/\s+/g, ' ').trim() + ' Rupiah';
  }

  function periodeLabel(periode) {
    if (!periode || String(periode).length < 7) return periode || '-';
    var bln = parseInt(String(periode).slice(5, 7), 10) - 1;
    return (NAMA_BULAN[bln] || '?') + ' ' + String(periode).slice(0, 4);
  }

  function todayISO() {
    return (typeof Utils !== 'undefined' && Utils.todayISO) ? Utils.todayISO()
      : new Date().toISOString().slice(0, 10);
  }

  function labelStatusTagihan(status) {
    for (var i = 0; i < STATUS_TAGIHAN.length; i++) {
      if (STATUS_TAGIHAN[i].value === status) return STATUS_TAGIHAN[i];
    }
    return { value: status, label: status || '-', tone: 'muted' };
  }

  function nomorKuitansi(tglISO) {
    var t = tglISO ? String(tglISO).slice(0, 10) : todayISO();
    var prefix = 'KWT/' + t.slice(0, 4) + '/' + t.slice(5, 7) + '/';
    var max = 0;
    Store.all(K_BAYAR).forEach(function (p) {
      if (p.kuitansi && String(p.kuitansi).indexOf(prefix) === 0) {
        var n = parseInt(String(p.kuitansi).slice(prefix.length), 10);
        if (!isNaN(n) && n > max) max = n;
      }
    });
    var next = String(max + 1);
    while (next.length < 4) next = '0' + next;
    return prefix + next;
  }

  function catatAudit(aksi, detail, oleh) {
    Store.insert(K_AUDIT, {
      aksi: aksi,
      detail: detail || '',
      oleh: oleh || (Auth.current() ? Auth.current().nama : '-'),
      waktu: new Date().toISOString()
    });
  }

  /* ==================== DATA ==================== */

  function semuaTagihan() {
    return Utils.sortBy(Store.all(K_TAGIHAN), 'dibuat_pada', 'desc');
  }

  function tagihanById(id) {
    return Store.find(K_TAGIHAN, id);
  }

  function pembayaranUntukTagihan(idTagihan) {
    return Store.where(K_BAYAR, function (p) { return p.tagihan_id === idTagihan; });
  }

  function semuaPembayaran() {
    return Utils.sortBy(Store.all(K_BAYAR), 'dibuat_pada', 'desc');
  }

  function atletDariUser(user) {
    return Store.findOne('athletes', function (a) {
      return (user.athlete_id && a.id === user.athlete_id) ||
        (user.id_atlet && a.id_atlet === user.id_atlet) ||
        a.user_id === user.id;
    });
  }

  function namaAtlet(idAtlet) {
    var a = Store.findOne('athletes', function (r) { return r.id_atlet === idAtlet; });
    return a ? a.nama : idAtlet;
  }

  function statistik() {
    var tagihan = semuaTagihan();
    var out = {
      total: tagihan.length,
      lunas: 0, belum: 0, menunggu: 0,
      nominal: 0, tunggakan: 0, pemasukanBulanIni: 0
    };
    var bulanIni = todayISO().slice(0, 7);
    tagihan.forEach(function (t) {
      out.nominal += Number(t.jumlah) || 0;
      if (t.status === 'lunas') out.lunas++;
      else if (t.status === 'menunggu') out.menunggu++;
      else {
        out.belum++;
        out.tunggakan += Number(t.jumlah) || 0;
      }
    });
    semuaPembayaran().forEach(function (p) {
      if (p.status === 'diterima' && String(p.tanggal || '').slice(0, 7) === bulanIni) {
        out.pemasukanBulanIni += Number(p.jumlah) || 0;
      }
    });
    return out;
  }

  function statistikAtlet(idAtlet) {
    var tagihan = Store.where(K_TAGIHAN, function (t) { return t.id_atlet === idAtlet; });
    var out = { total: tagihan.length, lunas: 0, belum: 0, menunggu: 0, sisa: 0 };
    tagihan.forEach(function (t) {
      if (t.status === 'lunas') out.lunas++;
      else if (t.status === 'menunggu') out.menunggu++;
      else out.belum++;
      if (t.status !== 'lunas') out.sisa += Number(t.jumlah) || 0;
    });
    return out;
  }

  function badgeIuran(user) {
    var u = user || Auth.current();
    if (!u || u.role !== 'atlet') return 0;
    var a = atletDariUser(u);
    if (!a) return 0;
    var s = statistikAtlet(a.id_atlet);
    return s.belum + s.menunggu;
  }

  /* ==================== REKENING ==================== */

  function rekeningAktif() {
    return Store.all(K_REKENING).filter(function (r) { return r.aktif !== false; });
  }

  /* ==================== DUMMY DATA ==================== */

  var BUKTI_DUMMY = 'data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200">' +
      '<rect width="320" height="200" fill="#e6eefb"/><rect x="20" y="20" width="280" height="160" fill="#fff" stroke="#0b3d91"/>' +
      '<text x="160" y="70" text-anchor="middle" font-family="Arial" font-size="16" fill="#0b3d91">BUKTI TRANSFER CONTOH</text>' +
      '<text x="160" y="100" text-anchor="middle" font-family="Arial" font-size="12" fill="#64748b">Data contoh (isDummy)</text>' +
      '<text x="160" y="130" text-anchor="middle" font-family="Arial" font-size="12" fill="#64748b">Rp 150.000 - Transfer</text></svg>');

  function muatDataDummy() {
    var atlet = Utils.sortBy(Store.all('athletes'), 'nama', 'asc').slice(0, 3);
    if (!atlet.length) {
      return { ok: false, pesan: 'Belum ada atlet untuk data contoh. Tambahkan atlet terlebih dahulu.' };
    }
    if (!rekeningAktif().length) {
      Store.insert(K_REKENING, {
        id: 'rek_dummy_1', nama_bank: 'BCA', no_rekening: '1234567890',
        atas_nama: 'PB Trisula Surabaya', aktif: true, isDummy: true
      });
    }
    var now = todayISO();
    var bulanIni = now.slice(0, 7);
    var d = new Date();
    d.setMonth(d.getMonth() - 1);
    var bulanLalu = d.toISOString().slice(0, 7);
    var dibuat = new Date().toISOString();

    // Tagihan SPP bulan lalu & bulan ini untuk tiap atlet (maks 3 atlet).
    atlet.forEach(function (a, i) {
      [bulanLalu, bulanIni].forEach(function (bln, j) {
        Store.insert(K_TAGIHAN, {
          id: 'kt_dummy_t' + i + '_' + j,
          id_atlet: a.id_atlet,
          periode: bln,
          jenis: 'SPP',
          jumlah: 150000,
          jatuh_tempo: bln + '-10',
          status: 'belum',
          keterangan: 'Iuran SPP (data contoh)',
          isDummy: true,
          dibuat_pada: dibuat
        });
      });
    });

    // Riwayat pembayaran yang sudah diterima (atas nama atlet pertama).
    var tLalu = Store.find(K_TAGIHAN, 'kt_dummy_t0_0');
    if (tLalu) {
      Store.insert(K_BAYAR, {
        id: 'kb_dummy_1',
        tagihan_id: tLalu.id,
        id_atlet: tLalu.id_atlet,
        jumlah: tLalu.jumlah,
        tanggal: bulanLalu + '-12',
        metode: 'transfer',
        no_ref: 'TRX-DEMO-001',
        bukti: { data: BUKTI_DUMMY, nama: 'bukti-contoh.svg', tipe: 'image/svg+xml' },
        status: 'diterima',
        catatan: '',
        kuitansi: nomorKuitansi(bulanLalu + '-12'),
        oleh_verif: 'Pengurus (demo)',
        waktu_verif: dibuat,
        isDummy: true,
        dibuat_pada: dibuat
      });
      Store.update(K_TAGIHAN, tLalu.id, { status: 'lunas' });
    }

    // Antrean verifikasi (bukti menunggu persetujuan pengurus).
    var tIni = Store.find(K_TAGIHAN, 'kt_dummy_t0_1');
    if (tIni) {
      Store.insert(K_BAYAR, {
        id: 'kb_dummy_2',
        tagihan_id: tIni.id,
        id_atlet: tIni.id_atlet,
        jumlah: tIni.jumlah,
        tanggal: now,
        metode: 'transfer',
        no_ref: 'TRX-DEMO-002',
        bukti: { data: BUKTI_DUMMY, nama: 'bukti-contoh.svg', tipe: 'image/svg+xml' },
        status: 'menunggu',
        catatan: '',
        kuitansi: '',
        isDummy: true,
        dibuat_pada: dibuat
      });
      Store.update(K_TAGIHAN, tIni.id, { status: 'menunggu' });
    }

    // Tagihan pertandingan yang belum dibayar untuk tiap atlet.
    atlet.forEach(function (a, i) {
      Store.insert(K_TAGIHAN, {
        id: 'kt_dummy_pg' + i,
        id_atlet: a.id_atlet,
        periode: bulanIni,
        jenis: 'Pertandingan',
        jumlah: 75000,
        jatuh_tempo: bulanIni + '-20',
        status: 'belum',
        keterangan: 'Kontribusi pertandingan (data contoh)',
        isDummy: true,
        dibuat_pada: dibuat
      });
    });

    catatAudit('Data Contoh', 'Data contoh keuangan dimuat.', 'Sistem');
    return { ok: true, pesan: 'Data contoh berhasil dimuat.' };
  }

  function hapusDataDummy() {
    var nTagihan = 0, nBayar = 0, nRek = 0;
    Store.all(K_BAYAR).forEach(function (p) {
      if (p.isDummy) { Store.remove(K_BAYAR, p.id); nBayar++; }
    });
    Store.all(K_TAGIHAN).forEach(function (t) {
      if (t.isDummy) { Store.remove(K_TAGIHAN, t.id); nTagihan++; }
    });
    Store.all(K_REKENING).forEach(function (r) {
      if (r.isDummy) { Store.remove(K_REKENING, r.id); nRek++; }
    });
    Store.removeWhere(K_AUDIT, function (a) {
      return a.aksi === 'Data Contoh';
    });
    catatAudit('Data Contoh', 'Data contoh keuangan dihapus (' + nTagihan + ' tagihan, ' + nBayar + ' pembayaran).', 'Sistem');
    return { tagihan: nTagihan, bayar: nBayar, rekening: nRek };
  }

  /* ==================== AKSI VERIFIKASI ==================== */

  function terimaPembayaran(idBayar, oleh) {
    var p = Store.find(K_BAYAR, idBayar);
    if (!p || p.status === 'diterima') return null;
    var noKwi = nomorKuitansi(p.tanggal || todayISO());
    Store.update(K_BAYAR, p.id, {
      status: 'diterima',
      kuitansi: noKwi,
      oleh_verif: oleh || '-',
      waktu_verif: new Date().toISOString()
    });
    Store.update(K_TAGIHAN, p.tagihan_id, { status: 'lunas' });
    catatAudit('Verifikasi Pembayaran', 'Pembayaran ' + rupiah(p.jumlah) + ' atas nama ' +
      namaAtlet(p.id_atlet) + ' diterima (kuitansi ' + noKwi + ').', oleh);
    return noKwi;
  }

  function tolakPembayaran(idBayar, alasan, oleh) {
    var p = Store.find(K_BAYAR, idBayar);
    if (!p || p.status !== 'menunggu') return false;
    Store.update(K_BAYAR, p.id, {
      status: 'ditolak',
      catatan: alasan || 'Ditolak oleh pengurus.',
      oleh_verif: oleh || '-',
      waktu_verif: new Date().toISOString()
    });
    var lain = pembayaranUntukTagihan(p.tagihan_id).some(function (x) {
      return x.status === 'menunggu';
    });
    if (!lain) Store.update(K_TAGIHAN, p.tagihan_id, { status: 'belum' });
    catatAudit('Verifikasi Pembayaran', 'Pembayaran ' + rupiah(p.jumlah) + ' atas nama ' +
      namaAtlet(p.id_atlet) + ' ditolak. Alasan: ' + (alasan || '-'), oleh);
    return true;
  }

  function tandaiLunas(idTagihan, oleh) {
    var t = tagihanById(idTagihan);
    if (!t || t.status === 'lunas') return null;
    var tgl = todayISO();
    var noKwi = nomorKuitansi(tgl);
    Store.insert(K_BAYAR, {
      id: 'kb_' + Date.now().toString(36) + Math.floor(Math.random() * 1000),
      tagihan_id: t.id,
      id_atlet: t.id_atlet,
      jumlah: t.jumlah,
      tanggal: tgl,
      metode: 'tunai',
      no_ref: '',
      bukti: null,
      status: 'diterima',
      catatan: 'Pembayaran tunai dicatat pengurus.',
      kuitansi: noKwi,
      oleh_verif: oleh || '-',
      waktu_verif: new Date().toISOString()
    });
    Store.update(K_TAGIHAN, t.id, { status: 'lunas' });
    catatAudit('Tandai Lunas', 'Tagihan ' + t.jenis + ' ' + periodeLabel(t.periode) + ' (' +
      namaAtlet(t.id_atlet) + ') dilunasi tunai (kuitansi ' + noKwi + ').', oleh);
    return noKwi;
  }

  function simpanTagihan(payload, id) {
    if (id) {
      Store.update(K_TAGIHAN, id, payload);
      catatAudit('Edit Tagihan', 'Tagihan ' + namaAtlet(payload.id_atlet || '') + ' diperbarui.', null);
      return tagihanById(id);
    }
    var created = Store.insert(K_TAGIHAN, Object.assign({
      id: 'kt_' + Date.now().toString(36) + Math.floor(Math.random() * 1000),
      status: 'belum',
      dibuat_pada: new Date().toISOString()
    }, payload));
    catatAudit('Tambah Tagihan', 'Tagihan ' + created.jenis + ' ' + periodeLabel(created.periode) +
      ' untuk ' + namaAtlet(created.id_atlet) + ' sebesar ' + rupiah(created.jumlah) + '.', null);
    return created;
  }

  function hapusTagihan(id) {
    var t = tagihanById(id);
    if (!t) return;
    pembayaranUntukTagihan(id).forEach(function (p) {
      Store.remove(K_BAYAR, p.id);
    });
    Store.remove(K_TAGIHAN, id);
    catatAudit('Hapus Tagihan', 'Tagihan ' + t.jenis + ' ' + periodeLabel(t.periode) +
      ' (' + namaAtlet(t.id_atlet) + ') dihapus.', null);
  }

  /* ==================== KUITANSI ==================== */

  function kuitansiHtml(p, t, a) {
    var kwi = p.kuitansi || '(belum bernomor)';
    var rek = rekeningAktif()[0];
    return '<div class="kuitansi" id="kuitansi-cetak">' +
      '<div class="kuitansi-kop">' +
      '<div class="kuitansi-judul"><b>PB TRISULA SURABAYA</b><span>Kuitansi Pembayaran Iuran</span></div>' +
      '<div class="kuitansi-nomor">No. ' + Utils.esc(kwi) + '</div>' +
      '</div>' +
      '<div class="kuitansi-body">' +
      '<div class="kuitansi-row"><span>Tanggal</span><b>' + Utils.fmtDate(p.tanggal, true) + '</b></div>' +
      '<div class="kuitansi-row"><span>Diterima dari</span><b>' + Utils.esc((a ? a.nama : namaAtlet(p.id_atlet)) || '-') +
      ' (' + Utils.esc(p.id_atlet) + ')</b></div>' +
      '<div class="kuitansi-row"><span>Untuk pembayaran</span><b>' + Utils.esc((t ? t.jenis : '-') + ' — ' +
      periodeLabel(t ? t.periode : '')) + '</b></div>' +
      '<div class="kuitansi-row"><span>Metode</span><b>' + Utils.esc(p.metode === 'tunai' ? 'Tunai' : 'Transfer') +
      (p.no_ref ? ' (ref: ' + Utils.esc(p.no_ref) + ')' : '') + '</b></div>' +
      (rek && p.metode !== 'tunai'
        ? '<div class="kuitansi-row"><span>Rekening tujuan</span><b>' + Utils.esc(rek.nama_bank + ' ' + rek.no_rekening +
          ' a.n. ' + rek.atas_nama) + '</b></div>'
        : '') +
      '<div class="kuitansi-jumlah"><span>Jumlah</span><b>' + rupiah(p.jumlah) + '</b></div>' +
      '<div class="kuitansi-terbilang"><em>' + Utils.esc(terbilang(p.jumlah)) + '</em></div>' +
      '</div>' +
      '<div class="kuitansi-ttd">' +
      '<div><span>Pembayar</span><br><br><br><b>' + Utils.esc((a ? a.nama : namaAtlet(p.id_atlet)) || '-') + '</b></div>' +
      '<div><span>Penerima</span><br><br><br><b>' + Utils.esc(p.oleh_verif || 'Pengurus PB Trisula') + '</b></div>' +
      '</div>' +
      '<div class="kuitansi-foot">Kuitansi ini sah tanpa tanda tangan basah bila diterbitkan dari sistem ' +
      'PB Trisula Surabaya.</div>' +
      '</div>';
  }

  function muatLibCetak() {
    if (typeof html2canvas !== 'undefined' && typeof window.jspdf !== 'undefined') {
      return Promise.resolve(true);
    }
    if (muatLibCetak._janji) return muatLibCetak._janji;
    muatLibCetak._janji = new Promise(function (resolve, reject) {
      var berkas = [
        'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
      ];
      var idx = 0;
      function lanjut() {
        if (idx >= berkas.length) {
          if (typeof html2canvas !== 'undefined' && typeof window.jspdf !== 'undefined') resolve(true);
          else reject(new Error('Library cetak kuitansi gagal dimuat. Periksa koneksi internet.'));
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
    return muatLibCetak._janji;
  }

  function unduhPdfKuitansi(namaFile) {
    var node = document.getElementById('kuitansi-cetak');
    if (!node) return Promise.reject(new Error('Kuitansi belum dibuka.'));
    return muatLibCetak().then(function () {
      return html2canvas(node, { scale: 2, backgroundColor: '#ffffff' }).then(function (kanvas) {
        var jsPDF = window.jspdf.jsPDF;
        var doc = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait' });
        var lebarHal = doc.internal.pageSize.getWidth();
        var lebarImg = lebarHal - 16;
        var tinggiImg = kanvas.height * lebarImg / kanvas.width;
        doc.addImage(kanvas.toDataURL('image/png'), 'PNG', 8, 8, lebarImg, tinggiImg);
        doc.save(namaFile || ('Kuitansi_PB-Trisula_' + todayISO() + '.pdf'));
        return true;
      });
    });
  }

  /* ==================== EKSPOR ==================== */

  function rowsRekap() {
    var rows = [['No', 'ID Atlet', 'Nama', 'Periode', 'Jenis', 'Jumlah (Rp)',
      'Jatuh Tempo', 'Status', 'Tanggal Bayar', 'Metode', 'No. Kuitansi']];
    semuaTagihan().forEach(function (t, i) {
      var bayar = pembayaranUntukTagihan(t.id).filter(function (p) {
        return p.status === 'diterima';
      })[0];
      rows.push([
        i + 1,
        t.id_atlet,
        namaAtlet(t.id_atlet),
        periodeLabel(t.periode),
        t.jenis,
        Number(t.jumlah) || 0,
        t.jatuh_tempo || '-',
        labelStatusTagihan(t.status).label,
        bayar ? bayar.tanggal : '-',
        bayar ? (bayar.metode === 'tunai' ? 'Tunai' : 'Transfer') : '-',
        bayar && bayar.kuitansi ? bayar.kuitansi : '-'
      ]);
    });
    return rows;
  }

  function rowsTunggakan() {
    var rows = [['No', 'ID Atlet', 'Nama', 'Periode', 'Jenis', 'Jumlah (Rp)', 'Jatuh Tempo', 'Status']];
    semuaTagihan().filter(function (t) { return t.status !== 'lunas'; }).forEach(function (t, i) {
      rows.push([
        i + 1,
        t.id_atlet,
        namaAtlet(t.id_atlet),
        periodeLabel(t.periode),
        t.jenis,
        Number(t.jumlah) || 0,
        t.jatuh_tempo || '-',
        labelStatusTagihan(t.status).label
      ]);
    });
    return rows;
  }

  function buatWorkbook(XLSX) {
    var wb = XLSX.utils.book_new();
    var ws1 = XLSX.utils.aoa_to_sheet(rowsRekap());
    ws1['!cols'] = [{ wch: 5 }, { wch: 10 }, { wch: 22 }, { wch: 16 }, { wch: 12 },
      { wch: 14 }, { wch: 13 }, { wch: 18 }, { wch: 13 }, { wch: 10 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Rekap');
    var ws2 = XLSX.utils.aoa_to_sheet(rowsTunggakan());
    ws2['!cols'] = [{ wch: 5 }, { wch: 10 }, { wch: 22 }, { wch: 16 }, { wch: 12 },
      { wch: 14 }, { wch: 13 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Tunggakan');
    return wb;
  }

  function eksporXlsx() {
    return Ekspor.muatXlsx().then(function (XLSX) {
      var wb = buatWorkbook(XLSX);
      var wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      Ekspor.simpanBlob(
        new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        'Keuangan_PB-Trisula_' + todayISO() + '.xlsx'
      );
      catatAudit('Ekspor', 'Data keuangan diekspor ke .xlsx (sheet Rekap & Tunggakan).', null);
      return true;
    });
  }

  function buatCsv() {
    function cell(v) {
      var s = String(v === undefined || v === null ? '' : v);
      return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }
    var csv = rowsRekap().map(function (r) {
      return r.map(cell).join(',');
    }).join('\r\n');
    return '\uFEFF' + csv;
  }

  function eksporCsv() {
    Ekspor.simpanBlob(
      new Blob([buatCsv()], { type: 'text/csv;charset=utf-8' }),
      'Keuangan_PB-Trisula_' + todayISO() + '.csv'
    );
    catatAudit('Ekspor', 'Data keuangan diekspor ke .csv (UTF-8 + BOM).', null);
    return true;
  }

  /* ==================== UI: BAGIAN BERSAMA ==================== */

  function kartuRingkasan(items) {
    return '<div class="grid-4 mb-2">' + items.map(function (it) {
      return UI.statCard(it.label, it.value, it.sub || '', it.icon || 'chart', it.tone || 'primary');
    }).join('') + '</div>';
  }

  function tabelTagihan(rows, opts) {
    opts = opts || {};
    if (!rows.length) return UI.emptyState('Belum ada tagihan.', 'save');
    return '<div class="table-wrap"><table class="table"><thead><tr>' +
      '<th>Atlet</th><th>Periode</th><th>Jenis</th><th class="align-right">Jumlah</th>' +
      '<th>Jatuh Tempo</th><th>Status</th>' +
      (opts.aksi ? '<th class="align-center">Aksi</th>' : '') +
      '</tr></thead><tbody>' +
      rows.map(function (t) {
        var st = labelStatusTagihan(t.status);
        return '<tr>' +
          '<td><b>' + Utils.esc(namaAtlet(t.id_atlet)) + '</b><div class="small muted">' + Utils.esc(t.id_atlet) + '</div></td>' +
          '<td>' + Utils.esc(periodeLabel(t.periode)) + '</td>' +
          '<td>' + Utils.esc(t.jenis) + '</td>' +
          '<td class="align-right">' + rupiah(t.jumlah) + '</td>' +
          '<td>' + Utils.fmtDate(t.jatuh_tempo) + '</td>' +
          '<td>' + UI.badge(st.label, st.tone) + (t.isDummy ? ' ' + UI.badge('Contoh', 'info') : '') + '</td>' +
          (opts.aksi ? '<td class="align-center"><div class="flex gap-1" style="justify-content:center">' +
            (t.status !== 'lunas' ? '<button type="button" class="btn btn-sm" data-k-lunas="' + Utils.esc(t.id) + '">Tandai Lunas</button>' : '') +
            '<button type="button" class="btn btn-sm btn-secondary" data-k-edit="' + Utils.esc(t.id) + '">Edit</button>' +
            '<button type="button" class="btn btn-sm btn-danger" data-k-hapus="' + Utils.esc(t.id) + '">Hapus</button>' +
            '</div></td>' : '') +
          '</tr>';
      }).join('') +
      '</tbody></table></div>';
  }

  function formTagihanHtml(t) {
    var atlet = Utils.sortBy(Store.all('athletes'), 'nama', 'asc');
    var periodeDefault = (t && t.periode) || todayISO().slice(0, 7);
    var jatuhDefault = (t && t.jatuh_tempo) || (periodeDefault + '-10');
    return '<form id="form-k-tagihan" novalidate>' +
      '<div class="form-grid cols-2">' +
      UI.field({
        name: 'id_atlet', label: 'Atlet', type: 'select', required: true,
        value: t ? t.id_atlet : '',
        options: [{ value: '', label: '-- Pilih atlet --' }].concat(atlet.map(function (a) {
          return { value: a.id_atlet, label: a.nama + ' (' + a.id_atlet + ')' };
        }))
      }) +
      UI.field({ name: 'periode', label: 'Periode (Bulan)', type: 'month', required: true, value: periodeDefault }) +
      UI.field({
        name: 'jenis', label: 'Jenis Tagihan', type: 'select', required: true,
        value: t ? t.jenis : 'SPP',
        options: JENIS_TAGIHAN.map(function (j) { return { value: j, label: j }; })
      }) +
      UI.field({ name: 'jumlah', label: 'Jumlah (Rp)', type: 'number', required: true, value: t ? t.jumlah : '', min: 1 }) +
      UI.field({ name: 'jatuh_tempo', label: 'Jatuh Tempo', type: 'date', required: true, value: jatuhDefault }) +
      UI.field({ name: 'keterangan', label: 'Keterangan', value: t ? t.keterangan : '' }) +
      '</div></form>';
  }

  function bindFormTagihan(form, onSelesai) {
    UI.bindSubmit(form, function () {
      Utils.clearErrors(form);
      var d = Utils.formData(form);
      var errors = {};
      if (!d.id_atlet) errors.id_atlet = 'Atlet wajib dipilih.';
      if (!d.periode) errors.periode = 'Periode wajib diisi.';
      if (!d.jenis) errors.jenis = 'Jenis tagihan wajib dipilih.';
      if (!d.jumlah || Number(d.jumlah) <= 0) errors.jumlah = 'Jumlah tidak valid.';
      if (!d.jatuh_tempo) errors.jatuh_tempo = 'Jatuh tempo wajib diisi.';
      if (Object.keys(errors).length) {
        Utils.showErrors(form, errors);
        Utils.toast('Periksa kembali isian yang ditandai.', 'danger');
        return;
      }
      var idEdit = form.getAttribute('data-edit-id') || null;
      simpanTagihan({
        id_atlet: d.id_atlet,
        periode: d.periode,
        jenis: d.jenis,
        jumlah: Number(d.jumlah),
        jatuh_tempo: d.jatuh_tempo,
        keterangan: d.keterangan || ''
      }, idEdit);
      UI.closeModal('m-k-tagihan');
      UI.toast(idEdit ? 'Tagihan diperbarui.' : 'Tagihan ditambahkan.', 'success');
      if (onSelesai) onSelesai();
    });
  }

  function bukaFormTagihan(t, onSelesai) {
    var host = document.getElementById('modal-host') || document.body;
    host.innerHTML = UI.modalShell('m-k-tagihan', t ? 'Edit Tagihan' : 'Tambah Tagihan',
      UI.backButton({ closeModal: 'm-k-tagihan' }) + formTagihanHtml(t),
      '<button type="button" class="btn btn-ghost" data-back-close="m-k-tagihan">Batal</button>' +
      '<button type="submit" class="btn" form="form-k-tagihan">Simpan</button>');
    UI.openModal('m-k-tagihan');
    var form = document.getElementById('form-k-tagihan');
    if (t) form.setAttribute('data-edit-id', t.id);
    bindFormTagihan(form, onSelesai);
  }

  function bukaKuitansi(p) {
    var t = tagihanById(p.tagihan_id);
    var a = Store.findOne('athletes', function (r) { return r.id_atlet === p.id_atlet; });
    var host = document.getElementById('modal-host') || document.body;
    host.innerHTML = UI.modalShell('m-k-kuitansi', 'Kuitansi Pembayaran',
      UI.backButton({ closeModal: 'm-k-kuitansi' }) + kuitansiHtml(p, t, a),
      '<button type="button" class="btn btn-ghost" data-back-close="m-k-kuitansi">Tutup</button>' +
      '<button type="button" class="btn btn-secondary" data-k-pdf="' + Utils.esc(p.id) + '">Unduh PDF</button>' +
      '<button type="button" class="btn" data-k-cetak="1">Cetak</button>');
    UI.openModal('m-k-kuitansi');
  }

  function bukaBukti(p) {
    var host = document.getElementById('modal-host') || document.body;
    var isi = '<div class="mt-2"><p class="muted">Bukti transfer atas nama ' +
      Utils.esc(namaAtlet(p.id_atlet)) + ' — ' + rupiah(p.jumlah) + '</p>' +
      '<div id="k-bukti-isi"><div class="upload-spin" aria-label="Memuat"></div></div></div>';
    host.innerHTML = UI.modalShell('m-k-bukti', 'Bukti Transfer',
      UI.backButton({ closeModal: 'm-k-bukti' }) + isi,
      '<button type="button" class="btn btn-ghost" data-back-close="m-k-bukti">Tutup</button>');
    UI.openModal('m-k-bukti');
    var kotak = document.getElementById('k-bukti-isi');
    if (!p.bukti) {
      kotak.innerHTML = UI.emptyState('Bukti transfer tidak tersedia.', 'alert');
      return;
    }
    FileStore.resolveData(p.bukti).then(function (src) {
      if (!src) {
        kotak.innerHTML = UI.emptyState('Bukti transfer tidak dapat dibuka.', 'alert');
        return;
      }
      kotak.innerHTML = '<img src="' + Utils.esc(src) + '" alt="Bukti transfer" style="max-width:100%;border-radius:10px;border:1px solid #e2e8f0">';
    }).catch(function () {
      kotak.innerHTML = UI.emptyState('Bukti transfer tidak dapat dibuka.', 'alert');
    });
  }

  /* ==================== UI: HALAMAN ADMIN ==================== */

  function halamanAdmin(root, user, app) {
    var tabAktif = 'verifikasi';
    var filter = { q: '', status: '', jenis: '' };

    function renderVerifikasi() {
      var antre = semuaPembayaran().filter(function (p) { return p.status === 'menunggu'; });
      if (!antre.length) return UI.emptyState('Tidak ada pembayaran yang menunggu verifikasi.', 'check');
      return '<div class="list-rows">' + antre.map(function (p) {
        var t = tagihanById(p.tagihan_id);
        return '<div class="list-row">' +
          '<div class="grow"><b>' + Utils.esc(namaAtlet(p.id_atlet)) + '</b>' +
          '<span>' + rupiah(p.jumlah) + ' — ' + Utils.esc((t ? t.jenis + ' ' + periodeLabel(t.periode) : 'Tagihan')) +
          ' · ' + Utils.fmtDate(p.tanggal) + (p.no_ref ? ' · ref ' + Utils.esc(p.no_ref) : '') + '</span></div>' +
          '<div class="flex gap-1">' +
          (p.bukti ? '<button type="button" class="btn btn-sm btn-secondary" data-k-bukti="' + Utils.esc(p.id) + '">Lihat Bukti</button>' : '') +
          '<button type="button" class="btn btn-sm" data-k-terima="' + Utils.esc(p.id) + '">Terima</button>' +
          '<button type="button" class="btn btn-sm btn-danger" data-k-tolak="' + Utils.esc(p.id) + '">Tolak</button>' +
          '</div></div>';
      }).join('') + '</div>';
    }

    function tagihanListHtml() {
      var q = filter.q.trim().toLowerCase();
      var rows = semuaTagihan().filter(function (t) {
        if (filter.status && t.status !== filter.status) return false;
        if (filter.jenis && t.jenis !== filter.jenis) return false;
        if (q) {
          var nama = namaAtlet(t.id_atlet) || '';
          var gabung = (nama + ' ' + t.id_atlet + ' ' + t.periode + ' ' + t.jenis).toLowerCase();
          if (gabung.indexOf(q) === -1) return false;
        }
        return true;
      });
      return tabelTagihan(rows, { aksi: true });
    }

    function renderTagihan() {
      return '<div class="filter-bar">' +
        '<input class="input" id="k-filter" placeholder="Cari nama, ID, atau periode..."' +
        ' value="' + Utils.esc(filter.q) + '">' +
        '<select class="input" id="k-filter-status" style="max-width:190px">' +
        '<option value="">Semua status</option>' +
        STATUS_TAGIHAN.map(function (s) {
          return '<option value="' + s.value + '"' + (filter.status === s.value ? ' selected' : '') + '>' + s.label + '</option>';
        }).join('') +
        '</select>' +
        '<select class="input" id="k-filter-jenis" style="max-width:170px">' +
        '<option value="">Semua jenis</option>' +
        JENIS_TAGIHAN.map(function (j) {
          return '<option value="' + j + '"' + (filter.jenis === j ? ' selected' : '') + '>' + j + '</option>';
        }).join('') +
        '</select>' +
        '</div>' +
        '<div id="k-tagihan-list">' + tagihanListHtml() + '</div>';
    }

    function renderLaporan() {
      var rek = Store.all(K_REKENING);
      var audit = Utils.sortBy(Store.all(K_AUDIT), 'waktu', 'desc').slice(0, 12);
      return '<div class="flex gap-1 mb-2">' +
        '<button type="button" class="btn" data-k-ekspor-xlsx="1">Ekspor .xlsx (Rekap &amp; Tunggakan)</button>' +
        '<button type="button" class="btn btn-secondary" data-k-ekspor-csv="1">Ekspor .csv</button>' +
        '</div>' +
        '<h4 class="mb-1">Pemasukan 6 Bulan Terakhir</h4>' +
        '<div class="chart-box" style="position:relative;height:280px"><canvas id="k-chart-masuk"></canvas></div>' +
        '<h4 class="mt-3 mb-1">Komposisi Status Tagihan</h4>' +
        '<div class="chart-box" style="position:relative;height:260px;max-width:360px"><canvas id="k-chart-status"></canvas></div>' +
        '<h4 class="mt-3 mb-1">Rekening Tujuan Transfer</h4>' +
        (rek.length ? '<div class="list-rows">' + rek.map(function (r) {
          return '<div class="list-row"><div class="grow"><b>' + Utils.esc(r.nama_bank) + ' ' + Utils.esc(r.no_rekening) + '</b>' +
            '<span>a.n. ' + Utils.esc(r.atas_nama) + '</span></div>' +
            UI.badge(r.aktif === false ? 'Nonaktif' : 'Aktif', r.aktif === false ? 'danger' : 'ok') +
            '<button type="button" class="btn btn-sm btn-secondary" data-k-rek-toggle="' + Utils.esc(r.id) + '">' +
            (r.aktif === false ? 'Aktifkan' : 'Nonaktifkan') + '</button></div>';
        }).join('') + '</div>' : UI.emptyState('Belum ada rekening tujuan. Tambahkan lewat tombol di bawah.', 'info')) +
        '<button type="button" class="btn btn-secondary mt-2" data-k-rek-tambah="1">Tambah Rekening</button>' +
        '<h4 class="mt-3 mb-1">Jejak Audit</h4>' +
        (audit.length ? '<div class="list-rows">' + audit.map(function (a) {
          return '<div class="list-row"><div class="grow"><b>' + Utils.esc(a.aksi) + '</b>' +
            '<span>' + Utils.esc(a.detail) + '</span></div>' +
            '<div class="small muted">' + Utils.esc(a.oleh || '-') + '<br>' + Utils.fmtDate((a.waktu || '').slice(0, 10), true) + '</div></div>';
        }).join('') + '</div>' : UI.emptyState('Belum ada aktivitas.', 'info'));
    }

    function isiTab() {
      var host = document.getElementById('k-panel');
      if (!host) return;
      if (tabAktif === 'verifikasi') host.innerHTML = renderVerifikasi();
      else if (tabAktif === 'tagihan') host.innerHTML = renderTagihan();
      else {
        host.innerHTML = renderLaporan();
        renderCharts();
      }
    }

    function renderCharts() {
      var canvas1 = document.getElementById('k-chart-masuk');
      var canvas2 = document.getElementById('k-chart-status');
      if (canvas1 && typeof Charts !== 'undefined' && Charts.bar) {
        var label = [], data = [];
        var now = new Date();
        for (var i = 5; i >= 0; i--) {
          var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
          label.push(periodeLabel(key));
          var total = 0;
          semuaPembayaran().forEach(function (p) {
            if (p.status === 'diterima' && String(p.tanggal || '').slice(0, 7) === key) {
              total += Number(p.jumlah) || 0;
            }
          });
          data.push(total);
        }
        Charts.bar(canvas1, label,
          [{ label: 'Pemasukan (Rp)', data: data, color: '#0b3d91' }],
          { noLegend: true, yTitle: 'Rupiah' });
      }
      if (canvas2 && typeof Charts !== 'undefined' && Charts.doughnut) {
        var s = statistik();
        Charts.doughnut(canvas2,
          ['Lunas', 'Menunggu Verifikasi', 'Belum Bayar'],
          [s.lunas, s.menunggu, s.belum], {});
      }
    }

    function headerBar() {
      var s = statistik();
      return kartuRingkasan([
        { label: 'Total Tagihan', value: String(s.total), sub: rupiah(s.nominal), icon: 'save' },
        { label: 'Pemasukan Bulan Ini', value: rupiah(s.pemasukanBulanIni), icon: 'chart', tone: 'ok' },
        { label: 'Menunggu Verifikasi', value: String(s.menunggu), icon: 'refresh', tone: 'warn' },
        { label: 'Tunggakan', value: rupiah(s.tunggakan), sub: s.belum + ' tagihan belum bayar', icon: 'alert', tone: 'danger' }
      ]);
    }

    root.innerHTML = '<div class="page">' +
      UI.pageHeader('Keuangan & Iuran', 'Kelola tagihan, verifikasi pembayaran, dan laporan keuangan atlet.',
        '<button type="button" class="btn btn-secondary" data-k-dummy="1">Muat Data Contoh</button>' +
        '<button type="button" class="btn btn-ghost" data-k-dummy-hapus="1">Hapus Data Dummy</button>' +
        '<button type="button" class="btn" data-k-tambah="1">Tambah Tagihan</button>') +
      '<div id="k-ringkasan">' + headerBar() + '</div>' +
      '<div class="card">' +
      '<div class="tabs" role="tablist">' +
      '<button type="button" class="tab active" data-k-tab="verifikasi">Verifikasi</button>' +
      '<button type="button" class="tab" data-k-tab="tagihan">Semua Tagihan</button>' +
      '<button type="button" class="tab" data-k-tab="laporan">Laporan &amp; Rekening</button>' +
      '</div>' +
      '<div class="mt-2" id="k-panel"></div>' +
      '</div></div>';

    isiTab();

    root.addEventListener('click', function (e) {
      var el;
      if ((el = e.target.closest('[data-k-tab]'))) {
        tabAktif = el.getAttribute('data-k-tab');
        root.querySelectorAll('[data-k-tab]').forEach(function (b) {
          b.classList.toggle('active', b === el);
        });
        isiTab();
        return;
      }
      if (e.target.closest('[data-k-tambah]')) {
        bukaFormTagihan(null, function () {
          root.querySelector('#k-ringkasan').innerHTML = headerBar();
          isiTab();
        });
        return;
      }
      if ((el = e.target.closest('[data-k-edit]'))) {
        bukaFormTagihan(tagihanById(el.getAttribute('data-k-edit')), function () {
          root.querySelector('#k-ringkasan').innerHTML = headerBar();
          isiTab();
        });
        return;
      }
      if ((el = e.target.closest('[data-k-hapus]'))) {
        var t = tagihanById(el.getAttribute('data-k-hapus'));
        if (!t) return;
        UI.confirmDialog('Hapus tagihan ' + t.jenis + ' ' + periodeLabel(t.periode) +
          ' atas nama ' + namaAtlet(t.id_atlet) + '? Pembayaran terkait ikut dihapus.', 'Hapus Tagihan').then(function (ok) {
            if (!ok) return;
            hapusTagihan(t.id);
            root.querySelector('#k-ringkasan').innerHTML = headerBar();
            isiTab();
            UI.toast('Tagihan dihapus.', 'success');
          });
        return;
      }
      if ((el = e.target.closest('[data-k-lunas]'))) {
        var tl = tagihanById(el.getAttribute('data-k-lunas'));
        if (!tl) return;
        UI.confirmDialog('Catat pembayaran tunai untuk tagihan ' + tl.jenis + ' ' +
          periodeLabel(tl.periode) + ' (' + rupiah(tl.jumlah) + ')?', 'Tandai Lunas').then(function (ok) {
            if (!ok) return;
            var no = tandaiLunas(tl.id, user.nama);
            root.querySelector('#k-ringkasan').innerHTML = headerBar();
            isiTab();
            UI.toast('Tagihan lunas. Kuitansi ' + no + ' diterbitkan.', 'success');
          });
        return;
      }
      if ((el = e.target.closest('[data-k-bukti]'))) {
        bukaBukti(Store.find(K_BAYAR, el.getAttribute('data-k-bukti')));
        return;
      }
      if ((el = e.target.closest('[data-k-terima]'))) {
        var pb = Store.find(K_BAYAR, el.getAttribute('data-k-terima'));
        if (!pb) return;
        UI.confirmDialog('Terima pembayaran ' + rupiah(pb.jumlah) + ' dari ' +
          namaAtlet(pb.id_atlet) + '? Kuitansi akan diterbitkan.', 'Terima Pembayaran').then(function (ok) {
            if (!ok) return;
            var no = terimaPembayaran(pb.id, user.nama);
            root.querySelector('#k-ringkasan').innerHTML = headerBar();
            isiTab();
            UI.toast('Pembayaran diterima. Kuitansi ' + no + '.', 'success');
          });
        return;
      }
      if ((el = e.target.closest('[data-k-tolak]'))) {
        var pt = Store.find(K_BAYAR, el.getAttribute('data-k-tolak'));
        if (!pt) return;
        UI.confirmDialog('Tolak pembayaran ' + rupiah(pt.jumlah) + ' dari ' +
          namaAtlet(pt.id_atlet) + '?', 'Tolak Pembayaran').then(function (ok) {
            if (!ok) return;
            tolakPembayaran(pt.id, 'Bukti pembayaran tidak dapat diverifikasi.', user.nama);
            root.querySelector('#k-ringkasan').innerHTML = headerBar();
            isiTab();
            UI.toast('Pembayaran ditolak.', 'success');
          });
        return;
      }
      if (e.target.closest('[data-k-dummy]')) {
        var hasil = muatDataDummy();
        UI.toast(hasil.pesan, hasil.ok ? 'success' : 'danger');
        root.querySelector('#k-ringkasan').innerHTML = headerBar();
        isiTab();
        return;
      }
      if (e.target.closest('[data-k-dummy-hapus]')) {
        var h = hapusDataDummy();
        UI.toast('Data contoh dihapus (' + h.tagihan + ' tagihan, ' + h.bayar + ' pembayaran).', 'success');
        root.querySelector('#k-ringkasan').innerHTML = headerBar();
        isiTab();
        return;
      }
      if (e.target.closest('[data-k-ekspor-xlsx]')) {
        eksporXlsx().then(function () {
          UI.toast('Berkas .xlsx berhasil dibuat.', 'success');
        }).catch(function (err) {
          UI.toast(err.message, 'danger');
        });
        return;
      }
      if (e.target.closest('[data-k-ekspor-csv]')) {
        eksporCsv();
        UI.toast('Berkas .csv berhasil dibuat.', 'success');
        return;
      }
      if ((el = e.target.closest('[data-k-rek-toggle]'))) {
        var r = Store.find(K_REKENING, el.getAttribute('data-k-rek-toggle'));
        if (!r) return;
        Store.update(K_REKENING, r.id, { aktif: r.aktif === false });
        catatAudit('Rekening', 'Rekening ' + r.nama_bank + ' ' + r.no_rekening + ' ' +
          (r.aktif === false ? 'diaktifkan' : 'dinonaktifkan') + '.', user.nama);
        isiTab();
        return;
      }
      if (e.target.closest('[data-k-rek-tambah]')) {
        bukaFormRekening(function () { isiTab(); });
        return;
      }
    });

    root.addEventListener('change', function (e) {
      if (e.target.id === 'k-filter-status') {
        filter.status = e.target.value;
        var hostS = document.getElementById('k-tagihan-list');
        if (hostS) hostS.innerHTML = tagihanListHtml();
      }
      if (e.target.id === 'k-filter-jenis') {
        filter.jenis = e.target.value;
        var hostJ = document.getElementById('k-tagihan-list');
        if (hostJ) hostJ.innerHTML = tagihanListHtml();
      }
    });
    root.addEventListener('input', Utils.debounce(function (e) {
      if (e.target.id === 'k-filter') {
        filter.q = e.target.value;
        var hostQ = document.getElementById('k-tagihan-list');
        if (hostQ) hostQ.innerHTML = tagihanListHtml();
      }
    }, 200));
  }

  function bukaFormRekening(onSelesai) {
    var host = document.getElementById('modal-host') || document.body;
    host.innerHTML = UI.modalShell('m-k-rek', 'Tambah Rekening',
      UI.backButton({ closeModal: 'm-k-rek' }) +
      '<form id="form-k-rek" novalidate>' +
      UI.field({ name: 'nama_bank', label: 'Nama Bank', required: true, placeholder: 'contoh: BCA' }) +
      UI.field({ name: 'no_rekening', label: 'No. Rekening', required: true, placeholder: 'contoh: 1234567890' }) +
      UI.field({ name: 'atas_nama', label: 'Atas Nama', required: true, placeholder: 'contoh: PB Trisula Surabaya' }) +
      '</form>',
      '<button type="button" class="btn btn-ghost" data-back-close="m-k-rek">Batal</button>' +
      '<button type="submit" class="btn" form="form-k-rek">Simpan</button>');
    UI.openModal('m-k-rek');
    UI.bindSubmit(document.getElementById('form-k-rek'), function () {
      var f = document.getElementById('form-k-rek');
      Utils.clearErrors(f);
      var d = Utils.formData(f);
      var errors = {};
      if (!d.nama_bank) errors.nama_bank = 'Nama bank wajib diisi.';
      if (!d.no_rekening) errors.no_rekening = 'No. rekening wajib diisi.';
      if (!d.atas_nama) errors.atas_nama = 'Atas nama wajib diisi.';
      if (Object.keys(errors).length) {
        Utils.showErrors(f, errors);
        return;
      }
      Store.insert(K_REKENING, {
        id: 'rek_' + Date.now().toString(36),
        nama_bank: d.nama_bank,
        no_rekening: d.no_rekening,
        atas_nama: d.atas_nama,
        aktif: true
      });
      catatAudit('Rekening', 'Rekening ' + d.nama_bank + ' ' + d.no_rekening + ' ditambahkan.', null);
      UI.closeModal('m-k-rek');
      UI.toast('Rekening ditambahkan.', 'success');
      if (onSelesai) onSelesai();
    });
  }

  /* ==================== UI: HALAMAN ATLET ==================== */

  function halamanAtlet(root, user, app) {
    var a = atletDariUser(user);
    if (!a) {
      root.innerHTML = '<div class="page">' + UI.emptyState('Data atlet tidak ditemukan.', 'alert') + '</div>';
      return;
    }
    var idAtlet = a.id_atlet;

    function refresh() {
      app.go('iuran-saya');
    }

    function tagihanSaya() {
      return Utils.sortBy(Store.where(K_TAGIHAN, function (t) { return t.id_atlet === idAtlet; }),
        'dibuat_pada', 'desc');
    }

    function bayarSaya() {
      return Utils.sortBy(Store.where(K_BAYAR, function (p) { return p.id_atlet === idAtlet; }),
        'dibuat_pada', 'desc');
    }

    function headerAtlet() {
      var s = statistikAtlet(idAtlet);
      return kartuRingkasan([
        { label: 'Total Tagihan', value: String(s.total), icon: 'save' },
        { label: 'Sudah Lunas', value: String(s.lunas), icon: 'check', tone: 'ok' },
        { label: 'Menunggu Verifikasi', value: String(s.menunggu), icon: 'refresh', tone: 'warn' },
        { label: 'Sisa Tagihan', value: rupiah(s.sisa), icon: 'alert', tone: 'danger' }
      ]);
    }

    function daftarTagihanHtml() {
      var rows = tagihanSaya();
      if (!rows.length) return UI.emptyState('Belum ada tagihan untuk Anda.', 'save');
      return '<div class="list-rows">' + rows.map(function (t) {
        var st = labelStatusTagihan(t.status);
        return '<div class="list-row"><div class="grow"><b>' + Utils.esc(t.jenis) + ' — ' +
          Utils.esc(periodeLabel(t.periode)) + '</b>' +
          '<span>' + rupiah(t.jumlah) + ' · jatuh tempo ' + Utils.fmtDate(t.jatuh_tempo) +
          (t.keterangan ? ' · ' + Utils.esc(t.keterangan) : '') + '</span></div>' +
          UI.badge(st.label, st.tone) +
          (t.status === 'belum'
            ? '<button type="button" class="btn btn-sm" data-k-bayar="' + Utils.esc(t.id) + '">Bayar</button>'
            : (t.status === 'menunggu'
              ? '<button type="button" class="btn btn-sm btn-ghost" data-k-riwayat="1">Menunggu Verifikasi</button>'
              : '')) +
          '</div>';
      }).join('') + '</div>';
    }

    function riwayatHtml() {
      var rows = bayarSaya();
      if (!rows.length) return UI.emptyState('Belum ada riwayat pembayaran.', 'save');
      return '<div class="list-rows">' + rows.map(function (p) {
        var t = tagihanById(p.tagihan_id);
        var stLabel = p.status === 'diterima' ? 'Diterima' : (p.status === 'menunggu' ? 'Menunggu Verifikasi' : 'Ditolak');
        var stTone = p.status === 'diterima' ? 'ok' : (p.status === 'menunggu' ? 'warn' : 'danger');
        return '<div class="list-row"><div class="grow"><b>' + rupiah(p.jumlah) + '</b>' +
          '<span>' + Utils.fmtDate(p.tanggal, true) + ' · ' +
          Utils.esc(t ? t.jenis + ' ' + periodeLabel(t.periode) : '-') +
          (p.kuitansi ? ' · ' + Utils.esc(p.kuitansi) : '') +
          (p.catatan ? ' · ' + Utils.esc(p.catatan) : '') + '</span></div>' +
          UI.badge(stLabel, stTone) +
          (p.status === 'diterima' && p.kuitansi
            ? '<button type="button" class="btn btn-sm btn-secondary" data-k-kuitansi="' + Utils.esc(p.id) + '">Kuitansi</button>'
            : (p.bukti ? '<button type="button" class="btn btn-sm btn-ghost" data-k-bukti="' + Utils.esc(p.id) + '">Bukti</button>' : '')) +
          '</div>';
      }).join('') + '</div>';
    }

    root.innerHTML = '<div class="page">' +
      UI.pageHeader('Iuran Saya', 'Tagihan iuran, pembayaran, dan kuitansi Anda.') +
      '<div id="iuran-ringkasan">' + headerAtlet() + '</div>' +
      '<div class="card"><div class="card-title">' + UI.icon('save', 20) + 'Tagihan Saya</div>' +
      '<div id="iuran-tagihan">' + daftarTagihanHtml() + '</div></div>' +
      '<div class="card mt-2"><div class="card-title">' + UI.icon('clipboard', 20) + 'Riwayat Pembayaran</div>' +
      '<div id="iuran-riwayat">' + riwayatHtml() + '</div></div>' +
      '</div>';

    function refreshPanel() {
      var r1 = document.getElementById('iuran-ringkasan');
      var r2 = document.getElementById('iuran-tagihan');
      var r3 = document.getElementById('iuran-riwayat');
      if (r1) r1.innerHTML = headerAtlet();
      if (r2) r2.innerHTML = daftarTagihanHtml();
      if (r3) r3.innerHTML = riwayatHtml();
    }

    root.addEventListener('click', function (e) {
      var el;
      if ((el = e.target.closest('[data-k-bayar]'))) {
        bukaFormBayar(tagihanById(el.getAttribute('data-k-bayar')), refreshPanel);
        return;
      }
      if ((el = e.target.closest('[data-k-kuitansi]'))) {
        bukaKuitansi(Store.find(K_BAYAR, el.getAttribute('data-k-kuitansi')));
        return;
      }
      if ((el = e.target.closest('[data-k-bukti]'))) {
        bukaBukti(Store.find(K_BAYAR, el.getAttribute('data-k-bukti')));
        return;
      }
      if (e.target.closest('[data-k-pdf]')) {
        var pid = e.target.getAttribute('data-k-pdf');
        var pb = Store.find(K_BAYAR, pid);
        UI.toast('Menyiapkan PDF kuitansi...', 'success');
        unduhPdfKuitansi((pb && pb.kuitansi ? pb.kuitansi.replace(/\//g, '-') : 'Kuitansi') + '.pdf')
          .then(function () { UI.toast('PDF kuitansi diunduh.', 'success'); })
          .catch(function (err) { UI.toast(err.message, 'danger'); });
        return;
      }
      if (e.target.closest('[data-k-cetak]')) {
        window.print();
        return;
      }
    });
  }

  function bukaFormBayar(t, onSelesai) {
    if (!t) return;
    var rek = rekeningAktif();
    var host = document.getElementById('modal-host') || document.body;
    host.innerHTML = UI.modalShell('m-k-bayar', 'Bayar Tagihan',
      UI.backButton({ closeModal: 'm-k-bayar' }) +
      '<div class="notice mb-2">' + UI.icon('info', 20) + '<div>Tagihan <b>' + Utils.esc(t.jenis) + ' — ' +
      Utils.esc(periodeLabel(t.periode)) + '</b> sebesar <b>' + rupiah(t.jumlah) + '</b>.</div></div>' +
      (rek.length
        ? '<div class="mb-2"><div class="label">Transfer ke rekening berikut:</div><div class="list-rows">' +
          rek.map(function (r) {
            return '<div class="list-row"><div class="grow"><b>' + Utils.esc(r.nama_bank) + ' ' +
              Utils.esc(r.no_rekening) + '</b><span>a.n. ' + Utils.esc(r.atas_nama) + '</span></div></div>';
          }).join('') + '</div></div>'
        : '<div class="notice warn mb-2">' + UI.icon('alert', 20) + '<div>Rekening tujuan belum diatur. Hubungi pelatih untuk informasi pembayaran.</div></div>') +
      '<form id="form-k-bayar" novalidate>' +
      '<div class="field"><label class="label">Bukti Transfer <span class="req">*</span></label>' +
      '<div id="k-bayar-bukti"></div></div>' +
      '<div class="form-grid cols-2">' +
      UI.field({ name: 'no_ref', label: 'No. Referensi (opsional)', placeholder: 'contoh: TRX123456' }) +
      UI.field({ name: 'tanggal', label: 'Tanggal Bayar', type: 'date', required: true, value: todayISO() }) +
      '</div></form>',
      '<button type="button" class="btn btn-ghost" data-back-close="m-k-bayar">Batal</button>' +
      '<button type="submit" class="btn" form="form-k-bayar">Kirim Bukti Transfer</button>');
    UI.openModal('m-k-bayar');

    var optBukti = {
      key: 'bukti-bayar',
      label: 'Bukti Transfer',
      jenis: 'foto',
      required: true,
      labelRequired: 'Bukti transfer wajib diunggah.',
      maksPx: 1200
    };
    var hostBukti = document.getElementById('k-bayar-bukti');
    hostBukti.innerHTML = Docs.boxHtml(optBukti);
    var box = Docs.bindBox(hostBukti, optBukti);

    UI.bindSubmit(document.getElementById('form-k-bayar'), function () {
      var f = document.getElementById('form-k-bayar');
      Utils.clearErrors(f);
      var d = Utils.formData(f);
      var errors = {};
      if (!d.tanggal) errors.tanggal = 'Tanggal bayar wajib diisi.';
      if (box.busy() > 0) {
        Utils.toast('Tunggu proses unggahan bukti selesai.', 'danger');
        return;
      }
      if (!box.validate(true)) errors.bukti_file = 'Bukti transfer wajib diunggah.';
      if (Object.keys(errors).length) {
        Utils.showErrors(f, errors);
        Utils.toast('Periksa kembali isian yang ditandai.', 'danger');
        return;
      }
      var bukti = box.get();
      Store.insert(K_BAYAR, {
        id: 'kb_' + Date.now().toString(36) + Math.floor(Math.random() * 1000),
        tagihan_id: t.id,
        id_atlet: t.id_atlet,
        jumlah: t.jumlah,
        tanggal: d.tanggal,
        metode: 'transfer',
        no_ref: d.no_ref || '',
        bukti: bukti,
        status: 'menunggu',
        catatan: '',
        kuitansi: '',
        dibuat_pada: new Date().toISOString()
      });
      Store.update(K_TAGIHAN, t.id, { status: 'menunggu' });
      catatAudit('Pembayaran Masuk', 'Bukti transfer ' + rupiah(t.jumlah) + ' untuk ' +
        t.jenis + ' ' + periodeLabel(t.periode) + ' dikirim oleh ' + namaAtlet(t.id_atlet) + '.', namaAtlet(t.id_atlet));
      UI.closeModal('m-k-bayar');
      UI.toast('Bukti transfer terkirim. Menunggu verifikasi pengurus.', 'success');
      if (onSelesai) onSelesai();
    });
  }

  /* ==================== MENU CONFIG MIGRASI ==================== */

  // Menambahkan menu "Keuangan & Iuran" ke koleksi menu_config yang sudah ada
  // (idempoten — dilewati bila sudah ada).
  function migrasiMenu() {
    try {
      var cfg = Store.all('menu_config');
      if (!cfg.length) return;
      var ada = cfg.some(function (m) { return m && m.id === 'keuangan'; });
      if (ada) return;
      var maxUrut = 0;
      cfg.forEach(function (m) {
        if (m && Number(m.urutan) > maxUrut) maxUrut = Number(m.urutan);
      });
      Store.insert('menu_config', {
        id: 'keuangan',
        label: 'Keuangan & Iuran',
        short: 'Keuangan',
        icon: 'save',
        bottom: false,
        urutan: maxUrut + 1,
        aktif: true
      });
    } catch (e) {}
  }

  function register() {
    migrasiMenu();
    App.register('keuangan', {
      title: 'Keuangan & Iuran',
      subtitle: 'Tagihan, verifikasi pembayaran, dan laporan keuangan',
      render: halamanAdmin
    });
    App.register('iuran-saya', {
      title: 'Iuran Saya',
      subtitle: 'Tagihan dan riwayat pembayaran iuran Anda',
      render: halamanAtlet
    });
  }

  return {
    register: register,
    badgeIuran: badgeIuran,
    statistik: statistik,
    statistikAtlet: statistikAtlet,
    muatDataDummy: muatDataDummy,
    hapusDataDummy: hapusDataDummy,
    terimaPembayaran: terimaPembayaran,
    tolakPembayaran: tolakPembayaran,
    tandaiLunas: tandaiLunas,
    simpanTagihan: simpanTagihan,
    hapusTagihan: hapusTagihan,
    nomorKuitansi: nomorKuitansi,
    terbilang: terbilang,
    kuitansiHtml: kuitansiHtml,
    rowsRekap: rowsRekap,
    rowsTunggakan: rowsTunggakan,
    buatWorkbook: buatWorkbook,
    buatCsv: buatCsv,
    eksporXlsx: eksporXlsx,
    eksporCsv: eksporCsv
  };
})();
