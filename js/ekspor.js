/* ======================================================================
   Ekspor - unduh data kehadiran ke Excel (.xlsx) dan CSV (.csv)

   - Excel memakai SheetJS (xlsx-js-style) sehingga header tebal berlatar
     biru, border, merge baris judul, freeze pane, dan format tanggal
     DD/MM/YYYY bisa diatur.
   - CSV memakai UTF-8 dengan BOM agar karakter Indonesia & Excel terbaca,
     nilai yang mengandung koma/kutip di-escape sesuai standar RFC 4180.
   ====================================================================== */
var Ekspor = (function () {

  var VERSI_XLSX = '1.2.0';
  var janjiXlsx = null;
  var BIRU_TUA = 'FF0B3D91';
  var BIRU_MUDA = 'FFE6EEFB';
  var HIJAU = 'FFDCFCE7';
  var KUNING = 'FFFEF3C7';
  var BIRU = 'FFDBEAFE';
  var MERAH = 'FFFEE2E2';

  var NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  var NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  function muatXlsx() {
    if (typeof XLSX !== 'undefined' && XLSX && XLSX.utils) return Promise.resolve(XLSX);
    if (janjiXlsx) return janjiXlsx;
    janjiXlsx = new Promise(function (resolve, reject) {
      var skrip = document.createElement('script');
      skrip.src = 'https://cdn.jsdelivr.net/npm/xlsx-js-style@' + VERSI_XLSX + '/dist/xlsx.bundle.js';
      skrip.onload = function () {
        if (typeof XLSX !== 'undefined' && XLSX && XLSX.utils) resolve(XLSX);
        else reject(new Error('Library Excel gagal dimuat.'));
      };
      skrip.onerror = function () {
        reject(new Error('Library Excel gagal dimuat. Periksa koneksi internet.'));
      };
      document.head.appendChild(skrip);
      setTimeout(function () {
        if (typeof XLSX === 'undefined' || !XLSX || !XLSX.utils) {
          reject(new Error('Library Excel gagal dimuat.'));
        }
      }, 15000);
    });
    return janjiXlsx;
  }

  function tanggalIndo(iso) {
    if (!iso) return '-';
    var p = String(iso).slice(0, 10).split('-');
    if (p.length !== 3) return String(iso);
    return p[2] + '/' + p[1] + '/' + p[0];
  }

  function hariIndo(iso) {
    if (!iso) return '-';
    var p = String(iso).slice(0, 10).split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return NAMA_HARI[d.getDay()] || '-';
  }

  function tanggalPanjang(iso) {
    if (!iso) return '-';
    var p = String(iso).slice(0, 10).split('-');
    return Number(p[2]) + ' ' + NAMA_BULAN[Number(p[1]) - 1] + ' ' + p[0];
  }

  function selTeks(v) {
    return { t: 's', v: String(v === undefined || v === null ? '' : v) };
  }
  function selAngka(v) {
    return { t: 'n', v: Number(v) || 0 };
  }
  function selHeader(v) {
    return {
      t: 's', v: String(v),
      s: {
        font: { bold: true, color: { rgb: 'FFFFFFFF' }, sz: 11 },
        fill: { fgColor: { rgb: BIRU_TUA } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: tipis()
      }
    };
  }
  function tipis() {
    var g = { style: 'thin', color: { rgb: 'FFD0D7E2' } };
    return { top: g, bottom: g, left: g, right: g };
  }
  function selIsi(v, tengah) {
    return {
      t: typeof v === 'number' ? 'n' : 's',
      v: v === undefined || v === null ? '' : v,
      s: {
        alignment: { horizontal: tengah ? 'center' : 'left', vertical: 'center', wrapText: true },
        border: tipis()
      }
    };
  }
  function warnaStatus(status) {
    if (status === 'Hadir') return HIJAU;
    if (status === 'Izin') return KUNING;
    if (status === 'Sakit') return BIRU;
    return MERAH;
  }
  function selStatus(status) {
    return {
      t: 's', v: String(status),
      s: {
        font: { bold: true },
        fill: { fgColor: { rgb: warnaStatus(status) } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: tipis()
      }
    };
  }

  // data: { judul, periode, kolom, baris, ringkasan, kolomRingkasan }
  function susunSheetRekap(XLSX, data) {
    var ws = {};
    var kolom = data.kolom || [];
    var baris = data.baris || [];
    var lebar = kolom.length;

    function barisKosong(n) {
      var r = [];
      for (var i = 0; i < n; i++) r.push({ t: 's', v: '' });
      return r;
    }

    // baris 1: judul (merge), baris 2: periode, baris 3: tanggal cetak
    var judul = barisKosong(lebar);
    judul[0] = { t: 's', v: data.judul || 'REKAP KEHADIRAN PB TRISULA SURABAYA', s: { font: { bold: true, sz: 14 }, alignment: { horizontal: 'center', vertical: 'center' } } };
    var periode = barisKosong(lebar);
    periode[0] = { t: 's', v: 'Periode: ' + (data.periode || '-'), s: { font: { bold: true, sz: 11 }, alignment: { horizontal: 'center', vertical: 'center' } } };
    var cetak = barisKosong(lebar);
    cetak[0] = { t: 's', v: 'Tanggal cetak: ' + tanggalPanjang(Utils.todayISO()), s: { alignment: { horizontal: 'center', vertical: 'center' } } };
    var kosong = barisKosong(lebar);

    var header = kolom.map(selHeader);
    var isi = baris.map(function (r) {
      return r.map(function (v, i) {
        var namaKolom = String(kolom[i] || '').toLowerCase();
        if (namaKolom === 'status') return selStatus(v);
        if (namaKolom === 'no' || namaKolom === 'jam masuk') return selIsi(v, true);
        return selIsi(v, false);
      });
    });

    ws['!ref'] = XLSX.utils.encode_range({
      s: { c: 0, r: 0 },
      e: { c: Math.max(0, lebar - 1), r: 4 + isi.length }
    });
    var semua = [judul, periode, cetak, kosong, header].concat(isi);
    semua.forEach(function (baris, ri) {
      baris.forEach(function (sel, ci) {
        ws[XLSX.utils.encode_cell({ c: ci, r: ri })] = sel;
      });
    });

    ws['!merges'] = [
      { s: { c: 0, r: 0 }, e: { c: Math.max(0, lebar - 1), r: 0 } },
      { s: { c: 0, r: 1 }, e: { c: Math.max(0, lebar - 1), r: 1 } },
      { s: { c: 0, r: 2 }, e: { c: Math.max(0, lebar - 1), r: 2 } }
    ];
    ws['!freeze'] = { xSplit: 0, ySplit: 4 };
    ws['!views'] = [{ state: 'frozen', ySplit: 4 }];
    ws['!cols'] = kolom.map(function (k) {
      var lebarK = Math.max(String(k).length + 2, 12);
      baris.forEach(function (r, i) {
        var isi2 = r[kolom.indexOf(k)];
        if (isi2 !== undefined && isi2 !== null) lebarK = Math.max(lebarK, String(isi2).length + 2);
      });
      return { wch: Math.min(40, lebarK) };
    });
    return ws;
  }

  function susunSheetRingkasan(XLSX, data) {
    var ws = {};
    var kolom = data.kolomRingkasan || ['Nama', 'ID', 'Peran', 'Hadir', 'Izin', 'Sakit', 'Tidak Hadir', 'Total Pertemuan', 'Persentase Kehadiran (%)'];
    var baris = data.ringkasan || [];
    var lebar = kolom.length;

    var judul = [];
    for (var i = 0; i < lebar; i++) judul.push({ t: 's', v: '' });
    judul[0] = { t: 's', v: 'RINGKASAN KEHADIRAN PER ORANG', s: { font: { bold: true, sz: 13 }, alignment: { horizontal: 'center', vertical: 'center' } } };
    var header = kolom.map(selHeader);
    var isi = baris.map(function (r) {
      return r.map(function (v, i) {
        var namaKolom = String(kolom[i] || '').toLowerCase();
        if (i === 0 || i === 1 || i === 2) return selIsi(v, false);
        return selIsi(v, true);
      });
    });

    ws['!ref'] = XLSX.utils.encode_range({
      s: { c: 0, r: 0 },
      e: { c: Math.max(0, lebar - 1), r: 1 + isi.length }
    });
    [judul, header].concat(isi).forEach(function (baris, ri) {
      baris.forEach(function (sel, ci) {
        ws[XLSX.utils.encode_cell({ c: ci, r: ri })] = sel;
      });
    });
    ws['!merges'] = [{ s: { c: 0, r: 0 }, e: { c: Math.max(0, lebar - 1), r: 0 } }];
    ws['!views'] = [{ state: 'frozen', ySplit: 1 }];
    ws['!cols'] = kolom.map(function (k) {
      return { wch: Math.min(32, Math.max(String(k).length + 2, 14)) };
    });
    return ws;
  }

  function unduhXlsx(data, namaFile) {
    return muatXlsx().then(function (XLSX) {
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, susunSheetRekap(XLSX, data), 'Rekap Kehadiran');
      XLSX.utils.book_append_sheet(wb, susunSheetRingkasan(XLSX, data), 'Ringkasan');
      var out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      simpanBlob(new Blob([out], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }), namaFile);
    });
  }

  function escapeCsv(v) {
    var s = String(v === undefined || v === null ? '' : v);
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function unduhCsv(data, namaFile) {
    var kolom = data.kolom || [];
    var baris = data.baris || [];
    var barisTeks = [kolom.map(escapeCsv).join(',')];
    baris.forEach(function (r) {
      barisTeks.push(r.map(escapeCsv).join(','));
    });
    // BOM UTF-8 agar Excel & aplikasi Indonesia membaca karakter dengan benar
    var isi = '\ufeff' + barisTeks.join('\r\n');
    simpanBlob(new Blob([isi], { type: 'text/csv;charset=utf-8;' }), namaFile);
    return Promise.resolve();
  }

  function simpanBlob(blob, namaFile) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = namaFile;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      if (a.parentNode) a.parentNode.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1500);
  }

  return {
    muatXlsx: muatXlsx,
    tanggalIndo: tanggalIndo,
    hariIndo: hariIndo,
    tanggalPanjang: tanggalPanjang,
    unduhXlsx: unduhXlsx,
    unduhCsv: unduhCsv,
    simpanBlob: simpanBlob
  };
})();
