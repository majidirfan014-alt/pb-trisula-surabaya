var PagesAuth = (function () {
  var docsApi = null;
  var boxFotoAtlet = null;
  var boxLisensi = null;
  var boxFotoAsisten = null;

  /* ---------- validasi isian bersama ---------- */
  // Tanggal lahir: wajib, tidak boleh hari ini maupun masa depan.
  function validasiTglLahir(value) {
    if (!value) return 'Tanggal lahir wajib diisi.';
    var tgl = Utils.parseISO(value);
    if (!tgl || isNaN(tgl.getTime())) return 'Tanggal lahir tidak valid.';
    var hariIni = Utils.parseISO(Utils.todayISO());
    hariIni.setHours(0, 0, 0, 0);
    if (tgl.getTime() >= hariIni.getTime()) {
      return 'Tanggal lahir tidak boleh hari ini atau di masa depan.';
    }
    return '';
  }

  // Tanggal bergabung: wajib, tidak boleh di masa depan (boleh hari ini).
  function validasiTglBergabung(value) {
    if (!value) return 'Tanggal bergabung wajib diisi.';
    var tgl = Utils.parseISO(value);
    if (!tgl || isNaN(tgl.getTime())) return 'Tanggal bergabung tidak valid.';
    var hariIni = Utils.parseISO(Utils.todayISO());
    hariIni.setHours(0, 0, 0, 0);
    if (tgl.getTime() > hariIni.getTime()) {
      return 'Tanggal bergabung tidak boleh di masa depan.';
    }
    return '';
  }

  // Jenis latihan: wajib salah satu dari daftar CONFIG.JENIS_LATIHAN.
  function validasiJenisLatihan(value) {
    var daftar = (CONFIG.JENIS_LATIHAN || []).map(function (o) { return o.value; });
    if (!value || daftar.indexOf(value) === -1) {
      return 'Jenis latihan wajib dipilih.';
    }
    return '';
  }

  // No. HP: hanya angka dengan awalan + yang sah; format 08xx / +628xx,
  // 10–15 digit setelah spasi/tanda hubung dibuang. Kosong = boleh
  // (pemanggil menentukan apakah wajib).
  function validasiNoHp(value) {
    var v = String(value || '').trim();
    if (!v) return '';
    var bersih = v.replace(/[\s\-().]/g, '');
    if (!/^\+?\d+$/.test(bersih)) {
      return 'No. HP hanya boleh angka (boleh diawali +). Contoh: 081234567890.';
    }
    var lokal = bersih;
    if (lokal.slice(0, 3) === '+62') lokal = '0' + lokal.slice(3);
    else if (lokal.slice(0, 2) === '62' && lokal.length >= 11) lokal = '0' + lokal.slice(2);
    if (!/^08\d+$/.test(lokal)) {
      return 'Format No. HP tidak valid. Contoh: 081234567890 atau +6281234567890.';
    }
    if (lokal.length < 10 || lokal.length > 15) {
      return 'No. HP harus 10–15 digit (contoh: 081234567890).';
    }
    return '';
  }

  // Siapkan satu kolom unggahan (kotak proses lokal, tanpa cloud).
  function siapkanBox(idHost, opts) {
    var host = document.getElementById(idHost);
    if (!host) return null;
    host.innerHTML = Docs.boxHtml(opts);
    return Docs.bindBox(host, opts);
  }

  // Tombol kirim nonaktif selama masih ada unggahan yang diproses.
  function kunciTombol(form, terkunci) {
    var btn = UI.submitButton(form);
    if (!btn) return;
    if (terkunci) {
      btn.disabled = true;
      btn.setAttribute('data-upload-lock', '1');
    } else if (btn.getAttribute('data-upload-lock')) {
      btn.disabled = false;
      btn.removeAttribute('data-upload-lock');
    }
  }

  function statusCloud() {
    return (typeof Cloud !== 'undefined' && Cloud && Cloud.siap && Cloud.siap()) ? 'cloud' : 'lokal';
  }

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
    var formAtlet = document.getElementById('register-form');
    var formAsisten = document.getElementById('register-form-asisten');
    if (!formAtlet && !formAsisten) return;

    bindPasswordToggles();
    bindBackButtons();

    /* ---------- pemilih mode pendaftaran: Atlet / Asisten ---------- */
    var tabHost = document.getElementById('tab-daftar');
    var judul = document.getElementById('judul-daftar');
    var sub = document.getElementById('sub-daftar');

    function setMode(mode) {
      if (formAtlet) formAtlet.hidden = (mode !== 'atlet');
      if (formAsisten) formAsisten.hidden = (mode !== 'asisten');
      if (judul) judul.textContent = mode === 'asisten' ? 'Pendaftaran Asisten Pelatih' : 'Pendaftaran Atlet';
      if (sub) {
        sub.textContent = mode === 'asisten'
          ? 'Isi data di bawah ini untuk membuat akun asisten pelatih.'
          : 'Isi data di bawah ini. ID atlet dibuat otomatis setelah pendaftaran selesai.';
      }
      if (tabHost) {
        var tombol = tabHost.querySelectorAll('.tab');
        for (var i = 0; i < tombol.length; i++) {
          tombol[i].classList.toggle('active', tombol[i].getAttribute('data-mode') === mode);
        }
      }
    }
    if (tabHost) {
      tabHost.addEventListener('click', function (e) {
        var t = e.target && e.target.closest ? e.target.closest('[data-mode]') : null;
        if (!t) return;
        setMode(t.getAttribute('data-mode'));
      });
    }
    setMode('atlet');

    /* ================= FORM ATLET ================= */
    if (formAtlet) {
      // Semua kolom unggahan mengunci tombol kirim selama masih diproses.
      function kunciFormAtlet() {
        var sibuk = (docsApi && docsApi.busy ? docsApi.busy() : 0) +
          (boxFotoAtlet ? boxFotoAtlet.busy() : 0);
        kunciTombol(formAtlet, sibuk > 0);
      }

      var slot = document.getElementById('docs-slot');
      if (slot) {
        slot.innerHTML = Docs.sectionHtml();
        docsApi = Docs.bind(slot, { onBusy: kunciFormAtlet });
      }

      var tinggi = formAtlet.querySelector('[name="tinggi"]');
      var berat = formAtlet.querySelector('[name="berat"]');
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
          Utils.esc(result.category.label) + ' / dihitung otomatis</div></div>';
      }

      if (tinggi) tinggi.addEventListener('input', updateBmi);
      if (berat) berat.addEventListener('input', updateBmi);
      updateBmi();

      // Tanggal bergabung: default hari ini (boleh diubah).
      var tglBergabungInput = formAtlet.querySelector('[name="tgl_bergabung"]');
      if (tglBergabungInput && !tglBergabungInput.value) {
        tglBergabungInput.value = Utils.todayISO();
      }

      // Pastikan tanggal lahir kosong (bukan terisi otomatis oleh autofill).
      var tglLahirInput = formAtlet.querySelector('[name="tgl_lahir"]');
      if (tglLahirInput && !tglLahirInput.dataset.persist) tglLahirInput.value = '';

      // Foto profil: satu komponen unggah bersama, sepenuhnya lokal.
      boxFotoAtlet = siapkanBox('atlet-foto-box', {
        key: 'foto-atlet',
        label: 'Foto Profil',
        jenis: 'foto',
        required: false,
        preview: 'bulat',
        maksPx: 800, // avatar cukup 800px → proses kilat
        labelRequired: 'Foto profil wajib diunggah.',
        onChange: function () {},
        onBusy: function () { kunciFormAtlet(); }
      });

      UI.bindSubmit(formAtlet, function () {
        Utils.clearErrors(formAtlet);
        var data = Utils.formData(formAtlet);
        var errors = {};

        if (!data.nama) errors.nama = 'Nama atlet wajib diisi.';
        var pesanLahir = validasiTglLahir(data.tgl_lahir);
        if (pesanLahir) errors.tgl_lahir = pesanLahir;
        var pesanBergabung = validasiTglBergabung(data.tgl_bergabung);
        if (pesanBergabung) errors.tgl_bergabung = pesanBergabung;
        var pesanJenis = validasiJenisLatihan(data.jenis_latihan);
        if (pesanJenis) errors.jenis_latihan = pesanJenis;
        if (!data.jk) errors.jk = 'Jenis kelamin wajib dipilih.';
        if (!data.tinggi || Number(data.tinggi) < 80) errors.tinggi = 'Tinggi badan tidak valid.';
        if (!data.berat || Number(data.berat) < 20) errors.berat = 'Berat badan tidak valid.';
        if (!data.sekolah) errors.sekolah = 'Asal sekolah wajib diisi.';
        if (!data.no_hp) errors.no_hp = 'Nomor HP wajib diisi.';
        else {
          var pesanHp = validasiNoHp(data.no_hp);
          if (pesanHp) errors.no_hp = pesanHp;
        }
        if (!data.username) errors.username = 'ID login wajib diisi.';
        if (String(data.username || '').length < 4) errors.username = 'ID login minimal 4 karakter.';
        if (!data.password || data.password.length < 6) errors.password = 'Kata sandi minimal 6 karakter.';
        if (data.password !== data.password2) errors.password2 = 'Konfirmasi kata sandi tidak sama.';

        var docsSedang = docsApi && docsApi.busy && docsApi.busy() > 0;
        var fotoSedang = boxFotoAtlet && boxFotoAtlet.busy() > 0;
        if (docsSedang || fotoSedang) {
          Utils.toast('Tunggu proses unggahan selesai terlebih dahulu.', 'danger');
          return;
        }

        if (Object.keys(errors).length) {
          Utils.showErrors(formAtlet, errors);
          Utils.toast('Mohon lengkapi isian yang ditandai.', 'danger');
        }

        var docsOk = true;
        if (docsApi) docsOk = docsApi.validate();
        if (Object.keys(errors).length || !docsOk) {
          if (!docsOk) Utils.toast('Seluruh dokumen pendaftaran wajib diunggah.', 'danger');
          return;
        }

        var btn = UI.submitButton(formAtlet);
        if (btn) btn.textContent = 'Mendaftarkan...';

        var fotoHasil = boxFotoAtlet ? boxFotoAtlet.get() : null;

        return Auth.registerAthlete({
          nama: data.nama,
          tgl_bergabung: data.tgl_bergabung,
          jenis_latihan: data.jenis_latihan,
          tgl_lahir: data.tgl_lahir,
          jk: data.jk,
          tinggi: data.tinggi,
          berat: data.berat,
          sekolah: data.sekolah,
          asal_pb: data.asal_pb,
          alamat: data.alamat,
          agama: data.agama,
          no_hp: data.no_hp,
          username: data.username,
          password: data.password,
          // foto disimpan sebagai thumbnail ringan agar kompatibel dengan
          // tampilan avatar; berkas utuhnya tetap ada di IndexedDB (fid).
          foto: fotoHasil ? (fotoHasil.thumb || '') : '',
          dokumen: docsApi ? docsApi.get() : {}
        }).then(function (athlete) {
          showConfirmation(athlete, data.username);
        }).catch(function (err) {
          Utils.toast(err.message, 'danger');
          if (btn) btn.textContent = 'Daftar Sekarang';
        });
      });
    }

    /* ================= FORM ASISTEN PELATIH ================= */
    if (formAsisten) {
      function kunciFormAsisten() {
        var sibuk = (boxLisensi ? boxLisensi.busy() : 0) +
          (boxFotoAsisten ? boxFotoAsisten.busy() : 0);
        kunciTombol(formAsisten, sibuk > 0);
      }

      var tglAsisten = formAsisten.querySelector('[name="tgl_lahir"]');
      var usiaAsisten = formAsisten.querySelector('[name="usia"]');

      function updateUsia() {
        if (!usiaAsisten) return;
        var ada = tglAsisten && tglAsisten.value;
        usiaAsisten.value = ada ? String(Utils.age(tglAsisten.value)) + ' tahun' : '-';
      }
      if (tglAsisten) {
        // kosong secara default (jangan terisi autofill peramban)
        if (!tglAsisten.dataset.persist) tglAsisten.value = '';
        tglAsisten.addEventListener('change', updateUsia);
        tglAsisten.addEventListener('input', updateUsia);
      }
      updateUsia();

      // Lisensi & Foto Profil: satu komponen unggah bersama (lokal, tanpa cloud).
      boxLisensi = siapkanBox('lisensi-box', {
        key: 'lisensi',
        label: 'Lisensi Pelatih',
        jenis: 'campuran',
        required: true,
        labelRequired: 'Lisensi pelatih wajib diunggah.',
        onChange: function () {},
        onBusy: kunciFormAsisten
      });

      boxFotoAsisten = siapkanBox('asisten-foto-box', {
        key: 'foto-asisten',
        label: 'Foto Profil',
        jenis: 'foto',
        required: true,
        preview: 'bulat',
        maksPx: 800,
        labelRequired: 'Foto profil wajib diunggah.',
        onChange: function () {},
        onBusy: kunciFormAsisten
      });

      UI.bindSubmit(formAsisten, function () {
        Utils.clearErrors(formAsisten);
        var data = Utils.formData(formAsisten);
        var errors = {};

        if (!data.nama) errors.nama = 'Nama lengkap wajib diisi.';
        var pesanLahirAsisten = validasiTglLahir(data.tgl_lahir);
        if (pesanLahirAsisten) errors.tgl_lahir = pesanLahirAsisten;
        var pesanHpAsisten = validasiNoHp(data.no_hp);
        if (pesanHpAsisten) errors.no_hp = pesanHpAsisten;
        if (!data.username) errors.username = 'ID login wajib diisi.';
        if (String(data.username || '').length < 4) errors.username = 'ID login minimal 4 karakter.';
        if (!data.password || data.password.length < 6) errors.password = 'Kata sandi minimal 6 karakter.';
        if (data.password !== data.password2) errors.password2 = 'Konfirmasi kata sandi tidak sama.';

        if ((boxLisensi && boxLisensi.busy() > 0) || (boxFotoAsisten && boxFotoAsisten.busy() > 0)) {
          Utils.toast('Tunggu proses unggahan selesai terlebih dahulu.', 'danger');
          return;
        }
        if (!boxLisensi || !boxLisensi.validate(true)) errors.lisensi_file = 'Lisensi pelatih wajib diunggah.';
        if (!boxFotoAsisten || !boxFotoAsisten.validate(true)) errors.foto_file = 'Foto profil wajib diunggah.';

        if (Object.keys(errors).length) {
          Utils.showErrors(formAsisten, errors);
          Utils.toast('Mohon lengkapi isian yang ditandai.', 'danger');
          return;
        }

        var btn = UI.submitButton(formAsisten);
        if (btn) btn.textContent = 'Mendaftarkan...';

        var lisensiHasil = boxLisensi ? boxLisensi.get() : null;
        var fotoHasilAsisten = boxFotoAsisten ? boxFotoAsisten.get() : null;

        return Auth.registerAsisten({
          nama: data.nama,
          tgl_lahir: data.tgl_lahir,
          no_hp: data.no_hp,
          lisensi: lisensiHasil,
          foto: fotoHasilAsisten ? (fotoHasilAsisten.thumb || '') : '',
          username: data.username,
          password: data.password
        }).then(function (user) {
          Utils.toast('Pendaftaran asisten pelatih berhasil. Silakan masuk.', 'success');
          window.location.href = 'login.html';
        }).catch(function (err) {
          Utils.toast(err.message, 'danger');
          if (btn) btn.textContent = 'Daftar sebagai Asisten';
        });
      });
    }
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
      '<div class="detail-item"><div class="k">Tanggal Bergabung</div><div class="v">' +
      Utils.fmtDate(athlete.tgl_bergabung, true) + '</div></div>' +
      '<div class="detail-item"><div class="k">Jenis Latihan</div><div class="v">' +
      Utils.esc(UI.labelJenisLatihan(athlete.jenis_latihan)) + '</div></div>' +
      '<div class="detail-item"><div class="k">ID Login</div><div class="v">' + Utils.esc(username) + '</div></div>' +
      '<div class="detail-item"><div class="k">Usia</div><div class="v">' +
      (athlete.tgl_lahir ? Utils.age(athlete.tgl_lahir) + ' tahun' : '-') + '</div></div>' +
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
