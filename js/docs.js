var Docs = (function () {
  // Hanya dua dokumen wajib yang ditampilkan di antarmuka. Berkas lama
  // (Surat Kebenaran Usia, Surat Keterangan Lahir, Ijazah/Raport) yang
  // sudah pernah diunggah tetap tersimpan — cukup tidak ditampilkan lagi.
  var TYPES = [
    { key: 'kartu_keluarga', label: 'Kartu Keluarga (KK)', required: true },
    { key: 'akte_kelahiran', label: 'Akte Kelahiran', required: true }
  ];

  function maxBytes() {
    var mb = CONFIG.DOKUMEN_MAX_MB || 2;
    return mb * 1024 * 1024;
  }

  function maxLabel() {
    return 'maks. ' + (CONFIG.DOKUMEN_MAX_MB || 2) + ' MB';
  }

  /* ---------- batas & label seragam untuk SEMUA kolom unggahan ----------
     gambar: file asli maks 10 MB, dikompres otomatis hingga < 2 MB
     PDF   : maks 5 MB, disimpan apa adanya                              */
  function batas() {
    return {
      gambarSumberMb: CONFIG.UPLOAD_GAMBAR_MAKS_MB || 10,
      gambarHasilMb: CONFIG.UPLOAD_GAMBAR_HASIL_MB || 2,
      pdfMb: CONFIG.UPLOAD_PDF_MAKS_MB || 5,
      maksPx: CONFIG.UPLOAD_MAX_PX || 1600,
      timeoutDtk: CONFIG.UPLOAD_TIMEOUT_DTK || 15
    };
  }

  function labelGambar() {
    var b = batas();
    return 'JPG/PNG/WEBP maks ' + b.gambarSumberMb + ' MB (otomatis diperkecil, hasil < ' + b.gambarHasilMb + ' MB)';
  }

  function acceptAttr() {
    return '.pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp';
  }

  function labelDokumen() {
    var b = batas();
    return 'PDF maks ' + b.pdfMb + ' MB / gambar maks ' + b.gambarSumberMb + ' MB (otomatis diperkecil)';
  }

  function extOf(name) {
    var m = /\.([a-z0-9]+)$/i.exec(String(name || ''));
    return m ? m[1].toLowerCase() : '';
  }

  function isPdf(file) {
    return /pdf/i.test(String(file.type || '')) || extOf(file.name) === 'pdf';
  }

  // Membaca tipe & ekstensi dengan benar termasuk huruf besar dan file.type kosong.
  function isAccepted(file, jenis) {
    var ext = extOf(file.name);
    var tipe = String(file.type || '').toLowerCase();
    var okGambar = ['jpg', 'jpeg', 'png', 'webp'].indexOf(ext) !== -1 || /^image\/(jpeg|png|webp)$/.test(tipe);
    var okPdf = ext === 'pdf' || tipe === 'application/pdf';
    if (jenis === 'foto' || jenis === 'gambar') return okGambar;
    if (jenis === 'pdf') return okPdf;
    return okGambar || okPdf; // campuran (dokumen/lisensi)
  }

  function pesanTolak(file, jenis) {
    if (jenis === 'foto' || jenis === 'gambar') {
      return 'File harus berupa gambar JPG, PNG, atau WEBP.';
    }
    if (jenis === 'pdf') {
      return 'File harus berupa PDF.';
    }
    return 'Format file harus PDF, JPG, JPEG, atau PNG.';
  }

  function pesanUkuran(file, jenis) {
    var b = batas();
    if (isPdf(file)) {
      if (file.size > b.pdfMb * 1024 * 1024) {
        return 'Ukuran PDF maksimal ' + b.pdfMb + ' MB.';
      }
      return '';
    }
    if (file.size > b.gambarSumberMb * 1024 * 1024) {
      return 'Ukuran gambar maksimal ' + b.gambarSumberMb + ' MB.';
    }
    return '';
  }


  function isImage(doc) {
    return /^image\//.test(doc.tipe || '') || /\.(jpe?g|png)$/i.test(doc.nama || '');
  }

  function icon(name, size) {
    return UI.icon(name, size || 20);
  }

  function uploadBoxHtml(key) {
    return '<div class="doc-field" data-doc-field="' + key + '">' +
      '<div class="doc-label">' + Utils.esc(labelOf(key)) + ' <span class="req">*</span></div>' +
      '<button type="button" class="upload-box" data-doc-pick="' + key + '" aria-label="Pilih file ' + Utils.esc(labelOf(key)) + '">' +
      '<span class="upload-icon">' + icon('download', 22) + '</span>' +
      '<span class="upload-text">Pilih file PDF/JPG/PNG (' + maxLabel() + ')</span>' +
      '</button>' +
      '<input type="file" class="doc-input" data-doc-input="' + key + '" accept="' + acceptAttr() + '" hidden>' +
      '<div class="upload-actions" data-doc-actions="' + key + '" hidden>' +
      '<button type="button" class="btn btn-sm btn-secondary" data-doc-change="' + key + '">Ganti</button>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-doc-remove="' + key + '">Hapus</button>' +
      '</div>' +
      '<div class="field-error" data-doc-error="' + key + '"></div>' +
      '</div>';
  }

  function labelOf(key) {
    for (var i = 0; i < TYPES.length; i++) {
      if (TYPES[i].key === key) return TYPES[i].label;
    }
    return key;
  }

  function sectionHtml() {
    return '<section class="docs-card" id="docs-card" aria-label="Dokumen Pendaftaran">' +
      '<h3 class="docs-title">Dokumen Pendaftaran (Wajib)</h3>' +
      '<div class="docs-list">' +
      TYPES.map(function (t) {
        return uploadBoxHtml(t.key);
      }).join('') +
      '</div></section>';
  }

  function setError(fieldRoot, message) {
    var slot = fieldRoot.querySelector('[data-doc-error]');
    if (slot) slot.textContent = message || '';
    fieldRoot.classList.toggle('has-error', !!message);
  }

  /* ================= pipeline pemrosesan berkas =================
     Validasi tipe + ukuran → decode → kompres (gambar saja) → simpan
     sebagai Blob di IndexedDB → referensi. Semua dikerjakan lokal tanpa
     menunggu server/cloud, dibatasi waktu agar tidak pernah menggantung. */

  function decodeGambar(file) {
    if (typeof createImageBitmap === 'function') {
      return createImageBitmap(file).catch(function () {
        return decodeViaImage(file);
      });
    }
    return decodeViaImage(file);
  }

  function decodeViaImage(file) {
    return new Promise(function (resolve, reject) {
      var url = '';
      try {
        url = URL.createObjectURL(file);
      } catch (e) {
        reject(new Error('Gambar tidak dapat dibaca.'));
        return;
      }
      var img = new Image();
      img.onload = function () {
        resolve(img);
      };
      img.onerror = function () {
        try { URL.revokeObjectURL(url); } catch (e) {}
        reject(new Error('Gambar rusak atau formatnya tidak didukung.'));
      };
      img.src = url;
    });
  }

  function canvasKeBlob(canvas, tipe, kualitas) {
    return new Promise(function (resolve) {
      var selesai = false;
      function done(blob) {
        if (selesai) return;
        selesai = true;
        resolve(blob || null);
      }
      try {
        if (canvas.toBlob) canvas.toBlob(done, tipe, kualitas);
        else done(null);
      } catch (e) {
        done(null);
      }
      setTimeout(function () { done(null); }, 5000);
    });
  }

  function skalaCanvas(img, maksPx) {
    var skala = Math.min(1, maksPx / Math.max(img.width || img.naturalWidth, img.height || img.naturalHeight));
    var w = Math.max(1, Math.round((img.width || img.naturalWidth) * skala));
    var h = Math.max(1, Math.round((img.height || img.naturalHeight) * skala));
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas;
  }

  // Kompres sekali; bila hasil masih melebihi batas, ulangi maksimal sekali
  // dengan skala/kualitas lebih rendah (tanpa loop tak berujung).
  function kompresGambar(file, maksPxOpsi) {
    var b = batas();
    var maksPx = maksPxOpsi || b.maksPx;
    var maksByte = b.gambarHasilMb * 1024 * 1024;
    return decodeGambar(file).then(function (img) {
      var canvas = skalaCanvas(img, maksPx);
      if (!canvas) throw new Error('Gambar tidak dapat diproses.');
      var percobaan = [
        { px: maksPx, q: 0.85 },
        { px: Math.max(320, Math.round(maksPx * 0.6)), q: 0.7 }
      ];
      var i = 0;
      function langkah() {
        var p = percobaan[i];
        var c = i === 0 ? canvas : (skalaCanvas(img, p.px) || canvas);
        return canvasKeBlob(c, 'image/jpeg', p.q).then(function (blob) {
          if (blob && blob.size < maksByte) return blob;
          i++;
          if (i >= percobaan.length) return blob || canvasKeBlob(c, 'image/jpeg', 0.6);
          return langkah();
        });
      }
      return langkah().then(function (blob) {
        if (!blob) throw new Error('Gagal mengompres gambar. Coba file yang lebih kecil.');
        // thumbnail ringan untuk pratinjau (tetap di bawah ~150 KB)
        var th = skalaCanvas(img, 512) || canvas;
        var thumb = '';
        try {
          thumb = th.toDataURL('image/jpeg', 0.78);
        } catch (e) {
          thumb = '';
        }
        return { blob: blob, thumb: thumb };
      });
    });
  }

  function bacaPdf(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      var selesai = false;
      function done(blob) {
        if (selesai) return;
        selesai = true;
        resolve(blob);
      }
      reader.onerror = function () {
        if (selesai) return;
        selesai = true;
        reject(new Error('Gagal membaca file PDF.'));
      };
      reader.onload = function () {
        try {
          done(new Blob([reader.result], { type: file.type || 'application/pdf' }));
        } catch (e) {
          if (selesai) return;
          selesai = true;
          reject(new Error('Gagal membaca file PDF.'));
        }
      };
      setTimeout(function () {
        if (selesai) return;
        selesai = true;
        reject(new Error('Proses terlalu lama, coba file yang lebih kecil.'));
      }, 10000);
      reader.readAsArrayBuffer(file);
    });
  }

  function denganBatasWaktu(janji, dtk, pesan) {
    return new Promise(function (resolve, reject) {
      var selesai = false;
      var t = setTimeout(function () {
        if (selesai) return;
        selesai = true;
        reject(new Error(pesan || ('Proses terlalu lama, coba file yang lebih kecil. (batas ' + dtk + ' detik)')));
      }, dtk * 1000);
      janji.then(function (v) {
        if (selesai) return;
        selesai = true;
        clearTimeout(t);
        resolve(v);
      }, function (e) {
        if (selesai) return;
        selesai = true;
        clearTimeout(t);
        reject(e);
      });
    });
  }

  /* Proses satu berkas → { fid, nama, Tipe, ukuran, thumb, data, dibuat_pada }.
     Tidak PERNAH menggantung: seluruh rangkaian dibatasi waktu dan selalu
     menolak dengan pesan jelas bila gagal (pemanggil merender di blok finally). */
  function prosesBerkas(file, opts) {
    opts = opts || {};
    var jenis = opts.jenis || 'campuran';
    var b = batas();
    if (!file) return Promise.reject(new Error('Pilih file terlebih dahulu.'));
    if (!isAccepted(file, jenis)) return Promise.reject(new Error(pesanTolak(file, jenis)));
    var tolakUkuran = pesanUkuran(file, jenis);
    if (tolakUkuran) return Promise.reject(new Error(tolakUkuran));

    var janji;
    if (isPdf(file)) {
      janji = bacaPdf(file).then(function (blob) {
        return { blob: blob, thumb: '' };
      });
    } else {
      janji = kompresGambar(file, opts.maksPx);
    }

    return denganBatasWaktu(janji, b.timeoutDtk).then(function (hasil) {
      return FileStore.simpan(hasil.blob, {
        nama: file.name || 'berkas',
        tipe: hasil.blob.type || file.type || '',
        ukuran: hasil.blob.size
      }).then(function (ref) {
        return {
          fid: ref.fid,
          nama: ref.nama,
          tipe: ref.tipe,
          ukuran: ref.ukuran,
          thumb: hasil.thumb,
          data: '',          // isi berkas ada di IndexedDB (lihat fid)
          dibuat_pada: Utils.nowISO ? Utils.nowISO() : new Date().toISOString()
        };
      });
    });
  }

  // Muat isi berkas (data URL) dari referensi: lama (data) atau baru (fid).
  function isiBerkas(ref) {
    if (!ref) return Promise.resolve('');
    if (typeof ref === 'string') return Promise.resolve(ref);
    if (ref.data) return Promise.resolve(ref.data);
    if (ref.fid && typeof FileStore !== 'undefined') {
      return FileStore.url(ref.fid).then(function (u) {
        return u || ref.thumb || '';
      }).catch(function () {
        return ref.thumb || '';
      });
    }
    return Promise.resolve(ref.thumb || '');
  }

  function renderFilled(fieldRoot, doc) {
    var box = fieldRoot.querySelector('.upload-box');
    var actions = fieldRoot.querySelector('[data-doc-actions]');
    if (!box) return;
    var src = doc && (doc.thumb || doc.data) || '';
    var thumb = (src && isImage(doc))
      ? '<span class="upload-thumb"><img src="' + src + '" alt=""></span>'
      : '<span class="upload-icon">' + icon('clipboard', 22) + '</span>';
    box.classList.add('filled');
    box.classList.remove('processing');
    box.innerHTML = thumb +
      '<span class="upload-text is-file" title="' + Utils.esc(doc.nama) + '">' + Utils.esc(doc.nama) + '</span>' +
      '<span class="upload-check">' + icon('check', 20) + '</span>';
    if (actions) actions.hidden = false;
    setError(fieldRoot, '');
  }

  function renderProcessing(fieldRoot) {
    var box = fieldRoot.querySelector('.upload-box');
    var actions = fieldRoot.querySelector('[data-doc-actions]');
    if (!box) return;
    box.classList.remove('filled');
    box.classList.add('processing');
    box.innerHTML = '<span class="upload-icon">' + icon('download', 22) + '</span>' +
      '<span class="upload-text">Memproses...</span>' +
      '<span class="upload-spin" aria-hidden="true"></span>';
    if (actions) actions.hidden = true;
    setError(fieldRoot, '');
  }

  function renderEmpty(fieldRoot) {
    var box = fieldRoot.querySelector('.upload-box');
    var actions = fieldRoot.querySelector('[data-doc-actions]');
    var input = fieldRoot.querySelector('[data-doc-input]');
    if (!box) return;
    if (input) {
      try {
        input.value = '';
      } catch (e) {}
    }
    box.classList.remove('filled', 'processing');
    box.innerHTML = '<span class="upload-icon">' + icon('download', 22) + '</span>' +
      '<span class="upload-text">Pilih file PDF/JPG/PNG (' + maxLabel() + ')</span>';
    if (actions) actions.hidden = true;
  }

  function renderGagal(fieldRoot, key, pesan) {
    var box = fieldRoot.querySelector('.upload-box');
    var actions = fieldRoot.querySelector('[data-doc-actions]');
    if (!box) return;
    box.classList.remove('filled', 'processing');
    box.innerHTML = '<span class="upload-icon" style="color:var(--danger)">' + icon('clipboard', 22) + '</span>' +
      '<span class="upload-text">Gagal memproses file</span>' +
      '<button type="button" class="btn btn-sm btn-secondary" data-doc-pick="' + Utils.esc(key) + '">Coba lagi</button>';
    if (actions) actions.hidden = true;
    setError(fieldRoot, pesan || '');
  }

  function bind(root, options) {
    options = options || {};
    var state = {};
    var existing = options.dokumen || {};
    var sedang = 0;

    function kabarBusy() {
      if (options.onBusy) options.onBusy(sedang);
    }

    TYPES.forEach(function (t) {
      if (existing[t.key]) {
        state[t.key] = existing[t.key];
        var fr = root.querySelector('[data-doc-field="' + t.key + '"]');
        if (fr) renderFilled(fr, state[t.key]);
      }
    });

    function fieldRootOf(key) {
      return root.querySelector('[data-doc-field="' + key + '"]');
    }

    function pick(key) {
      var input = root.querySelector('[data-doc-input="' + key + '"]');
      if (input) {
        input.value = '';
        input.click();
      }
    }

    function onPick(key, file) {
      var fieldRoot = fieldRootOf(key);
      if (!file) return;
      sedang++;
      kabarBusy();
      renderProcessing(fieldRoot);
      // Proses lokal: validasi → kompres → IndexedDB. Selalu berakhir
      // (ada batas waktu 15 dtk di Docs.prosesBerkas) dan status dikembalikan.
      prosesBerkas(file, { jenis: 'campuran' }).then(function (doc) {
        state[key] = doc;
        renderFilled(fieldRoot, doc);
        if (options.onChange) options.onChange(state);
      }, function (err) {
        delete state[key];
        renderGagal(fieldRoot, key, err.message);
        Utils.toast(err.message, 'danger');
        if (options.onChange) options.onChange(state);
      }).then(function () {
        sedang = Math.max(0, sedang - 1);
        kabarBusy();
      });
    }

    root.addEventListener('click', function (e) {
      var p = e.target.closest('[data-doc-pick]');
      if (p) {
        e.preventDefault();
        pick(p.getAttribute('data-doc-pick'));
        return;
      }
      var c = e.target.closest('[data-doc-change]');
      if (c) {
        e.preventDefault();
        pick(c.getAttribute('data-doc-change'));
        return;
      }
      var r = e.target.closest('[data-doc-remove]');
      if (r) {
        e.preventDefault();
        var key = r.getAttribute('data-doc-remove');
        var lama = state[key];
        delete state[key];
        var fr = fieldRootOf(key);
        if (fr) {
          renderEmpty(fr);
          setError(fr, '');
        }
        if (lama && lama.fid && typeof FileStore !== 'undefined') FileStore.hapus(lama.fid);
        if (options.onChange) options.onChange(state);
      }
    });

    root.addEventListener('change', function (e) {
      var input = e.target.closest('[data-doc-input]');
      if (!input) return;
      onPick(input.getAttribute('data-doc-input'), input.files && input.files[0]);
    });

    return {
      get: function () {
        return state;
      },
      set: function (key, doc) {
        if (doc) {
          state[key] = doc;
          renderFilled(fieldRootOf(key), doc);
        } else {
          delete state[key];
          renderEmpty(fieldRootOf(key));
        }
      },
      reset: function () {
        TYPES.forEach(function (t) {
          delete state[t.key];
          var fr = fieldRootOf(t.key);
          if (fr) {
            renderEmpty(fr);
            setError(fr, '');
          }
        });
      },
      busy: function () {
        return sedang;
      },
      validate: function () {
        var missing = [];
        TYPES.forEach(function (t) {
          var fr = fieldRootOf(t.key);
          if (!state[t.key]) {
            missing.push(t.key);
            if (fr) setError(fr, 'Dokumen ini wajib diunggah');
          } else if (fr) {
            setError(fr, '');
          }
        });
        if (missing.length) {
          var first = fieldRootOf(missing[0]);
          if (first && first.scrollIntoView) {
            first.scrollIntoView({ behavior: 'smooth', block: 'center' });
            var btn = first.querySelector('.upload-box');
            if (btn && btn.focus) btn.focus({ preventScroll: true });
          }
          return false;
        }
        return true;
      }
    };
  }

  /* ---------- Komponen unggah multi-berkas (contoh: Sertifikat) ----------
     Bisa menampung beberapa berkas (default maks 5) dalam satu kolom,
     dengan pratinjau daftar berkas dan tombol Hapus per berkas. Proses
     dan batasan ukuran sama dengan komponen unggah tunggal. */
  function boxMultiHtml(opts) {
    opts = opts || {};
    var key = opts.key || 'files';
    var label = opts.label || 'Berkas';
    var maks = opts.maks || 5;
    var accept = opts.jenis === 'foto'
      ? 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp'
      : acceptAttr();
    return '<div class="doc-field" data-up-field="' + Utils.esc(key) + '">' +
      '<div class="doc-label">' + Utils.esc(label) + (opts.required ? ' <span class="req">*</span>' : '') +
      ' <span class="small muted">(maksimal ' + maks + ' berkas)</span></div>' +
      '<button type="button" class="upload-box" data-up-pick="' + Utils.esc(key) + '" aria-label="Pilih file ' + Utils.esc(label) + '">' +
      '<span class="upload-icon">' + icon('download', 22) + '</span>' +
      '<span class="upload-text">Pilih file (bisa lebih dari satu)</span>' +
      '</button>' +
      '<input type="file" class="doc-input" data-up-input="' + Utils.esc(key) + '" accept="' + accept + '" multiple hidden>' +
      '<div class="upload-actions" data-up-actions="' + Utils.esc(key) + '" hidden>' +
      '<button type="button" class="btn btn-sm btn-secondary" data-up-change="' + Utils.esc(key) + '">Tambah / Ganti</button>' +
      '</div>' +
      '<div class="doc-multi-list" data-up-list="' + Utils.esc(key) + '"></div>' +
      '<div class="field-error" data-up-error="' + Utils.esc(key) + '"></div>' +
      '</div>';
  }

  function bindBoxMulti(root, options) {
    options = options || {};
    var key = options.key || 'files';
    var jenis = options.jenis || 'campuran';
    var maks = options.maks || 5;
    var items = [];
    var proses = 0;

    function fieldRoot() { return root.querySelector('[data-up-field="' + key + '"]'); }
    function sel(s) {
      var fr = fieldRoot();
      return fr ? fr.querySelector(s) : null;
    }
    function setErr(pesan) {
      var slot = sel('[data-up-error]');
      if (slot) slot.textContent = pesan || '';
      var fr = fieldRoot();
      if (fr) fr.classList.toggle('has-error', !!pesan);
    }
    function kabar() {
      if (options.onBusy) options.onBusy();
    }
    function ukuranTeks(n) {
      return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
    }
    function render() {
      var list = sel('[data-up-list]');
      if (!list) return;
      list.innerHTML = items.map(function (it, i) {
        return '<div class="file-chip">' +
          '<div class="grow"><b>' + Utils.esc(it.nama || 'berkas') + '</b>' +
          '<div class="small muted">' + Utils.esc(it.tipe || '') + ' / ' + Utils.esc(ukuranTeks(it.ukuran || 0)) + '</div></div>' +
          '<button type="button" class="btn btn-sm btn-danger" data-up-hapus-multi="' + i + '">Hapus</button>' +
          '</div>';
      }).join('');
      var act = sel('[data-up-actions]');
      if (act) act.hidden = items.length === 0;
      setErr('');
    }
    function onFiles(fileList) {
      var daftar = Array.prototype.slice.call(fileList || []);
      if (!daftar.length) return;
      if (items.length + daftar.length > maks) {
        setErr('Maksimal ' + maks + ' berkas. Berkas berlebih tidak ditambahkan.');
        daftar = daftar.slice(0, Math.max(0, maks - items.length));
      }
      daftar.forEach(function (file) {
        if (!isAccepted(file, jenis)) {
          setErr(pesanTolak(file, jenis));
          return;
        }
        var pesanBesar = pesanUkuran(file, jenis);
        if (pesanBesar) {
          setErr(pesanBesar);
          return;
        }
        proses++;
        kabar();
        prosesBerkas(file, { jenis: jenis, maksPx: options.maksPx }).then(function (doc) {
          items.push(doc);
          render();
        }).catch(function (err) {
          setErr(err && err.message ? err.message : 'Gagal memproses berkas.');
        }).then(function () {
          proses--;
          kabar();
        });
      });
    }

    root.addEventListener('click', function (e) {
      var pick = e.target.closest ? e.target.closest('[data-up-pick="' + key + '"]') : null;
      if (pick) {
        var input = sel('[data-up-input]');
        if (input) input.click();
        return;
      }
      var change = e.target.closest ? e.target.closest('[data-up-change="' + key + '"]') : null;
      if (change) {
        var inp2 = sel('[data-up-input]');
        if (inp2) inp2.click();
        return;
      }
      var hapus = e.target.closest ? e.target.closest('[data-up-hapus-multi]') : null;
      if (hapus) {
        var idx = parseInt(hapus.getAttribute('data-up-hapus-multi'), 10);
        if (!isNaN(idx)) {
          items.splice(idx, 1);
          render();
          if (options.onChange) options.onChange(get());
        }
      }
    });
    root.addEventListener('change', function (e) {
      var input = e.target.closest ? e.target.closest('[data-up-input="' + key + '"]') : null;
      if (input) {
        onFiles(input.files);
        input.value = '';
      }
    });

    function get() {
      return items.slice();
    }

    render();
    return {
      get: get,
      validate: function (tampilkanError) {
        if (options.required && !items.length) {
          if (tampilkanError) setErr(options.labelRequired || 'Minimal satu berkas wajib diunggah.');
          return false;
        }
        return true;
      },
      busy: function () { return proses; },
      set: function (docs) {
        items = Array.isArray(docs) ? docs.slice() : (docs ? [docs] : []);
        render();
      },
      reset: function () {
        items = [];
        render();
      }
    };
  }

  function downloadDoc(doc) {
    if (!doc) return;
    isiBerkas(doc).then(function (src) {
      if (!src) {
        Utils.toast('Dokumen tidak tersedia.', 'danger');
        return;
      }
      downloadRef(doc, src);
    });
  }

  function openViewer(doc, label) {
    if (!doc) {
      Utils.toast('Dokumen tidak tersedia.', 'danger');
      return;
    }
    // Muat isi berkas (data lama atau Blob IndexedDB baru) lalu tampilkan.
    isiBerkas(doc).then(function (src) {
      if (!src) {
        Utils.toast('Dokumen tidak tersedia.', 'danger');
        return;
      }
      var host = document.getElementById('modal-host') || document.body;
      var preview;
      if (isImage(doc)) {
        preview = '<div class="doc-preview"><img src="' + src + '" alt="' + Utils.esc(label) + '"></div>';
      } else {
        preview = '<div class="doc-preview doc-preview-pdf"><iframe src="' + src + '" title="' + Utils.esc(label) + '"></iframe></div>';
      }
      var body = '<div class="doc-viewer-head">' +
        '<div><div class="doc-label">' + Utils.esc(label) + '</div>' +
        '<div class="small muted" title="' + Utils.esc(doc.nama) + '">' + Utils.esc(doc.nama) +
        (doc.ukuran ? ' · ' + Utils.fmtNumber(Math.round(doc.ukuran / 1024)) + ' KB' : '') + '</div></div>' +
        '</div>' + preview;

      host.innerHTML = UI.modalShell('m-doc-view', 'Pratinjau Dokumen',
        UI.backButton({ closeModal: 'm-doc-view' }) + body,
        '<button type="button" class="btn btn-ghost" data-back-close="m-doc-view">Tutup</button>' +
        '<button type="button" class="btn" id="m-doc-download">' + icon('download', 20) + ' Unduh</button>');
      UI.openModal('m-doc-view');

      var dl = document.getElementById('m-doc-download');
      if (dl) dl.addEventListener('click', function () {
        downloadRef(doc, src);
      });
    });
  }

  function downloadRef(doc, src) {
    var a = document.createElement('a');
    a.href = src || doc.data || '';
    a.download = doc.nama || 'dokumen';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      if (a.parentNode) a.parentNode.removeChild(a);
    }, 100);
  }

  function viewerHtml(dokumen) {
    dokumen = dokumen || {};
    return '<div class="docs-viewer">' + TYPES.map(function (t) {
      var doc = dokumen[t.key];
      return '<div class="doc-view-row">' +
        '<div class="doc-view-info">' +
        '<div class="doc-label">' + Utils.esc(t.label) + (t.required ? ' <span class="req">*</span>' : '') + '</div>' +
        (doc
          ? '<div class="small muted" title="' + Utils.esc(doc.nama) + '">' + Utils.esc(doc.nama) + '</div>'
          : '<div class="small text-danger">Belum diunggah</div>') +
        '</div>' +
        (doc
          ? '<div class="doc-view-actions">' +
          '<button type="button" class="btn btn-sm btn-secondary" data-doc-view="' + Utils.esc(t.key) + '">Lihat</button>' +
          '<button type="button" class="btn btn-sm btn-ghost" data-doc-download="' + Utils.esc(t.key) + '">Unduh</button>' +
          '</div>'
          : UI.badge('Wajib', 'warn')) +
        '</div>';
    }).join('') + '</div>';
  }

  function bindViewer(root, dokumen) {
    if (!root) return;
    root.addEventListener('click', function (e) {
      var v = e.target.closest('[data-doc-view]');
      if (v) {
        e.preventDefault();
        var key1 = v.getAttribute('data-doc-view');
        openViewer((dokumen || {})[key1], labelOf(key1));
        return;
      }
      var d = e.target.closest('[data-doc-download]');
      if (d) {
        e.preventDefault();
        var key2 = d.getAttribute('data-doc-download');
        downloadDoc((dokumen || {})[key2]);
      }
    });
  }

  /* ---------- kolom unggahan tunggal (Lisensi, Foto Profil, dsb.) ----------
     Satu komponen untuk semua form: kotak putus-putus, status di dalam kotak
     (kosong / memproses / sukses / gagal), input file tersembunyi namun tetap
     bisa diakses, proses sepenuhnya lokal tanpa cloud. */

  function boxHtml(opts) {
    opts = opts || {};
    var key = opts.key || 'file';
    var label = opts.label || 'Berkas';
    var hint = opts.help || (opts.jenis === 'foto' ? labelGambar() : labelDokumen());
    var accept = opts.jenis === 'foto'
      ? 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp'
      : acceptAttr();
    return '<div class="doc-field' + (opts.wrapClass ? ' ' + opts.wrapClass : '') + '" data-up-field="' + Utils.esc(key) + '">' +
      '<div class="doc-label">' + Utils.esc(label) + (opts.required ? ' <span class="req">*</span>' : '') + '</div>' +
      '<button type="button" class="upload-box" data-up-pick="' + Utils.esc(key) + '" aria-label="Pilih file ' + Utils.esc(label) + '">' +
      '<span class="upload-icon">' + icon('download', 22) + '</span>' +
      '<span class="upload-text">Pilih file ' + (opts.jenis === 'foto' ? 'gambar' : 'PDF/JPG/PNG') + '</span>' +
      '</button>' +
      '<input type="file" class="doc-input" data-up-input="' + Utils.esc(key) + '" accept="' + accept + '" hidden>' +
      '<div class="upload-actions" data-up-actions="' + Utils.esc(key) + '" hidden>' +
      '<button type="button" class="btn btn-sm btn-secondary" data-up-change="' + Utils.esc(key) + '">Ganti</button>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-up-remove="' + Utils.esc(key) + '">Hapus</button>' +
      '</div>' +
      '<div class="field-error" data-up-error="' + Utils.esc(key) + '"></div>' +
      '<div class="help">' + Utils.esc(hint) + '</div>' +
      '</div>';
  }

  function bindBox(root, options) {
    options = options || {};
    var key = options.key || 'file';
    var jenis = options.jenis || 'campuran';
    var state = null;
    var proses = 0;

    function fieldRoot() { return root.querySelector('[data-up-field="' + key + '"]'); }
    function sel(s) { return fieldRoot().querySelector(s); }

    function setErr(pesan) {
      var slot = sel('[data-up-error]');
      if (slot) slot.textContent = pesan || '';
      var fr = fieldRoot();
      if (fr) fr.classList.toggle('has-error', !!pesan);
    }

    function renderKosong() {
      var box = sel('.upload-box');
      var input = sel('[data-up-input]');
      var actions = sel('[data-up-actions]');
      if (input) { try { input.value = ''; } catch (e) {} }
      if (!box) return;
      box.classList.remove('filled', 'processing');
      box.innerHTML = '<span class="upload-icon">' + icon('download', 22) + '</span>' +
        '<span class="upload-text">Pilih file ' + (jenis === 'foto' ? 'gambar' : 'PDF/JPG/PNG') + '</span>';
      if (actions) actions.hidden = true;
      setErr('');
    }

    function renderProses() {
      var box = sel('.upload-box');
      var actions = sel('[data-up-actions]');
      if (!box) return;
      box.classList.remove('filled');
      box.classList.add('processing');
      box.innerHTML = '<span class="upload-icon">' + icon('download', 22) + '</span>' +
        '<span class="upload-text">Memproses...</span>' +
        '<span class="upload-spin" aria-hidden="true"></span>';
      if (actions) actions.hidden = true;
      setErr('');
    }

    function renderSukses(doc) {
      var box = sel('.upload-box');
      var actions = sel('[data-up-actions]');
      if (!box) return;
      var src = doc.thumb || '';
      var gambar = jenis === 'foto' || (src && isImage(doc));
      var thumb = (gambar && src)
        ? '<span class="upload-thumb' + (options.preview === 'bulat' ? ' is-round' : '') + '"><img src="' + src + '" alt=""></span>'
        : '<span class="upload-icon">' + icon('clipboard', 22) + '</span>';
      box.classList.remove('processing');
      box.classList.add('filled');
      box.innerHTML = thumb +
        '<span class="upload-text is-file" title="' + Utils.esc(doc.nama) + '">' + Utils.esc(doc.nama) + '</span>' +
        '<span class="upload-check">' + icon('check', 20) + '</span>';
      if (actions) actions.hidden = false;
      setErr('');
    }

    function renderGagal(pesan) {
      var box = sel('.upload-box');
      var actions = sel('[data-up-actions]');
      if (!box) return;
      box.classList.remove('filled', 'processing');
      box.innerHTML = '<span class="upload-icon" style="color:var(--danger)">' + icon('clipboard', 22) + '</span>' +
        '<span class="upload-text">Gagal memproses file</span>' +
        '<button type="button" class="btn btn-sm btn-secondary" data-up-pick="' + Utils.esc(key) + '">Coba lagi</button>';
      if (actions) actions.hidden = true;
      setErr(pesan || '');
    }

    function kabarBusy() { if (options.onBusy) options.onBusy(proses); }

    function pick() {
      var input = sel('[data-up-input]');
      if (input) {
        input.value = '';
        input.click();
      }
    }

    function onFile(file) {
      if (!file) return;
      proses++;
      kabarBusy();
      renderProses();
      prosesBerkas(file, { jenis: jenis, maksPx: options.maksPx }).then(function (doc) {
        state = doc;
        renderSukses(doc);
        if (options.onChange) options.onChange(state);
      }, function (err) {
        state = null;
        renderGagal(err.message);
        Utils.toast(err.message, 'danger');
        if (options.onChange) options.onChange(null);
      }).then(function () {
        proses = Math.max(0, proses - 1);
        kabarBusy();
      });
    }

    root.addEventListener('click', function (e) {
      var p = e.target.closest('[data-up-pick]');
      if (p) { e.preventDefault(); pick(); return; }
      var c = e.target.closest('[data-up-change]');
      if (c) { e.preventDefault(); pick(); return; }
      var r = e.target.closest('[data-up-remove]');
      if (r) {
        e.preventDefault();
        var lama = state;
        state = null;
        renderKosong();
        if (lama && lama.fid && typeof FileStore !== 'undefined') FileStore.hapus(lama.fid);
        if (options.onChange) options.onChange(null);
      }
    });

    root.addEventListener('change', function (e) {
      var input = e.target.closest('[data-up-input]');
      if (!input) return;
      onFile(input.files && input.files[0]);
    });

    if (options.value) {
      state = options.value;
      renderSukses(options.value);
    }

    return {
      get: function () { return state; },
      set: function (doc) {
        state = doc;
        if (doc) renderSukses(doc); else renderKosong();
      },
      reset: function () { state = null; renderKosong(); },
      busy: function () { return proses; },
      validate: function (required) {
        if (required && !state) {
          setErr(options.labelRequired || 'Berkas ini wajib diunggah.');
          return false;
        }
        setErr('');
        return true;
      }
    };
  }

  return {
    TYPES: TYPES,
    sectionHtml: sectionHtml,
    bind: bind,
    boxHtml: boxHtml,
    bindBox: bindBox,
    boxMultiHtml: boxMultiHtml,
    bindBoxMulti: bindBoxMulti,
    proses: prosesBerkas,
    isiBerkas: isiBerkas,
    labelGambar: labelGambar,
    labelDokumen: labelDokumen,
    viewerHtml: viewerHtml,
    bindViewer: bindViewer,
    openViewer: openViewer,
    downloadDoc: downloadDoc,
    isImage: isImage
  };
})();
