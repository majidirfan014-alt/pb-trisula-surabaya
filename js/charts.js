var Charts = (function () {
  var loadPromise = null;
  var PALETTE = ['#0b3d91', '#d62839', '#1565d8', '#a31621', '#4c8de0', '#e8647a', '#0a4fb0', '#f0a0a8'];

  function load() {
    if (window.Chart) return Promise.resolve(window.Chart);
    if (loadPromise) return loadPromise;
    loadPromise = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
      script.onload = function () {
        resolve(window.Chart);
      };
      script.onerror = function () {
        reject(new Error('Gagal memuat Chart.js. Periksa koneksi internet.'));
      };
      document.head.appendChild(script);
    });
    return loadPromise;
  }

  function destroy(canvas) {
    if (canvas && canvas._chart) {
      canvas._chart.destroy();
      canvas._chart = null;
    }
  }

  function baseOptions(extra) {
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
          titleFont: { size: 12 },
          bodyFont: { size: 12 },
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
      if (extra.beginAtZero === false) opts.scales.y.beginAtZero = false;
      if (extra.yStep) opts.scales.y.ticks.stepSize = extra.yStep;
      if (extra.legendPosition) opts.plugins.legend.position = extra.legendPosition;
      if (extra.legendAlign) opts.plugins.legend.align = extra.legendAlign;
      if (extra.xTitle) opts.scales.x.title = { display: true, text: extra.xTitle, color: '#64748b', font: { size: 11 } };
      if (extra.tickCallback) opts.scales.x.ticks.callback = extra.tickCallback;
      if (extra.tooltipCallbacks) {
        opts.plugins.tooltip.callbacks = extra.tooltipCallbacks;
      }
    }
    return opts;
  }

  function showFallback(canvas, message) {
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

  function clearFallback(canvas) {
    if (!canvas || !canvas.parentElement) return;
    canvas.style.display = '';
    var fallback = canvas.parentElement.querySelector('.chart-fallback');
    if (fallback && fallback.parentNode) fallback.parentNode.removeChild(fallback);
  }

  function render(canvas, type, labels, datasets, extra) {
    return load().then(function (Chart) {
      destroy(canvas);
      clearFallback(canvas);
      var ctx = canvas.getContext('2d');
      canvas._chart = new Chart(ctx, {
        type: type,
        data: { labels: labels, datasets: datasets },
        options: baseOptions(extra)
      });
      return canvas._chart;
    }).catch(function (err) {
      showFallback(canvas, err.message || 'Grafik tidak dapat dimuat.');
    });
  }

  function line(canvas, labels, datasets, extra) {
    var prepared = datasets.map(function (ds, i) {
      return {
        label: ds.label,
        data: ds.data,
        borderColor: ds.color || PALETTE[i % PALETTE.length],
        backgroundColor: (ds.color || PALETTE[i % PALETTE.length]) + '22',
        tension: 0.35,
        fill: ds.fill === undefined ? false : ds.fill,
        spanGaps: true,
        pointRadius: 3,
        pointHoverRadius: 5
      };
    });
    return render(canvas, 'line', labels, prepared, extra);
  }

  function bar(canvas, labels, datasets, extra) {
    var prepared = datasets.map(function (ds, i) {
      return {
        label: ds.label,
        data: ds.data,
        backgroundColor: ds.color || PALETTE[i % PALETTE.length],
        borderRadius: 6,
        maxBarThickness: 34
      };
    });
    return render(canvas, 'bar', labels, prepared, extra);
  }

  function doughnut(canvas, labels, values, extra) {
    return load().then(function (Chart) {
      destroy(canvas);
      var ctx = canvas.getContext('2d');
      canvas._chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: values,
            backgroundColor: labels.map(function (_, i) { return PALETTE[i % PALETTE.length]; }),
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
      showFallback(canvas, err.message || 'Grafik tidak dapat dimuat.');
    });
  }

  return {
    load: load,
    line: line,
    bar: bar,
    doughnut: doughnut,
    destroy: destroy,
    PALETTE: PALETTE
  };
})();
