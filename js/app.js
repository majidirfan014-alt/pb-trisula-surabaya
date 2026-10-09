var App = (function () {
  var user = null;
  var routes = {};
  var cleanups = [];
  var currentId = null;
  var navCount = 0;
  var dirty = false;
  var guardBusy = false;
  var lastGoodHash = null;

  var MENUS = {
    pelatih_kepala: [
      { id: 'beranda', label: 'Beranda', short: 'Beranda', icon: 'home', bottom: true },
      { id: 'daftar-atlet', label: 'Daftar Atlet', short: 'Atlet', icon: 'users' },
      { id: 'kehadiran', label: 'Kehadiran', short: 'Kehadiran', icon: 'calendar', bottom: true },
      { id: 'tes-fisik', label: 'Tes Fisik', short: 'Tes Fisik', icon: 'activity' },
      { id: 'logbook', label: 'Logbook', short: 'Logbook', icon: 'clipboard', bottom: true },
      { id: 'monitoring', label: 'Monitoring', short: 'Monitoring', icon: 'chart', bottom: true },
      { id: 'pertandingan', label: 'Pertandingan', short: 'Pertandingan', icon: 'trophy', bottom: true },
      { id: 'pengguna', label: 'Pengguna', short: 'Pengguna', icon: 'settings' },
      { id: 'landing-page', label: 'Landing Page', short: 'Landing', icon: 'eye' }
    ],
    asisten: [
      { id: 'beranda', label: 'Beranda', short: 'Beranda', icon: 'home', bottom: true },
      { id: 'absensi', label: 'Absensi Kehadiran', short: 'Absensi', icon: 'calendar', bottom: true },
      { id: 'logbook-harian', label: 'Logbook Harian', short: 'Logbook', icon: 'clipboard', bottom: true },
      { id: 'input-pertandingan', label: 'Input Pertandingan', short: 'Pertandingan', icon: 'trophy', bottom: true }
    ],
    atlet: [
      { id: 'beranda', label: 'Perkembangan', short: 'Perkembangan', icon: 'chart', bottom: true },
      { id: 'monitoring-saya', label: 'Monitoring', short: 'Monitoring', icon: 'chart', bottom: true },
      { id: 'tes-saya', label: 'Hasil Tes Kondisi Fisik', short: 'Tes Fisik', icon: 'activity', bottom: true },
      { id: 'hasil-pertandingan', label: 'Hasil Pertandingan', short: 'Pertandingan', icon: 'trophy', bottom: true },
      { id: 'profil', label: 'Profil Atlet', short: 'Profil', icon: 'user', bottom: true }
    ]
  };

  function register(id, def) {
    def.id = id;
    routes[id] = def;
  }

  function menus() {
    return MENUS[user.role] || [];
  }

  function menuById(id) {
    var list = menus();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function homeId() {
    return 'beranda';
  }

  function currentHash() {
    var raw = (window.location.hash || '').replace(/^#\/?/, '').split('?')[0];
    return raw || homeId();
  }

  function canAccess(id) {
    if (id === homeId()) return true;
    var list = menus();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return true;
    }
    return false;
  }

  function setDirty(value) {
    dirty = !!value;
  }

  function isDirty() {
    return dirty;
  }

  function subscribe(collection, handler) {
    cleanups.push(Store.subscribe(collection, handler));
  }

  function cleanup() {
    cleanups.forEach(function (fn) {
      try {
        fn();
      } catch (e) {}
    });
    cleanups = [];
  }

  function go(hash) {
    var target = '#/' + String(hash || homeId()).replace(/^#\/?/, '');
    if (window.location.hash === target) {
      render();
      return;
    }
    window.location.hash = target;
  }

  function back(fallback) {
    if (navCount > 1 && window.history.length > 1) {
      window.history.back();
      return;
    }
    go(fallback || homeId());
  }

  function confirmLeave() {
    return UI.confirmDialog('Data belum disimpan, yakin kembali?', 'Konfirmasi Pindah Halaman');
  }

  function closeModalGuarded(modalId) {
    if (!modalId) return;
    if (!isDirty()) {
      UI.closeModal(modalId);
      return;
    }
    confirmLeave().then(function (ok) {
      if (ok) {
        setDirty(false);
        UI.closeModal(modalId);
      }
    });
  }

  function renderSidebar() {
    var host = document.getElementById('sidebar');
    if (!host) return;
    var html =
      '<a class="brand" href="app.html#/beranda" style="margin-bottom:16px">' +
      '<img class="brand-logo" src="assets/logo-pb-trisula.png" alt="Logo PB Trisula Surabaya" width="46" height="46">' +
      '<div class="brand-text" style="display:block">PB TRISULA SURABAYA<small>Monitoring Atlet</small></div>' +
      '</a>' +
      '<div class="sidebar-user">' +
      UI.avatar(user, 42) +
      '<div class="meta"><b>' + Utils.esc(user.nama) + '</b>' +
      '<span>' + Utils.esc(CONFIG.ROLE_LABEL[user.role] || user.role) +
      (user.id_atlet ? ' · ' + Utils.esc(user.id_atlet) : '') + '</span></div>' +
      '</div>';

    html += '<nav class="side-nav" aria-label="Menu utama">';
    menus().forEach(function (m) {
      html += '<a class="side-link' + (m.id === currentId ? ' active' : '') + '" href="#/' + m.id + '" data-nav="' + m.id + '">' +
        UI.icon(m.icon, 21) + '<span>' + Utils.esc(m.label) + '</span></a>';
    });
    html += '</nav>';

    html += '<div class="sidebar-foot">' +
      '<button type="button" class="side-link" data-logout>' + UI.icon('logout', 21) + '<span>Keluar</span></button>' +
      '<div class="small muted" style="padding:10px 12px 0">' + Utils.esc(CONFIG.APP_NAME) + '</div>' +
      '</div>';

    host.innerHTML = html;
  }

  function renderBottomNav() {
    var host = document.getElementById('bottom-nav');
    if (!host) return;
    var list = menus();
    var bottom = list.filter(function (m) {
      return m.bottom;
    });
    var hasMore = bottom.length < list.length;
    var html = '';
    bottom.forEach(function (m) {
      html += '<a class="bottom-link' + (m.id === currentId ? ' active' : '') + '" href="#/' + m.id + '" data-nav="' + m.id + '">' +
        UI.icon(m.icon, 22) + '<span>' + Utils.esc(m.short || m.label) + '</span></a>';
    });
    if (hasMore) {
      html += '<button type="button" class="bottom-link" data-open-more>' + UI.icon('menu', 22) + '<span>Lainnya</span></button>';
    }
    host.innerHTML = html;
  }

  function openMore() {
    var host = document.getElementById('modal-host');
    if (!host) return;
    if (document.getElementById('more-menu')) return;
    var rest = menus().filter(function (m) {
      return !m.bottom;
    });
    var body = '<div class="list-rows">';
    rest.forEach(function (m) {
      body += '<a class="list-row" href="#/' + m.id + '" data-nav="' + m.id + '" data-modal-close="more-menu">' +
        UI.icon(m.icon, 22) +
        '<div class="grow"><b>' + Utils.esc(m.label) + '</b></div>' +
        UI.icon('arrowLeft', 18) + '</a>';
    });
    body += '<button type="button" class="list-row" data-logout style="width:100%;text-align:left;cursor:pointer;background:#fff">' +
      UI.icon('logout', 22) + '<div class="grow"><b>Keluar</b><span>Akhiri sesi Anda</span></div></button>';
    body += '</div>';

    host.innerHTML = UI.modalShell('more-menu', 'Menu Lainnya', body, '');
    UI.openModal('more-menu');
  }

  function render() {
    cleanup();
    var id = currentHash();
    var def = routes[id];
    if (!def || !canAccess(id)) {
      if (id !== homeId()) {
        window.location.replace('#/' + homeId());
        return;
      }
      id = homeId();
      def = routes[id];
    }
    currentId = id;
    lastGoodHash = id;
    setDirty(false);

    var content = document.getElementById('page-content');
    if (!content) return;

    var showBack = id !== homeId() && def.hideBack !== true;
    content.innerHTML = (showBack
      ? UI.backButton({ parent: def.parent || homeId(), label: def.backLabel })
      : '') + '<div id="page-slot"></div>';

    var menu = menuById(id);
    var titleEl = document.getElementById('page-title');
    var subEl = document.getElementById('page-sub');
    if (titleEl) titleEl.textContent = def.title || (menu ? menu.label : CONFIG.SHORT_NAME);
    if (subEl) subEl.textContent = def.subtitle || CONFIG.ROLE_LABEL[user.role] || '';

    renderSidebar();
    renderBottomNav();

    var slot = document.getElementById('page-slot');
    try {
      def.render(slot, user, App);
    } catch (err) {
      console.error(err);
      if (slot) slot.innerHTML = UI.emptyState('Terjadi kesalahan saat memuat halaman.', 'alert');
    }

    window.scrollTo({ top: 0, behavior: 'auto' });
    closeDrawer();
  }

  function onHashChange() {
    if (guardBusy) return;
    var next = currentHash();
    if (!isDirty()) {
      navCount++;
      render();
      return;
    }
    guardBusy = true;
    confirmLeave().then(function (ok) {
      guardBusy = false;
      if (ok) {
        setDirty(false);
        navCount++;
        render();
      } else {
        if (window.history.replaceState) {
          window.history.replaceState(null, '', '#/' + (lastGoodHash || homeId()));
        } else {
          window.location.hash = '#/' + (lastGoodHash || homeId());
        }
      }
    });
  }

  function closeDrawer() {
    var sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('open');
    var backdrop = document.getElementById('drawer-backdrop');
    if (backdrop) backdrop.hidden = true;
    if (!document.querySelector('.modal-backdrop:not([hidden])')) {
      document.body.classList.remove('modal-open');
    }
  }

  function openDrawer() {
    var sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.add('open');
    var backdrop = document.getElementById('drawer-backdrop');
    if (backdrop) backdrop.hidden = false;
    document.body.classList.add('modal-open');
  }

  function doLogout() {
    UI.confirmDialog('Anda yakin ingin keluar dari akun ini?', 'Konfirmasi Keluar').then(function (ok) {
      if (!ok) return;
      setDirty(false);
      Auth.logout();
      window.location.replace('login.html');
    });
  }

  function missingDeps() {
    var need = [
      ['CONFIG', 'config.js'], ['Utils', 'utils.js'], ['Store', 'store.js'],
      ['Auth', 'auth.js'], ['UI', 'ui.js'], ['Docs', 'docs.js'], ['Shared', 'shared.js']
    ];
    return need.filter(function (n) {
      return typeof window[n[0]] === 'undefined' || window[n[0]] === null;
    }).map(function (n) {
      return n[1];
    });
  }

  function renderBroken(missing) {
    var content = document.getElementById('page-content') || document.body;
    content.innerHTML =
      '<div class="card" style="border:2px solid #dc2626">' +
      '<div class="card-title" style="color:#b91c1c">' + UI.icon('alert', 22) + 'Aplikasi belum termuat sempurna</div>' +
      '<p>File berikut tidak berhasil dimuat: <b>' + Utils.esc(missing.join(', ')) + '</b>.</p>' +
      '<p class="muted">Ini biasanya terjadi karena browser memakai versi lama yang tersimpan di cache. ' +
      'Muat ulang paksa dengan <b>Ctrl + Shift + R</b> (Windows) atau <b>Cmd + Shift + R</b> (Mac), lalu coba lagi.</p>' +
      '<button type="button" class="btn" onclick="location.reload(true)">Muat Ulang Sekarang</button>' +
      '</div>';
  }

  function init() {
    var missing = missingDeps();
    if (missing.length) {
      renderBroken(missing);
      return;
    }

    user = Auth.require();
    if (!user) return;

    PagesCoach.register();
    PagesAssistant.register();
    PagesAthlete.register();
    if (typeof PagesLanding !== 'undefined' && PagesLanding && PagesLanding.register) PagesLanding.register();
    if (typeof PagesMonitoring !== 'undefined' && PagesMonitoring && PagesMonitoring.register) PagesMonitoring.register();

    App.register('beranda', {
      title: user.role === 'atlet' ? 'Perkembangan Saya' : 'Beranda',
      subtitle: CONFIG.ROLE_LABEL[user.role],
      render: function (root, u) {
        if (u.role === 'pelatih_kepala') PagesCoach.home(root, u, App);
        else if (u.role === 'asisten') PagesAssistant.home(root, u, App);
        else PagesAthlete.home(root, u, App);
      }
    });

    window.addEventListener('hashchange', onHashChange);

    document.addEventListener('input', function (e) {
      var form = e.target.closest ? e.target.closest('form') : null;
      if (form && !form.hasAttribute('data-no-dirty')) setDirty(true);
    }, true);

    document.addEventListener('click', function (e) {
      if (!e.target || !e.target.closest) return;

      var more = e.target.closest('[data-open-more]');
      if (more) {
        e.preventDefault();
        openMore();
        return;
      }

      var backBtn = e.target.closest('[data-back], [data-back-close]');
      if (backBtn) {
        e.preventDefault();
        var closeId = backBtn.getAttribute('data-back-close');
        if (closeId) {
          closeModalGuarded(closeId);
          return;
        }
        if (isDirty()) {
          confirmLeave().then(function (ok) {
            if (ok) {
              setDirty(false);
              back(backBtn.getAttribute('data-back-parent'));
            }
          });
          return;
        }
        back(backBtn.getAttribute('data-back-parent'));
        return;
      }

      var logout = e.target.closest('[data-logout]');
      if (logout) {
        e.preventDefault();
        doLogout();
        return;
      }

      var close = e.target.closest('[data-modal-close]');
      if (close) {
        var modalId = close.getAttribute('data-modal-close');
        var isLink = close.tagName === 'A' && close.getAttribute('href');
        if (isLink) {
          UI.closeModal(modalId);
        } else {
          e.preventDefault();
          closeModalGuarded(modalId);
        }
        if (modalId === 'more-menu') {
          setTimeout(function () {
            var host = document.getElementById('modal-host');
            if (host && !host.querySelector('.modal-backdrop:not([hidden])')) host.innerHTML = '';
          }, 220);
        }
        return;
      }

      if (e.target.classList && e.target.classList.contains('modal-backdrop')) {
        var backId = e.target.id;
        if (backId) closeModalGuarded(backId);
        return;
      }

      if (e.target.id === 'drawer-backdrop') closeDrawer();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' && e.key !== 'Esc') return;
      var confirmWrap = document.querySelector('.confirm-dialog-open');
      if (confirmWrap) return;
      var open = document.querySelectorAll('.modal-backdrop:not([hidden])');
      if (!open.length) return;
      e.preventDefault();
      var top = open[open.length - 1];
      if (top.id) closeModalGuarded(top.id);
    });

    var refreshBtn = document.getElementById('btn-refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        setDirty(false);
        render();
        UI.toast('Data diperbarui.', 'success');
      });
    }

    var toggle = document.getElementById('side-toggle');
    if (toggle) {
      toggle.addEventListener('click', function () {
        var sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('open')) closeDrawer();
        else openDrawer();
      });
    }

    var logoutTop = document.getElementById('btn-logout');
    if (logoutTop) logoutTop.addEventListener('click', doLogout);

    render();
  }

  return {
    register: register,
    subscribe: subscribe,
    init: init,
    render: render,
    go: go,
    back: back,
    setDirty: setDirty,
    isDirty: isDirty,
    user: function () {
      return user;
    }
  };
})();
