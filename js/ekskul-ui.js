/* ==========================================================================
   EKSTRAKURIKULER — komponen antarmuka bersama (pemilih siswa, grafik,
   bar persentase, slider, kombinasi sekolah dengan pencarian).
   ========================================================================== */

var EkskulUI = (function () {
  var chartPromise = null;

  /* --- Grafik Chart.js: pakai salinan lokal dulu, cadangan dari CDN ------ */
  function loadChart() {
    if (window.Chart) return Promise.resolve(window.Chart);
    if (chartPromise) return chartPromise;
    chartPromise = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      var lokal = 'js/vendor/chart.umd.min.js';
      var cdn = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
      var coba = [lokal, cdn];
      var idx = 0;
      function next(err) {
        if (idx >= coba.length) {
          reject(err || new Error('Gagal memuat Chart.js.'));
          return;
        }
        script.src = coba[idx++];
        script.onload = function () {
          if (window.Chart) resolve(window.Chart);
          else next(new Error('Chart.js tidak tersedia.'));
        };
        script.onerror = function () {
          next(new Error('Gagal memuat ' + script.src));
        };
      }
      next();
      document.head.appendChild(script);
    });
    return chartPromise;
  }

  function destroyChart(canvas) {
    if (canvas && canvas._chart) {
      canvas._chart.destroy();
      canvas._chart = null;
    }
  }

  function chartOptions(extra) {
    var opts = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { usePointStyle: true, boxWidth: 8, padding: 16, color: '#334155', font: { size: 12, family: 'inherit' } }
        },
        tooltip: {
          backgroundColor: '#051b42',
          borderColor: 'rgba(214, 40, 57, 0.45)',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#64748b', font: { size: 11 }, maxRotation: 0, autoSkipPadding: 12 }
        },
        y: {
          beginAtZero: true,
          grid: { color: '#e2e8f0' },
          ticks: { color: '#64748b', font: { size: 11 } }
        }
      }
    };
    if (extra) {
      if (extra.min !== undefined) opts.scales.y.min = extra.min;
      if (extra.max !== undefined) opts.scales.y.max = extra.max;
      if (extra.noLegend) opts.plugins.legend.display = false;
      if (extra.yTitle) opts.scales.y.title = { display: true, text: extra.yTitle, color: '#64748b', font: { size: 11 } };
      if (extra.xTitle) opts.scales.x.title = { display: true, text: extra.xTitle, color: '#64748b', font: { size: 11 } };
      if (extra.horizontal) {
        opts.indexAxis = 'y';
        if (extra.max !== undefined) opts.scales.x.max = extra.max;
        opts.scales.x.beginAtZero = true;
      }
    }
    return opts;
  }

  function showChartFallback(canvas, message) {
    if (!canvas || !canvas.parentElement) return;
    canvas.style.display = 'none';
    var host = canvas.parentElement;
    var fallback = host.querySelector('.chart-fallback');
    if (!fallback) {
      fallback = document.createElement('div');
      fallback.className = 'chart-fallback';
      host.appendChild(fallback);
    }
    fallback.textContent = message || 'Grafik tidak dapat dimuat.';
  }

  function clearChartFallback(canvas) {
    if (!canvas || !canvas.parentElement) return;
    canvas.style.display = '';
    var fallback = canvas.parentElement.querySelector('.chart-fallback');
    if (fallback && fallback.parentNode) fallback.parentNode.removeChild(fallback);
  }

  function drawLine(canvas, labels, datasets, extra) {
    return loadChart().then(function (Chart) {
      destroyChart(canvas);
      clearChartFallback(canvas);
      var prepared = datasets.map(function (ds, i) {
        var color = ds.color || ['#0b3d91', '#d62839', '#1565d8', '#a31621', '#4c8de0'][i % 5];
        return {
          label: ds.label,
          data: ds.data,
          borderColor: color,
          backgroundColor: color + '22',
          tension: 0.35,
          fill: !!ds.fill,
          spanGaps: true,
          pointRadius: 3,
          pointHoverRadius: 5
        };
      });
      canvas._chart = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: { labels: labels, datasets: prepared },
        options: chartOptions(extra)
      });
      return canvas._chart;
    }).catch(function (err) {
      showChartFallback(canvas, err.message || 'Grafik tidak dapat dimuat.');
    });
  }

  function drawBar(canvas, labels, datasets, extra) {
    return loadChart().then(function (Chart) {
      destroyChart(canvas);
      clearChartFallback(canvas);
      var prepared = datasets.map(function (ds, i) {
        var color = ds.color || ['#0b3d91', '#d62839', '#1565d8', '#a31621', '#4c8de0'][i % 5];
        return {
          label: ds.label,
          data: ds.data,
          backgroundColor: color,
          borderRadius: 6,
          maxBarThickness: extra && extra.horizontal ? 22 : 34
        };
      });
      canvas._chart = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: { labels: labels, datasets: prepared },
        options: chartOptions(extra)
      });
      return canvas._chart;
    }).catch(function (err) {
      showChartFallback(canvas, err.message || 'Grafik tidak dapat dimuat.');
    });
  }

  function drawDoughnut(canvas, labels, values) {
    return loadChart().then(function (Chart) {
      destroyChart(canvas);
      clearChartFallback(canvas);
      var colors = ['#15803d', '#d97706', '#1e40af', '#a31621'];
      canvas._chart = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: values,
            backgroundColor: colors,
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '62%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: { usePointStyle: true, boxWidth: 8, padding: 12, color: '#334155', font: { size: 12 } }
            }
          }
        }
      });
      return canvas._chart;
    }).catch(function (err) {
      showChartFallback(canvas, err.message || 'Grafik tidak dapat dimuat.');
    });
  }

  /* --- Bar persentase ----------------------------------------------------- */
  function barPercent(label, persen, opts) {
    opts = opts || {};
    var v = persen === null || persen === undefined || !isFinite(persen) ? null : Math.max(0, Math.min(100, Number(persen)));
    var tone = opts.tone ? ' tone-' + opts.tone : '';
    return '<div class="bar-row">' +
      '<div class="bar-meta"><b>' + Utils.esc(label) + '</b>' +
      '<span class="bar-angka">' + (v === null ? '—' : Utils.esc(v) + '%') + '</span></div>' +
      '<div class="bar-track"><div class="bar-fill' + tone + '" style="width:' + (v === null ? 0 : v) + '%"></div></div>' +
      (v === null ? '<div class="bar-kosong">' + Utils.esc(opts.kosong || 'Belum ada data.') + '</div>' : '') +
      '</div>';
  }

  function pctBadge(persen) {
    if (persen === null || persen === undefined || !isFinite(persen)) return '<span class="pct-badge">—</span>';
    return '<span class="pct-badge">' + Utils.esc(persen) + '%</span>';
  }

  /* --- Slider nilai 1-10 -------------------------------------------------- */
  function sliderRow(name, label, value) {
    var v = Number(value);
    if (!isFinite(v)) v = 5;
    if (v < 1) v = 1;
    if (v > 10) v = 10;
    return '<div class="slider-row" data-slider-row="' + Utils.esc(name) + '">' +
      '<p class="slider-label">' + Utils.esc(label) + '</p>' +
      '<input type="range" min="1" max="10" step="1" value="' + v + '" data-slider="' + Utils.esc(name) + '" aria-label="' + Utils.esc(label) + '">' +
      '<span class="slider-angka" data-slider-angka="' + Utils.esc(name) + '">' + v + '</span>' +
      '</div>';
  }

  function bindSliders(root) {
    var host = root || document;
    if (host.getAttribute && host.getAttribute('data-slider-bound')) return;
    if (host.setAttribute) host.setAttribute('data-slider-bound', '1');
    host.addEventListener('input', function (e) {
      var slider = e.target.closest ? e.target.closest('[data-slider]') : null;
      if (!slider) return;
      var name = slider.getAttribute('data-slider');
      var angka = host.querySelector('[data-slider-angka="' + name + '"]');
      if (angka) angka.textContent = slider.value;
    });
  }

  /* --- Pemilih siswa: pencarian lalu centang ------------------------------ */
  // opts: { id, label, siswa: [], selected: [], multiple: true, help }
  function pickerHtml(opts) {
    var id = opts.id;
    var multiple = opts.multiple !== false;
    var selected = opts.selected || [];
    var siswa = (opts.siswa || []).slice().sort(function (a, b) {
      return String(a.nama).localeCompare(String(b.nama));
    });
    var html = '<div class="picker" data-picker="' + Utils.esc(id) + '" data-multiple="' + (multiple ? '1' : '0') + '">' +
      '<div class="picker-head">' +
      '<label class="label" for="picker-cari-' + Utils.esc(id) + '">' + Utils.esc(opts.label || 'Siswa/Siswi') + '</label>' +
      '<div class="picker-tools">' +
      '<input class="input" type="search" id="picker-cari-' + Utils.esc(id) + '" placeholder="Cari nama / kelas / ID..." data-picker-cari autocomplete="off">' +
      '<span class="picker-count" data-picker-count>0 terpilih</span>' +
      '</div>' +
      (opts.help ? '<div class="help">' + Utils.esc(opts.help) + '</div>' : '') +
      '</div>' +
      '<div class="picker-list" data-picker-list>';

    if (!siswa.length) {
      html += '<div class="picker-empty">Tidak ada siswa untuk dipilih.</div>';
    }
    siswa.forEach(function (s) {
      var checked = selected.indexOf(s.id) !== -1 ? ' checked' : '';
      html += '<label class="picker-item" data-picker-item data-cari="' +
        Utils.esc((s.nama + ' ' + s.kelas + ' ' + (s.id_siswa || '') + ' ' + EkskulData.namaSekolah(s.sekolah_id)).toLowerCase()) + '">' +
        '<input type="checkbox" value="' + Utils.esc(s.id) + '"' + checked + '>' +
        '<span class="picker-info"><b>' + Utils.esc(s.nama) + '</b>' +
        '<span>' + Utils.esc((s.id_siswa || '') + ' · Kelas ' + s.kelas + ' · ' + EkskulData.namaSekolah(s.sekolah_id)) + '</span></span>' +
        '</label>';
    });
    html += '</div></div>';
    return html;
  }

  function bindPicker(id, onChange) {
    var root = document.querySelector('[data-picker="' + id + '"]');
    if (!root) return { getSelected: function () { return []; } };
    var cari = root.querySelector('[data-picker-cari]');
    var list = root.querySelector('[data-picker-list]');
    var count = root.querySelector('[data-picker-count]');
    var multiple = root.getAttribute('data-multiple') === '1';

    function refreshCount() {
      var n = root.querySelectorAll('input[type="checkbox"]:checked').length;
      if (count) count.textContent = n + ' terpilih';
    }

    function getSelected() {
      var boxes = root.querySelectorAll('input[type="checkbox"]:checked');
      var out = [];
      for (var i = 0; i < boxes.length; i++) out.push(boxes[i].value);
      return out;
    }

    function syncSelection() {
      var boxes = root.querySelectorAll('input[type="checkbox"]');
      if (!multiple) {
        var checked = root.querySelector('input[type="checkbox"]:checked');
        for (var i = 0; i < boxes.length; i++) {
          if (boxes[i] !== checked) boxes[i].checked = false;
        }
      }
      refreshCount();
      if (onChange) onChange(getSelected());
    }

    root.addEventListener('change', function (e) {
      if (e.target.type !== 'checkbox') return;
      syncSelection();
    });

    if (cari) {
      cari.addEventListener('input', function () {
        var q = String(cari.value || '').trim().toLowerCase();
        var items = list ? list.querySelectorAll('[data-picker-item]') : [];
        var ada = 0;
        for (var i = 0; i < items.length; i++) {
          var cocok = !q || items[i].getAttribute('data-cari').indexOf(q) !== -1;
          items[i].style.display = cocok ? '' : 'none';
          if (cocok) ada++;
        }
        var empty = list ? list.querySelector('.picker-empty') : null;
        if (list) {
          if (!ada && !empty) {
            var div = document.createElement('div');
            div.className = 'picker-empty';
            div.textContent = 'Tidak ada siswa yang cocok.';
            list.appendChild(div);
          } else if (ada && empty) {
            empty.parentNode.removeChild(empty);
          }
        }
      });
    }

    refreshCount();

    return {
      getSelected: getSelected,
      setSelected: function (ids) {
        var set = {};
        (ids || []).forEach(function (id) {
          set[id] = true;
        });
        var boxes = root.querySelectorAll('input[type="checkbox"]');
        for (var i = 0; i < boxes.length; i++) {
          boxes[i].checked = !!set[boxes[i].value];
        }
        refreshCount();
      },
      clear: function () {
        var boxes = root.querySelectorAll('input[type="checkbox"]');
        for (var i = 0; i < boxes.length; i++) boxes[i].checked = false;
        refreshCount();
      }
    };
  }

  /* --- Kombobox sekolah dengan kolom cari --------------------------------- */
  // opts: { id, sekolah: [], value, allowEmpty, emptyLabel }
  function comboHtml(opts) {
    var id = opts.id;
    var value = opts.value || '';
    var current = '';
    (opts.sekolah || []).forEach(function (s) {
      if (s.id === value) current = s.nama;
    });
    return '<div class="combo-wrap" data-combo="' + Utils.esc(id) + '" data-value="' + Utils.esc(value) + '">' +
      '<label class="label" for="combo-cari-' + Utils.esc(id) + '">' + Utils.esc(opts.label || 'Sekolah') + '</label>' +
      '<input class="input" type="search" id="combo-cari-' + Utils.esc(id) + '" data-combo-cari autocomplete="off" placeholder="' +
      Utils.esc(opts.placeholder || 'Ketik untuk mencari sekolah...') + '" value="' + Utils.esc(current) + '">' +
      '<input type="hidden" name="' + Utils.esc(opts.name || 'sekolah_id') + '" data-combo-value value="' + Utils.esc(value) + '">' +
      '<div class="combo-hasil" data-combo-hasil hidden></div>' +
      (opts.help ? '<div class="help">' + Utils.esc(opts.help) + '</div>' : '') +
      '</div>';
  }

  function bindCombo(id, sekolahList, onChange) {
    var root = document.querySelector('[data-combo="' + id + '"]');
    if (!root) return { getValue: function () { return ''; } };
    var cari = root.querySelector('[data-combo-cari]');
    var hidden = root.querySelector('[data-combo-value]');
    var hasil = root.querySelector('[data-combo-hasil]');

    function render(q) {
      var list = (sekolahList || []).filter(function (s) {
        if (!q) return true;
        return (s.nama + ' ' + (s.alamat || '')).toLowerCase().indexOf(q) !== -1;
      });
      if (!list.length) {
        hasil.innerHTML = '<button type="button" disabled>Tidak ada sekolah cocok</button>';
      } else {
        hasil.innerHTML = list.map(function (s) {
          return '<button type="button" data-pilih="' + Utils.esc(s.id) + '">' + Utils.esc(s.nama) +
            (s.alamat ? '<small>' + Utils.esc(s.alamat) + '</small>' : '') + '</button>';
        }).join('');
      }
      hasil.hidden = false;
    }

    function pilih(s) {
      hidden.value = s.id;
      root.setAttribute('data-value', s.id);
      cari.value = s.nama;
      hasil.hidden = true;
      if (onChange) onChange(s.id);
    }

    cari.addEventListener('focus', function () {
      render(String(cari.value || '').trim().toLowerCase());
    });
    cari.addEventListener('input', function () {
      hidden.value = '';
      root.setAttribute('data-value', '');
      render(String(cari.value || '').trim().toLowerCase());
    });
    hasil.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-pilih]') : null;
      if (!btn) return;
      var sid = btn.getAttribute('data-pilih');
      var found = null;
      (sekolahList || []).forEach(function (s) {
        if (s.id === sid) found = s;
      });
      if (found) pilih(found);
    });
    document.addEventListener('click', function (e) {
      if (!root.contains(e.target)) hasil.hidden = true;
    });

    return {
      getValue: function () {
        return hidden.value;
      },
      setValue: function (v) {
        hidden.value = v || '';
        var nama = '';
        (sekolahList || []).forEach(function (s) {
          if (s.id === v) nama = s.nama;
        });
        cari.value = nama;
      }
    };
  }

  /* --- Kumpulan siswa terpilih (chip) ------------------------------------- */
  function chipsSiswa(ids) {
    if (!ids || !ids.length) return '<span class="muted small">Belum ada siswa dipilih.</span>';
    return '<div class="terpilih-chips">' + ids.map(function (id) {
      var s = EkskulData.siswaById(id);
      if (!s) return '';
      return '<span class="terpilih-chip">' + Utils.esc(s.nama) + ' · ' + Utils.esc(s.id_siswa || '') + '</span>';
    }).join('') + '</div>';
  }

  return {
    loadChart: loadChart,
    drawLine: drawLine,
    drawBar: drawBar,
    drawDoughnut: drawDoughnut,
    destroyChart: destroyChart,
    barPercent: barPercent,
    pctBadge: pctBadge,
    sliderRow: sliderRow,
    bindSliders: bindSliders,
    pickerHtml: pickerHtml,
    bindPicker: bindPicker,
    comboHtml: comboHtml,
    bindCombo: bindCombo,
    chipsSiswa: chipsSiswa
  };
})();
