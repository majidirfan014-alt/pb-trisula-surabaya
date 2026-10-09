var LandingStore = (function () {
  var KEY = CONFIG.PREFIX + 'landing';
  var listeners = [];

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function defaults() {
    return clone(CONFIG.LANDING_DEFAULT || {});
  }

  function bacaMentah() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function gabung(base, extra) {
    if (!extra || typeof extra !== 'object') return base;
    Object.keys(extra).forEach(function (k) {
      var v = extra[k];
      if (v === undefined || v === null) return;
      if (Array.isArray(v)) base[k] = clone(v);
      else if (typeof v === 'object') {
        if (!base[k] || typeof base[k] !== 'object' || Array.isArray(base[k])) base[k] = {};
        gabung(base[k], v);
      } else base[k] = v;
    });
    return base;
  }

  function get() {
    var hasil = defaults();
    var simpan = bacaMentah();
    if (simpan) gabung(hasil, simpan);
    return hasil;
  }

  function notify() {
    listeners.forEach(function (fn) {
      try {
        fn(get());
      } catch (e) {
        console.error(e);
      }
    });
  }

  function simpan(obj) {
    try {
      localStorage.setItem(KEY, JSON.stringify(obj));
    } catch (e) {
      throw new Error('Penyimpanan browser penuh. Hapus sebagian foto atau perkecil ukuran foto.');
    }
    notify();
  }

  function saveBagian(nama, nilai) {
    var semua = get();
    semua[nama] = clone(nilai);
    simpan(semua);
    return semua;
  }

  function resetBagian(nama) {
    var semua = get();
    var def = defaults();
    semua[nama] = clone(def[nama]);
    simpan(semua);
    return semua;
  }

  function resetAll() {
    localStorage.removeItem(KEY);
    notify();
  }

  function subscribe(fn) {
    listeners.push(fn);
    return function () {
      listeners = listeners.filter(function (f) {
        return f !== fn;
      });
    };
  }

  window.addEventListener('storage', function (e) {
    if (e.key === KEY) notify();
  });

  function validasiEmail(s) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || '').trim());
  }

  function validasiUrl(s) {
    var v = String(s || '').trim();
    if (!v) return true;
    return /^https?:\/\/[^\s]+\.[^\s]{2,}/i.test(v);
  }

  function validasiTelepon(s) {
    return /^[0-9+\-() .]{6,25}$/.test(String(s || '').trim());
  }

  function bacaFoto(file, opts) {
    opts = opts || {};
    var maksUkuran = opts.maksUkuran || 2 * 1024 * 1024;
    var maksLebar = opts.maksLebar || 1600;
    return new Promise(function (resolve, reject) {
      if (!file) {
        reject(new Error('Pilih file foto terlebih dahulu.'));
        return;
      }
      var tipeOk = /^image\/(jpeg|jpg|png|webp)$/i.test(file.type || '');
      var extOk = /\.(jpe?g|png|webp)$/i.test(file.name || '');
      if (!tipeOk && !extOk) {
        reject(new Error('Format foto harus JPG, JPEG, PNG, atau WEBP.'));
        return;
      }
      if (file.size > maksUkuran) {
        reject(new Error('Ukuran foto maksimal 2 MB.'));
        return;
      }
      var reader = new FileReader();
      reader.onerror = function () {
        reject(new Error('Gagal membaca file foto.'));
      };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () {
          reject(new Error('File foto tidak dapat dibuka.'));
        };
        img.onload = function () {
          var lebar = img.width;
          var tinggi = img.height;
          if (lebar > maksLebar) {
            tinggi = Math.round(tinggi * (maksLebar / lebar));
            lebar = maksLebar;
          }
          var canvas = document.createElement('canvas');
          canvas.width = lebar;
          canvas.height = tinggi;
          var ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve({
              nama: file.name,
              tipe: file.type || 'image/jpeg',
              ukuran: file.size,
              data: reader.result
            });
            return;
          }
          ctx.drawImage(img, 0, 0, lebar, tinggi);
          var png = /png/i.test(file.type || '') || /\.png$/i.test(file.name || '');
          var out;
          try {
            out = canvas.toDataURL(png ? 'image/png' : 'image/jpeg', 0.82);
          } catch (e) {
            out = reader.result;
          }
          resolve({
            nama: file.name,
            tipe: png ? 'image/png' : 'image/jpeg',
            ukuran: Math.round(out.length * 0.75),
            data: out
          });
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // Semua isian landing page bersifat OPSIONAL.
  // Validasi hanya dijalankan bila field terisi (format email/URL/telepon).
  // Field kosong tidak menyebabkan error dan tidak menolak penyimpanan.
  function validasiBagian(nama, nilai) {
    var errors = [];
    var k = (nilai || {});
    if (nama === 'kontak') {
      if (k.phone && !validasiTelepon(k.phone)) errors.push('Nomor telepon hanya boleh angka dan tanda + - ( ) .');
      if (k.email && !validasiEmail(k.email)) errors.push('Format email tidak benar.');
      (k.sosmedList || []).forEach(function (s) {
        if (s.url && !validasiUrl(s.url)) errors.push('Tautan ' + (s.nama || 'media sosial') + ' harus diawali http:// atau https://');
      });
    }
    return errors;
  }

  return {
    defaults: defaults,
    get: get,
    simpan: simpan,
    saveBagian: saveBagian,
    resetBagian: resetBagian,
    resetAll: resetAll,
    subscribe: subscribe,
    bacaFoto: bacaFoto,
    validasiEmail: validasiEmail,
    validasiUrl: validasiUrl,
    validasiTelepon: validasiTelepon,
    validasiBagian: validasiBagian
  };
})();
