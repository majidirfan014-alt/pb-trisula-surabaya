var PagesAuth = (function () {
  var docsApi = null;

  function bindPasswordToggles(root) {
    var toggles = (root || document).querySelectorAll('[data-pw-toggle]');
    for (var i = 0; i < toggles.length; i++) {
      toggles[i].addEventListener('click', function (e) {
        var btn = e.currentTarget;
        var input = document.getElementById(btn.getAttribute('data-pw-toggle'));
        if (!input) return;
        var showing = input.type === 'text';
        input.type = showing ? 'password' : 'text';
        btn.textContent = showing ? 'Lihat' : 'Sembunyikan';
      });
    }
  }

  function bindBackButtons() {
    var buttons = document.querySelectorAll('[data-pub-back]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function (e) {
        e.preventDefault();
        var target = e.currentTarget.getAttribute('data-pub-back');
        if (typeof App !== 'undefined' && App && App.isDirty && App.isDirty()) {
          UI.confirmDialog('Data belum disimpan, yakin kembali?', 'Konfirmasi Pindah Halaman').then(function (ok) {
            if (ok) {
              if (App.setDirty) App.setDirty(false);
              UI.goBack(target);
            }
          });
          return;
        }
        UI.goBack(target);
      });
    }
  }

  function redirectForRole() {
    return 'app.html#/beranda';
  }

  function initLogin() {
    var form = document.getElementById('login-form');
    if (!form) return;

    bindPasswordToggles();
    bindBackButtons();

    UI.bindSubmit(form, function () {
      Utils.clearErrors(form);
      var data = Utils.formData(form);
      var errors = {};
      if (!data.username) errors.username = 'Nama pengguna wajib diisi.';
      if (!data.password) errors.password = 'Kata sandi wajib diisi.';
      if (Object.keys(errors).length) {
        Utils.showErrors(form, errors);
        Utils.toast('Periksa kembali isian yang ditandai.', 'danger');
        return;
      }

      var btn = UI.submitButton(form);
      if (btn) btn.textContent = 'Memproses...';

      return Auth.login(data.username, data.password).then(function (user) {
        Utils.toast('Selamat datang, ' + user.nama + '!', 'success');
        window.location.replace(redirectForRole());
      }).catch(function (err) {
        Utils.toast(err.message, 'danger');
        if (btn) btn.textContent = 'Masuk';
      });
    });

    Store.init().then(function () {
      var existing = Auth.current();
      if (existing) window.location.replace(redirectForRole());
    });
  }

  function initRegister() {
    var form = document.getElementById('register-form');
    if (!form) return;

    bindPasswordToggles();
    bindBackButtons();

    var slot = document.getElementById('docs-slot');
    if (slot) {
      slot.innerHTML = Docs.sectionHtml();
      docsApi = Docs.bind(slot, {});
    }

    var tinggi = form.querySelector('[name="tinggi"]');
    var berat = form.querySelector('[name="berat"]');
    var bmiBox = document.getElementById('bmi-preview');

    function updateBmi() {
      if (!bmiBox) return;
      var result = Utils.bmi(tinggi.value, berat.value);
      if (result.value === null) {
        bmiBox.innerHTML = '<b>-</b><div><b class="fs-sm">BMI otomatis</b><div class="small muted">Isi tinggi &amp; berat badan.</div></div>';
        return;
      }
      bmiBox.innerHTML =
        '<b>' + result.value + '</b>' +
        '<div><b class="fs-sm">BMI Anda</b><div class="small muted">Kategori: ' +
        Utils.esc(result.category.label) + ' · dihitung otomatis</div></div>';
    }

    if (tinggi) tinggi.addEventListener('input', updateBmi);
    if (berat) berat.addEventListener('input', updateBmi);
    updateBmi();

    var nisnInput = form.querySelector('[name="nisn"]');
    function pesanNisn(value) {
      var format = Utils.validasiNisn(value);
      if (format) return format;
      var v = String(value).trim();
      var sama = Store.findOne('athletes', function (a) {
        return String(a.nisn || '').trim() === v;
      });
      if (sama) return 'NISN sudah terdaftar';
      return '';
    }
    if (nisnInput) {
      nisnInput.addEventListener('input', function () {
        var slot = form.querySelector('[data-error-for="nisn"]');
        var pesan = nisnInput.value.trim() ? pesanNisn(nisnInput.value) : '';
        if (slot) slot.textContent = pesan;
        nisnInput.classList.toggle('input-error', !!pesan);
      });
    }

    var photoInput = form.querySelector('[name="foto_file"]');
    var photoPreview = document.getElementById('photo-preview');
    var photoData = '';

    if (photoInput) {
      photoInput.addEventListener('change', function () {
        var file = photoInput.files && photoInput.files[0];
        if (!file) {
          photoData = '';
          return;
        }
        Utils.readImage(file, 256).then(function (dataUrl) {
          photoData = dataUrl;
          if (photoPreview) photoPreview.innerHTML = UI.avatar({ nama: 'Foto', foto: dataUrl }, 64);
          Utils.toast('Foto siap diunggah.', 'success');
        }).catch(function (err) {
          photoData = '';
          Utils.toast(err.message, 'danger');
          photoInput.value = '';
        });
      });
    }

    UI.bindSubmit(form, function () {
      Utils.clearErrors(form);
      var data = Utils.formData(form);
      var errors = {};

      if (!data.nama) errors.nama = 'Nama atlet wajib diisi.';
      if (!data.tgl_lahir) errors.tgl_lahir = 'Tanggal lahir wajib diisi.';
      var pesanNisnSubmit = pesanNisn(data.nisn);
      if (pesanNisnSubmit) errors.nisn = pesanNisnSubmit;
      if (!data.jk) errors.jk = 'Jenis kelamin wajib dipilih.';
      if (!data.tinggi || Number(data.tinggi) < 80) errors.tinggi = 'Tinggi badan tidak valid.';
      if (!data.berat || Number(data.berat) < 20) errors.berat = 'Berat badan tidak valid.';
      if (!data.sekolah) errors.sekolah = 'Asal sekolah wajib diisi.';
      if (!data.no_hp) errors.no_hp = 'Nomor HP wajib diisi.';
      if (!data.username) errors.username = 'ID login wajib diisi.';
      if (String(data.username || '').length < 4) errors.username = 'ID login minimal 4 karakter.';
      if (!data.password || data.password.length < 6) errors.password = 'Kata sandi minimal 6 karakter.';
      if (data.password !== data.password2) errors.password2 = 'Konfirmasi kata sandi tidak sama.';

      if (Object.keys(errors).length) {
        Utils.showErrors(form, errors);
        Utils.toast('Mohon lengkapi isian yang ditandai.', 'danger');
      }

      var docsOk = true;
      if (docsApi) docsOk = docsApi.validate();
      if (Object.keys(errors).length || !docsOk) {
        if (!docsOk) Utils.toast('Seluruh dokumen pendaftaran wajib diunggah.', 'danger');
        return;
      }

      var btn = UI.submitButton(form);
      if (btn) btn.textContent = 'Mendaftarkan...';

      return Auth.registerAthlete({
        nama: data.nama,
        nisn: data.nisn,
        tgl_lahir: data.tgl_lahir,
        jk: data.jk,
        tinggi: data.tinggi,
        berat: data.berat,
        sekolah: data.sekolah,
        asal_pb: data.asal_pb,
        no_hp: data.no_hp,
        username: data.username,
        password: data.password,
        foto: photoData,
        dokumen: docsApi ? docsApi.get() : {}
      }).then(function (athlete) {
        showConfirmation(athlete, data.username);
      }).catch(function (err) {
        Utils.toast(err.message, 'danger');
        if (btn) btn.textContent = 'Daftar Sekarang';
      });
    });
  }

  function showConfirmation(athlete, username) {
    var wrap = document.getElementById('register-wrap');
    if (!wrap) return;
    Utils.toast('Pendaftaran berhasil!', 'success');
    var docs = athlete.dokumen || {};
    wrap.innerHTML =
      '<div class="auth-card">' +
      '<div class="confirm-screen">' +
      '<div class="brand-mark" style="margin:0 auto 12px">' + UI.icon('check', 26) + '</div>' +
      '<h2>Pendaftaran Berhasil</h2>' +
      '<p class="muted">Simpan ID atlet Anda. ID ini dipakai untuk masuk ke aplikasi.</p>' +
      '<div class="id-badge">' + Utils.esc(athlete.id_atlet) + '</div>' +
      '<div class="detail-grid mt-2" style="text-align:left">' +
      '<div class="detail-item"><div class="k">Nama</div><div class="v">' + Utils.esc(athlete.nama) + '</div></div>' +
      '<div class="detail-item"><div class="k">NISN</div><div class="v">' + Utils.esc(athlete.nisn || '-') + '</div></div>' +
      '<div class="detail-item"><div class="k">ID Login</div><div class="v">' + Utils.esc(username) + '</div></div>' +
      '<div class="detail-item"><div class="k">Usia</div><div class="v">' + Utils.age(athlete.tgl_lahir) + ' tahun</div></div>' +
      '<div class="detail-item"><div class="k">BMI</div><div class="v">' + Utils.esc(athlete.bmi) + ' (' + Utils.esc(athlete.kategori_bmi) + ')</div></div>' +
      '</div>' +
      '<div class="mt-3" style="text-align:left">' +
      '<h3 class="docs-title">Dokumen Pendaftaran</h3>' +
      Docs.viewerHtml(docs) +
      '</div>' +
      '<div class="notice ok mt-3" style="text-align:left">' + UI.icon('info', 20) +
      '<div>Akun Anda sudah aktif. Silakan masuk menggunakan ID login <b>' + Utils.esc(username) + '</b> dan kata sandi yang dibuat.</div></div>' +
      '<a class="btn btn-block mt-2" href="login.html">Masuk Sekarang</a>' +
      '<a class="btn btn-ghost btn-block mt-1" href="index.html">Ke Beranda</a>' +
      '</div></div>';

    Docs.bindViewer(wrap, docs);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return {
    initLogin: initLogin,
    initRegister: initRegister
  };
})();
