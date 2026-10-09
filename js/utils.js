var Utils = (function () {
  var BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var BULAN_PANJANG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  function esc(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function toISODate(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  function parseISO(iso) {
    if (!iso) return new Date();
    var parts = String(iso).slice(0, 10).split('-');
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  function fmtDate(iso, longForm) {
    if (!iso) return '-';
    var d = parseISO(iso);
    if (longForm) {
      return d.getDate() + ' ' + BULAN_PANJANG[d.getMonth()] + ' ' + d.getFullYear();
    }
    return d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear();
  }

  function fmtTime(iso) {
    if (!iso) return '-';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    return pad(d.getHours()) + '.' + pad(d.getMinutes());
  }

  function fmtDateTime(iso) {
    return fmtDate(iso) + ', ' + fmtTime(iso);
  }

  function dayName(iso) {
    return HARI[parseISO(iso).getDay()];
  }

  function age(tglLahir) {
    if (!tglLahir) return '-';
    var b = parseISO(tglLahir);
    var n = new Date();
    var a = n.getFullYear() - b.getFullYear();
    var m = n.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && n.getDate() < b.getDate())) a--;
    return a;
  }

  function daysAgoISO(n) {
    var d = new Date();
    d.setDate(d.getDate() - n);
    return toISODate(d);
  }

  function addDaysISO(iso, n) {
    var d = parseISO(iso);
    d.setDate(d.getDate() + n);
    return toISODate(d);
  }

  function monthKey(iso) {
    return String(iso).slice(0, 7);
  }

  function bmiCategory(value) {
    if (!value || isNaN(value)) return { label: '-', tone: 'muted' };
    var list = CONFIG.BMI_CATEGORIES;
    for (var i = 0; i < list.length; i++) {
      if (value < list[i].max) return list[i];
    }
    return list[list.length - 1];
  }

  function bmi(tinggiCm, beratKg) {
    var t = Number(tinggiCm);
    var b = Number(beratKg);
    if (!t || !b || t <= 0 || b <= 0) return { value: null, category: bmiCategory(null) };
    var m = t / 100;
    var value = Math.round((b / (m * m)) * 10) / 10;
    return { value: value, category: bmiCategory(value) };
  }

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments;
      var ctx = this;
      clearTimeout(t);
      t = setTimeout(function () {
        fn.apply(ctx, args);
      }, ms);
    };
  }

  function toast(message, type) {
    var host = document.getElementById('toast-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'toast-host';
      host.className = 'toast-host';
      document.body.appendChild(host);
    }
    var item = document.createElement('div');
    item.className = 'toast toast-' + (type || 'info');
    item.setAttribute('role', 'status');
    item.textContent = message;
    host.appendChild(item);
    setTimeout(function () {
      item.classList.add('toast-out');
      setTimeout(function () {
        if (item.parentNode) item.parentNode.removeChild(item);
      }, 250);
    }, 3200);
  }

  function readImage(file, maxSize) {
    return new Promise(function (resolve, reject) {
      if (!file) {
        resolve(null);
        return;
      }
      if (!/^image\//.test(file.type)) {
        reject(new Error('File harus berupa gambar.'));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        reject(new Error('Ukuran gambar maksimal 5 MB.'));
        return;
      }
      var reader = new FileReader();
      reader.onerror = function () {
        reject(new Error('Gagal membaca gambar.'));
      };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () {
          reject(new Error('Format gambar tidak didukung.'));
        };
        img.onload = function () {
          var max = maxSize || 256;
          var scale = Math.min(1, max / Math.max(img.width, img.height));
          var w = Math.max(1, Math.round(img.width * scale));
          var h = Math.max(1, Math.round(img.height * scale));
          var canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // Simpan hasil kompresi foto ke penyimpanan cloud bila tersedia,
  // kalau tidak, pakai data URL lokal sebagai cadangan.
  function keCloud(dataUrl, folder, nama) {
    if (typeof Cloud === 'undefined' || !Cloud || !Cloud.unggahAtauLokal) {
      return Promise.resolve(dataUrl);
    }
    return Cloud.unggahAtauLokal(dataUrl, folder, nama);
  }

  function formData(form) {
    var out = {};
    var elements = form.querySelectorAll('input, select, textarea');
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      if (!el.name || el.disabled) continue;
      if (el.type === 'checkbox') {
        out[el.name] = el.checked;
      } else if (el.type === 'radio') {
        if (el.checked) out[el.name] = el.value;
      } else {
        out[el.name] = el.value.trim();
      }
    }
    return out;
  }

  function showErrors(form, errors) {
    var fields = form.querySelectorAll('[data-error-for]');
    for (var i = 0; i < fields.length; i++) fields[i].textContent = '';
    var inputs = form.querySelectorAll('.input-error');
    for (var j = 0; j < inputs.length; j++) inputs[j].classList.remove('input-error');
    Object.keys(errors).forEach(function (name) {
      var slot = form.querySelector('[data-error-for="' + name + '"]');
      if (slot) slot.textContent = errors[name];
      var input = form.querySelector('[name="' + name + '"]');
      if (input) input.classList.add('input-error');
    });
    var first = form.querySelector('.input-error');
    if (first && first.focus) first.focus();
  }

  function clearErrors(form) {
    showErrors(form, {});
  }

  function fmtNumber(n, digits) {
    if (n === null || n === undefined || isNaN(n)) return '-';
    return Number(n).toLocaleString('id-ID', {
      minimumFractionDigits: digits || 0,
      maximumFractionDigits: digits === undefined ? 1 : digits
    });
  }

  function pct(part, total) {
    if (!total) return 0;
    return Math.round((part / total) * 100);
  }

  function isSkorValid(value) {
    return /^\d{1,3}\s*-\s*\d{1,3}$/.test(String(value === undefined || value === null ? '' : value).trim());
  }

  function validasiNisn(value) {
    var v = String(value === undefined || value === null ? '' : value).trim();
    if (!v) return 'NISN wajib diisi.';
    if (!/^\d+$/.test(v)) return 'NISN hanya boleh berisi angka.';
    if (v.length !== 10) {
      return v.length < 10
        ? 'NISN harus tepat 10 digit (kurang ' + (10 - v.length) + ' digit).'
        : 'NISN harus tepat 10 digit (lebih ' + (v.length - 10) + ' digit).';
    }
    return '';
  }

  function sortBy(arr, key, dir) {
    var copy = arr.slice();
    copy.sort(function (a, b) {
      var av = a[key];
      var bv = b[key];
      if (av === bv) return 0;
      if (av === undefined || av === null) return 1;
      if (bv === undefined || bv === null) return -1;
      if (av < bv) return dir === 'desc' ? 1 : -1;
      return dir === 'desc' ? -1 : 1;
    });
    return copy;
  }

  function rangeDays(fromISO, toISO) {
    var out = [];
    var cur = fromISO;
    var guard = 0;
    while (cur <= toISO && guard < 400) {
      out.push(cur);
      cur = addDaysISO(cur, 1);
      guard++;
    }
    return out;
  }

  return {
    esc: esc,
    pad: pad,
    todayISO: todayISO,
    nowISO: nowISO,
    toISODate: toISODate,
    parseISO: parseISO,
    fmtDate: fmtDate,
    fmtTime: fmtTime,
    fmtDateTime: fmtDateTime,
    dayName: dayName,
    age: age,
    daysAgoISO: daysAgoISO,
    addDaysISO: addDaysISO,
    monthKey: monthKey,
    bmi: bmi,
    bmiCategory: bmiCategory,
    uid: uid,
    debounce: debounce,
    toast: toast,
    readImage: readImage,
    keCloud: keCloud,
    formData: formData,
    showErrors: showErrors,
    clearErrors: clearErrors,
    fmtNumber: fmtNumber,
    pct: pct,
    isSkorValid: isSkorValid,
    validasiNisn: validasiNisn,
    sortBy: sortBy,
    rangeDays: rangeDays
  };
})();
