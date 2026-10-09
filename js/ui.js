var UI = (function () {
  var ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-7h6v7"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 2.7-5 6-5s6 2 6 5"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17.5 14c2.4 0 4 1.7 4 4"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 3v4"/><path d="M16 3v4"/><path d="M8 14h3"/><path d="M8 18h3"/>',
    activity: '<path d="M3 12h4l3 8 4-16 3 8h4"/>',
    clipboard: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4h6v3H9z"/><path d="M9 12h6"/><path d="M9 16h4"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 5H5.5A2.5 2.5 0 0 0 8 8"/><path d="M16 5h2.5A2.5 2.5 0 0 1 16 8"/><path d="M12 13v3"/><path d="M8 20h8"/><path d="M10 20v-2h4v2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3"/><path d="M12 19v3"/><path d="M2 12h3"/><path d="M19 12h3"/><path d="M5 5l2 2"/><path d="M17 17l2 2"/><path d="M19 5l-2 2"/><path d="M7 17l-2 2"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
    logout: '<path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h10"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    edit: '<path d="M4 20h4L20 8l-4-4L4 16z"/><path d="M14 6l4 4"/>',
    trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>',
    check: '<path d="M5 13l4 4L19 7"/>',
    x: '<path d="M6 6l12 12"/><path d="M18 6 6 18"/>',
    chart: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M2 20h20"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7h.01"/>',
    arrowLeft: '<path d="M19 12H5"/><path d="M11 6l-6 6 6 6"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
    save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v6h8V4"/><path d="M8 20v-6h8v6"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/>',
    alert: '<path d="M12 3l9 17H3z"/><path d="M12 10v4"/><path d="M12 17h.01"/>',
    star: '<path d="M12 3l2.7 5.6 6.3.9-4.5 4.3 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.5l6.3-.9z"/>',
    menu: '<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>',
    close: '<path d="M6 6l12 12"/><path d="M18 6 6 18"/>'
  };

  function icon(name, size) {
    var body = ICONS[name] || ICONS.info;
    var s = size || 22;
    return '<svg class="icon" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
  }

  function badge(text, tone) {
    return '<span class="badge badge-' + (tone || 'muted') + '">' + Utils.esc(text) + '</span>';
  }

  function statusBadge(status) {
    var tone = 'muted';
    if (status === 'Hadir' || status === 'Menang' || status === 'aktif') tone = 'ok';
    if (status === 'Izin') tone = 'warn';
    if (status === 'Sakit') tone = 'info';
    if (status === 'Tidak Hadir' || status === 'Alpa' || status === 'Kalah' || status === 'nonaktif') tone = 'danger';
    return badge(status, tone);
  }

  function avatar(entity, size) {
    var s = size || 44;
    var foto = entity && entity.foto;
    var nama = (entity && entity.nama) || '?';
    var initial = nama.trim().charAt(0).toUpperCase();
    if (foto) {
      return '<img class="avatar" src="' + foto + '" alt="Foto ' + Utils.esc(nama) + '" width="' + s + '" height="' + s + '">';
    }
    return '<div class="avatar avatar-initial" style="width:' + s + 'px;height:' + s + 'px;font-size:' + Math.round(s * 0.4) + 'px">' + Utils.esc(initial) + '</div>';
  }

  function statCard(label, value, sub, iconName, tone) {
    return '<div class="stat-card tone-' + (tone || 'primary') + '">' +
      '<div class="stat-icon">' + icon(iconName || 'chart', 24) + '</div>' +
      '<div class="stat-body"><div class="stat-value">' + Utils.esc(value) + '</div>' +
      '<div class="stat-label">' + Utils.esc(label) + '</div>' +
      (sub ? '<div class="stat-sub">' + sub + '</div>' : '') +
      '</div></div>';
  }

  function emptyState(message, iconName) {
    return '<div class="empty-state">' + icon(iconName || 'info', 40) +
      '<p>' + Utils.esc(message || 'Belum ada data.') + '</p></div>';
  }

  function table(headers, rows, opts) {
    opts = opts || {};
    if (!rows.length) return emptyState(opts.empty || 'Belum ada data.');
    var html = '<div class="table-wrap"><table class="table"><thead><tr>';
    headers.forEach(function (h) {
      html += '<th' + (h.align ? ' class="align-' + h.align + '"' : '') + '>' + Utils.esc(h.label) + '</th>';
    });
    html += '</tr></thead><tbody>';
    rows.forEach(function (row) {
      html += '<tr>' + row + '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  function field(opts) {
    var name = opts.name;
    var label = opts.label;
    var type = opts.type || 'text';
    var value = opts.value === undefined || opts.value === null ? '' : opts.value;
    var required = opts.required ? ' required' : '';
    var help = opts.help ? '<div class="help">' + Utils.esc(opts.help) + '</div>' : '';
    var error = '<div class="field-error" data-error-for="' + name + '"></div>';
    var attrs = 'name="' + name + '" id="f-' + name + '"' + required +
      (opts.placeholder ? ' placeholder="' + Utils.esc(opts.placeholder) + '"' : '') +
      (opts.min !== undefined ? ' min="' + opts.min + '"' : '') +
      (opts.max !== undefined ? ' max="' + opts.max + '"' : '') +
      (opts.step !== undefined ? ' step="' + opts.step + '"' : '') +
      (opts.disabled ? ' disabled' : '') +
      (opts.attrs || '');

    var control;
    if (type === 'textarea') {
      control = '<textarea class="input" ' + attrs + ' rows="' + (opts.rows || 3) + '">' + Utils.esc(value) + '</textarea>';
    } else if (type === 'select') {
      control = '<select class="input" ' + attrs + '>';
      (opts.options || []).forEach(function (op) {
        var val = typeof op === 'string' ? op : op.value;
        var text = typeof op === 'string' ? op : op.label;
        var sel = String(value) === String(val) ? ' selected' : '';
        control += '<option value="' + Utils.esc(val) + '"' + sel + '>' + Utils.esc(text) + '</option>';
      });
      control += '</select>';
    } else {
      control = '<input class="input" type="' + type + '" value="' + Utils.esc(value) + '" ' + attrs + '>';
    }

    return '<div class="field">' +
      '<label class="label" for="f-' + name + '">' + Utils.esc(label) + (opts.required ? ' <span class="req">*</span>' : '') + '</label>' +
      control + help + error + '</div>';
  }

  function modalShell(id, title, body, footer) {
    return '<div class="modal-backdrop" id="' + id + '" hidden>' +
      '<div class="modal" role="dialog" aria-modal="true" aria-label="' + Utils.esc(title) + '">' +
      '<div class="modal-head"><h3>' + Utils.esc(title) + '</h3>' +
      '<button type="button" class="icon-btn" data-modal-close="' + id + '" aria-label="Tutup">' + icon('close', 20) + '</button></div>' +
      '<div class="modal-body" id="' + id + '-body">' + body + '</div>' +
      (footer ? '<div class="modal-foot" id="' + id + '-foot">' + footer + '</div>' : '') +
      '</div></div>';
  }

  function openModal(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.hidden = false;
    document.body.classList.add('modal-open');
  }

  function closeModal(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.hidden = true;
    if (!document.querySelector('.modal-backdrop:not([hidden])')) {
      document.body.classList.remove('modal-open');
    }
  }

  var confirmOpen = null;

  function confirmDialog(message, title) {
    return new Promise(function (resolve) {
      if (confirmOpen && document.body.contains(confirmOpen)) {
        resolve(false);
        return;
      }
      if (confirmOpen && confirmOpen.parentNode) confirmOpen.parentNode.removeChild(confirmOpen);
      confirmOpen = null;

      var id = 'confirm-' + Date.now();
      var wrap = document.createElement('div');
      wrap.className = 'confirm-dialog-open';
      wrap.innerHTML = modalShell(
        id,
        title || 'Konfirmasi',
        '<p class="confirm-text">' + Utils.esc(message) + '</p>',
        '<button type="button" class="btn btn-ghost" data-confirm="no">Batal</button>' +
        '<button type="button" class="btn btn-danger" data-confirm="yes">Ya, lanjutkan</button>'
      );
      document.body.appendChild(wrap);
      confirmOpen = wrap;
      openModal(id);

      var settled = false;
      function finish(value) {
        if (settled) return;
        settled = true;
        closeModal(id);
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
        if (confirmOpen === wrap) confirmOpen = null;
        resolve(value);
      }

      wrap.addEventListener('click', function (e) {
        if (!e.target || !e.target.closest) return;
        var btn = e.target.closest('[data-confirm]');
        if (btn) {
          e.stopPropagation();
          finish(btn.getAttribute('data-confirm') === 'yes');
          return;
        }
        if (e.target.closest('[data-modal-close]') || e.target.classList.contains('modal-backdrop')) {
          e.stopPropagation();
          finish(false);
        }
      });

      document.addEventListener('keydown', function onEsc(e) {
        if (settled) {
          document.removeEventListener('keydown', onEsc, true);
          return;
        }
        if (e.key === 'Escape' || e.key === 'Esc') {
          e.stopPropagation();
          e.preventDefault();
          document.removeEventListener('keydown', onEsc, true);
          finish(false);
        }
      }, true);
    });
  }

  function selectAthlete(name, value, opts) {
    opts = opts || {};
    var athletes = Utils.sortBy(Store.all('athletes'), 'nama', 'asc').filter(function (a) {
      return a.status !== 'nonaktif' || opts.includeInactive;
    });
    return field({
      name: name,
      label: opts.label || 'Atlet',
      type: 'select',
      required: opts.required !== false,
      value: value,
      options: [{ value: '', label: '-- Pilih atlet --' }].concat(athletes.map(function (a) {
        return { value: a.id_atlet, label: a.nama + ' (' + a.id_atlet + ')' };
      }))
    });
  }

  function athleteById(idAtlet) {
    return Store.findOne('athletes', function (a) {
      return a.id_atlet === idAtlet;
    });
  }

  function userName(userId) {
    var u = Store.find('users', userId);
    return u ? u.nama : '-';
  }

  function toast(message, type) {
    Utils.toast(message, type);
  }

  function pageHeader(title, subtitle, actionsHtml) {
    return '<div class="page-head">' +
      '<div><h2 class="page-title">' + Utils.esc(title) + '</h2>' +
      (subtitle ? '<p class="page-subtitle">' + Utils.esc(subtitle) + '</p>' : '') + '</div>' +
      (actionsHtml ? '<div class="page-actions">' + actionsHtml + '</div>' : '') +
      '</div>';
  }

  function backButton(opts) {
    opts = opts || {};
    var attrs = 'data-back';
    if (opts.parent) attrs += ' data-back-parent="' + Utils.esc(opts.parent) + '"';
    if (opts.closeModal) attrs += ' data-back-close="' + Utils.esc(opts.closeModal) + '"';
    return '<div class="back-bar">' +
      '<button type="button" class="btn-back" ' + attrs + '>' +
      icon('arrowLeft', 20) + '<span>' + Utils.esc(opts.label || 'Kembali') + '</span>' +
      '</button></div>';
  }

  function goBack(fallbackUrl) {
    var sameOrigin = false;
    try {
      if (document.referrer) {
        var a = document.createElement('a');
        a.href = document.referrer;
        sameOrigin = a.host === window.location.host;
      }
    } catch (e) {
      sameOrigin = false;
    }
    if (sameOrigin && window.history.length > 1) {
      window.history.back();
      return;
    }
    if (fallbackUrl) window.location.href = fallbackUrl;
  }

  function preventDouble(fn) {
    var busy = false;
    return function () {
      if (busy) return undefined;
      busy = true;
      var args = arguments;
      var ctx = this;
      var release = function () {
        busy = false;
      };
      var result;
      try {
        result = fn.apply(ctx, args);
      } catch (e) {
        release();
        throw e;
      }
      if (result && typeof result.then === 'function') {
        return result.then(function (v) {
          release();
          return v;
        }, function (e) {
          release();
          throw e;
        });
      }
      release();
      return result;
    };
  }

  function submitButtons(form) {
    if (!form) return [];
    var out = [];
    var inner = form.querySelectorAll('button[type="submit"], button:not([type])');
    for (var i = 0; i < inner.length; i++) out.push(inner[i]);
    if (form.id) {
      var external = document.querySelectorAll('button[type="submit"][form="' + form.id + '"]');
      for (var j = 0; j < external.length; j++) out.push(external[j]);
    }
    return out;
  }

  function submitButton(form) {
    var list = submitButtons(form);
    return list.length ? list[0] : null;
  }

  function bindSubmit(form, handler, holdMs) {
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (form.getAttribute('data-busy') === '1') return;
      form.setAttribute('data-busy', '1');
      var btns = submitButtons(form);
      var prev = btns.map(function (b) {
        return b.disabled;
      });
      btns.forEach(function (b) {
        b.disabled = true;
      });
      var startedAt = Date.now();
      var hold = holdMs === undefined ? 450 : holdMs;
      var released = false;
      function release() {
        if (released) return;
        released = true;
        var wait = Math.max(0, hold - (Date.now() - startedAt));
        setTimeout(function () {
          form.setAttribute('data-busy', '0');
          btns.forEach(function (b, i) {
            b.disabled = prev[i];
          });
        }, wait);
      }
      var result;
      try {
        result = handler(e, form);
      } catch (err) {
        release();
        console.error(err);
        return;
      }
      if (result && typeof result.then === 'function') {
        result.then(release, function (err) {
          release();
          console.error(err);
        });
      } else {
        release();
      }
    });
  }

  function tabs(items, activeId) {
    var html = '<div class="tabs" role="tablist">';
    items.forEach(function (it) {
      html += '<button type="button" class="tab' + (it.id === activeId ? ' active' : '') + '" data-tab="' + it.id + '" role="tab">' + Utils.esc(it.label) + '</button>';
    });
    html += '</div>';
    return html;
  }

  return {
    icon: icon,
    badge: badge,
    statusBadge: statusBadge,
    avatar: avatar,
    statCard: statCard,
    emptyState: emptyState,
    table: table,
    field: field,
    modalShell: modalShell,
    openModal: openModal,
    closeModal: closeModal,
    confirmDialog: confirmDialog,
    selectAthlete: selectAthlete,
    athleteById: athleteById,
    userName: userName,
    toast: toast,
    pageHeader: pageHeader,
    backButton: backButton,
    goBack: goBack,
    preventDouble: preventDouble,
    submitButton: submitButton,
    submitButtons: submitButtons,
    bindSubmit: bindSubmit,
    tabs: tabs
  };
})();
