var Docs = (function () {
  var TYPES = [
    { key: 'akte_kelahiran', label: 'Akte Kelahiran', required: true },
    { key: 'kartu_keluarga', label: 'Kartu Keluarga (KK)', required: true },
    { key: 'surat_kebenaran_usia', label: 'Surat Kebenaran Usia', required: true },
    { key: 'surat_keterangan_lahir', label: 'Surat Keterangan Lahir', required: true },
    { key: 'ijazah_raport', label: 'Ijazah Terakhir / Raport', required: true }
  ];

  function maxBytes() {
    var mb = CONFIG.DOKUMEN_MAX_MB || 2;
    return mb * 1024 * 1024;
  }

  function maxLabel() {
    return 'maks. ' + (CONFIG.DOKUMEN_MAX_MB || 2) + ' MB';
  }

  function acceptAttr() {
    return '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';
  }

  function extOf(name) {
    var m = /\.([a-z0-9]+)$/i.exec(String(name || ''));
    return m ? m[1].toLowerCase() : '';
  }

  function isAccepted(file) {
    var ext = extOf(file.name);
    var okExt = ['pdf', 'jpg', 'jpeg', 'png'].indexOf(ext) !== -1;
    var okMime = !file.type || /pdf|jpeg|jpg|png/i.test(file.type);
    return okExt && okMime;
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
      '<a class="btn-template" href="' + Utils.esc(CONFIG.DOKUMEN_TEMPLATE) + '" download>' +
      icon('download', 20) + '<span>Unduh Template Surat Kebenaran Usia</span></a>' +
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

  function shrinkImage(dataUrl, maxDim) {
    return new Promise(function (resolve) {
      var settled = false;
      function done(value) {
        if (settled) return;
        settled = true;
        resolve(value);
      }
      setTimeout(function () {
        done(dataUrl);
      }, 400);
      var img = new Image();
      img.onerror = function () {
        done(dataUrl);
      };
      img.onload = function () {
        var max = maxDim || 1400;
        if (img.width <= max && img.height <= max) {
          done(dataUrl);
          return;
        }
        var scale = Math.min(max / img.width, max / img.height);
        var w = Math.max(1, Math.round(img.width * scale));
        var h = Math.max(1, Math.round(img.height * scale));
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        if (!ctx) {
          done(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        var isPng = /png/i.test(dataUrl.slice(0, 40));
        try {
          done(canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', 0.82));
        } catch (e) {
          done(dataUrl);
        }
      };
      img.src = dataUrl;
    });
  }

  function readDoc(file) {
    return new Promise(function (resolve, reject) {
      if (!file) {
        reject(new Error('Pilih file terlebih dahulu.'));
        return;
      }
      if (!isAccepted(file)) {
        reject(new Error('Format file harus PDF, JPG, JPEG, atau PNG.'));
        return;
      }
      if (file.size > maxBytes()) {
        reject(new Error('Ukuran file maksimal ' + (CONFIG.DOKUMEN_MAX_MB || 2) + ' MB.'));
        return;
      }
      var reader = new FileReader();
      reader.onerror = function () {
        reject(new Error('Gagal membaca file. Coba lagi.'));
      };
      reader.onload = function () {
        var raw = reader.result;
        var finish = function (data) {
          resolve({
            nama: file.name,
            tipe: file.type || (extOf(file.name) === 'pdf' ? 'application/pdf' : 'image/' + extOf(file.name)),
            ukuran: file.size,
            data: data,
            dibuat_pada: Utils.nowISO()
          });
        };
        if (/^image\//.test(file.type) || /\.(jpe?g|png)$/i.test(file.name)) {
          shrinkImage(raw, 1400).then(finish);
        } else {
          finish(raw);
        }
      };
      reader.readAsDataURL(file);
    });
  }

  function renderFilled(fieldRoot, doc) {
    var box = fieldRoot.querySelector('.upload-box');
    var actions = fieldRoot.querySelector('[data-doc-actions]');
    if (!box) return;
    var thumb = isImage(doc)
      ? '<span class="upload-thumb"><img src="' + doc.data + '" alt=""></span>'
      : '<span class="upload-icon">' + icon('clipboard', 22) + '</span>';
    box.classList.add('filled');
    box.innerHTML = thumb +
      '<span class="upload-text is-file" title="' + Utils.esc(doc.nama) + '">' + Utils.esc(doc.nama) + '</span>' +
      '<span class="upload-check">' + icon('check', 20) + '</span>';
    if (actions) actions.hidden = false;
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
    box.classList.remove('filled');
    box.innerHTML = '<span class="upload-icon">' + icon('download', 22) + '</span>' +
      '<span class="upload-text">Pilih file PDF/JPG/PNG (' + maxLabel() + ')</span>';
    if (actions) actions.hidden = true;
  }

  function bind(root, options) {
    options = options || {};
    var state = {};
    var existing = options.dokumen || {};

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
      readDoc(file).then(function (doc) {
        state[key] = doc;
        renderFilled(fieldRoot, doc);
        if (options.onChange) options.onChange(state);
      }).catch(function (err) {
        setError(fieldRoot, err.message);
        Utils.toast(err.message, 'danger');
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
        delete state[key];
        var fr = fieldRootOf(key);
        if (fr) {
          renderEmpty(fr);
          setError(fr, '');
        }
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

  function downloadDoc(doc) {
    if (!doc || !doc.data) return;
    var a = document.createElement('a');
    a.href = doc.data;
    a.download = doc.nama || 'dokumen';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      if (a.parentNode) a.parentNode.removeChild(a);
    }, 100);
  }

  function openViewer(doc, label) {
    if (!doc || !doc.data) {
      Utils.toast('Dokumen tidak tersedia.', 'danger');
      return;
    }
    var host = document.getElementById('modal-host') || document.body;
    var preview;
    if (isImage(doc)) {
      preview = '<div class="doc-preview"><img src="' + doc.data + '" alt="' + Utils.esc(label) + '"></div>';
    } else {
      preview = '<div class="doc-preview doc-preview-pdf"><iframe src="' + doc.data + '" title="' + Utils.esc(label) + '"></iframe></div>';
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
      downloadDoc(doc);
    });
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

  return {
    TYPES: TYPES,
    sectionHtml: sectionHtml,
    bind: bind,
    viewerHtml: viewerHtml,
    bindViewer: bindViewer,
    openViewer: openViewer,
    downloadDoc: downloadDoc,
    isImage: isImage
  };
})();
