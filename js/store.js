var Store = (function () {
  var listeners = {};
  var ready = false;

  function key(collection) {
    return CONFIG.PREFIX + collection;
  }

  function read(collection) {
    try {
      var raw = localStorage.getItem(key(collection));
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function write(collection, items) {
    try {
      localStorage.setItem(key(collection), JSON.stringify(items));
    } catch (e) {
      Utils.toast('Penyimpanan browser penuh. Hapus sebagian data atau perkecil ukuran file.', 'danger');
      throw e;
    }
    notify(collection);
    if (typeof App !== 'undefined' && App && typeof App.setDirty === 'function') {
      App.setDirty(false);
    }
  }

  function notify(collection) {
    var subs = listeners[collection] || [];
    for (var i = 0; i < subs.length; i++) {
      try {
        subs[i](collection);
      } catch (e) {
        console.error(e);
      }
    }
  }

  window.addEventListener('storage', function (event) {
    if (!event.key || event.key.indexOf(CONFIG.PREFIX) !== 0) return;
    var collection = event.key.slice(CONFIG.PREFIX.length);
    notify(collection);
    notify('*');
  });

  function all(collection) {
    return read(collection);
  }

  function where(collection, predicate) {
    return read(collection).filter(predicate);
  }

  function find(collection, id) {
    var items = read(collection);
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === id) return items[i];
    }
    return null;
  }

  function findOne(collection, predicate) {
    var items = read(collection);
    for (var i = 0; i < items.length; i++) {
      if (predicate(items[i])) return items[i];
    }
    return null;
  }

  function insert(collection, item) {
    var items = read(collection);
    if (!item.id) item.id = Utils.uid(collection);
    if (!item.dibuat_pada) item.dibuat_pada = Utils.nowISO();
    items.push(item);
    write(collection, items);
    return item;
  }

  function update(collection, id, patch) {
    var items = read(collection);
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === id) {
        for (var k in patch) {
          if (Object.prototype.hasOwnProperty.call(patch, k)) items[i][k] = patch[k];
        }
        items[i].diperbarui_pada = Utils.nowISO();
        write(collection, items);
        return items[i];
      }
    }
    return null;
  }

  function upsert(collection, item, matcher) {
    var items = read(collection);
    for (var i = 0; i < items.length; i++) {
      if (matcher(items[i], item)) {
        for (var k in item) {
          if (Object.prototype.hasOwnProperty.call(item, k)) items[i][k] = item[k];
        }
        items[i].diperbarui_pada = Utils.nowISO();
        write(collection, items);
        return items[i];
      }
    }
    return insert(collection, item);
  }

  function remove(collection, id) {
    var items = read(collection);
    var next = items.filter(function (it) {
      return it.id !== id;
    });
    write(collection, next);
    return next.length !== items.length;
  }

  function removeWhere(collection, predicate) {
    var items = read(collection);
    var next = items.filter(function (it) {
      return !predicate(it);
    });
    write(collection, next);
    return items.length - next.length;
  }

  function count(collection, predicate) {
    return predicate ? where(collection, predicate).length : read(collection).length;
  }

  function subscribe(collection, handler) {
    if (!listeners[collection]) listeners[collection] = [];
    listeners[collection].push(handler);
    return function () {
      listeners[collection] = (listeners[collection] || []).filter(function (h) {
        return h !== handler;
      });
    };
  }

  function nextSeq(name) {
    var raw = localStorage.getItem(key('seq'));
    var seq = {};
    try {
      seq = raw ? JSON.parse(raw) : {};
    } catch (e) {
      seq = {};
    }
    seq[name] = (seq[name] || 0) + 1;
    localStorage.setItem(key('seq'), JSON.stringify(seq));
    return seq[name];
  }

  function peekSeq(name) {
    var raw = localStorage.getItem(key('seq'));
    try {
      var seq = raw ? JSON.parse(raw) : {};
      return seq[name] || 0;
    } catch (e) {
      return 0;
    }
  }

  function resetSeq(name, value) {
    var raw = localStorage.getItem(key('seq'));
    var seq = {};
    try {
      seq = raw ? JSON.parse(raw) : {};
    } catch (e) {
      seq = {};
    }
    seq[name] = value;
    localStorage.setItem(key('seq'), JSON.stringify(seq));
  }

  function nextAthleteId() {
    var n = nextSeq('atlet');
    return 'TRS' + String(n).padStart(3, '0');
  }

  function reassignAthleteIds() {
    var athletes = Utils.sortBy(all('athletes'), 'id_atlet', 'asc');
    athletes.forEach(function (a, index) {
      var newId = 'TRS' + String(index + 1).padStart(3, '0');
      if (a.id_atlet !== newId) {
        update('athletes', a.id, { id_atlet: newId });
        var users = where('users', function (u) {
          return u.id_atlet === a.id_atlet;
        });
        users.forEach(function (u) {
          update('users', u.id, { id_atlet: newId });
        });
      }
    });
    resetSeq('atlet', athletes.length);
  }

  var seedPromise = null;

  function init() {
    var users = read('users');
    if (!users.length && CONFIG.DEMO_SEED) {
      if (seedPromise) return seedPromise;
      seedPromise = Auth.seed().then(function () {
        ready = true;
        seedPromise = null;
      }, function (err) {
        seedPromise = null;
        throw err;
      });
      return seedPromise;
    }
    if (!ready) {
      if (!read('log_parameters').length) {
        write('log_parameters', CONFIG.LOG_PARAMETERS.map(function (p) {
          return Object.assign({ id: p.id }, p);
        }));
      }
      if (!read('test_types').length) {
        write('test_types', CONFIG.TEST_TYPES.map(function (t) {
          return Object.assign({ id: t.id }, t);
        }));
      }
      ready = true;
    }
    return Promise.resolve();
  }

  return {
    all: all,
    where: where,
    find: find,
    findOne: findOne,
    insert: insert,
    update: update,
    upsert: upsert,
    remove: remove,
    removeWhere: removeWhere,
    count: count,
    subscribe: subscribe,
    nextSeq: nextSeq,
    peekSeq: peekSeq,
    resetSeq: resetSeq,
    nextAthleteId: nextAthleteId,
    reassignAthleteIds: reassignAthleteIds,
    init: init
  };
})();
