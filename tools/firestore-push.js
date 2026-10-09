#!/usr/bin/env node
/*
 * Mengunggah dataset contoh PB Trisula ke Cloud Firestore.
 *
 * Pemakaian:
 *   node tools/firestore-push.js <projectId> [file-dataset.json]
 *
 * Autentikasi memakai sesi `firebase login` yang sudah ada di komputer ini
 * (token dibaca dari configstore firebase-tools, otomatis diperbarui bila
 * kedaluwarsa). Tidak perlu service account key.
 *
 * Dokumen ditulis memakai `id` yang sama dengan dataset sehingga tautan
 * antar koleksi (user_id, input_oleh, id_atlet) tetap utuh. Proses ini aman
 * diulang (upsert).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const CONFIGSTORE = path.join(process.env.USERPROFILE || process.env.HOME, '.config', 'configstore', 'firebase-tools.json');
const FT_API = path.join(process.env.APPDATA || process.env.HOME, 'npm', 'node_modules', 'firebase-tools', 'lib', 'api.js');

const KOLEKSI = [
  'users', 'athletes', 'log_parameters', 'test_types', 'attendance',
  'logbook_entries', 'physical_tests', 'matches', 'monitoring', 'landing'
];

function fail(pesan) {
  console.error('ERROR: ' + pesan);
  process.exit(1);
}

function bacaConfigstore() {
  if (!fs.existsSync(CONFIGSTORE)) fail('configstore firebase-tools tidak ditemukan: ' + CONFIGSTORE);
  return JSON.parse(fs.readFileSync(CONFIGSTORE, 'utf8'));
}

function kredensialKlien() {
  if (!fs.existsSync(FT_API)) fail('firebase-tools tidak ditemukan di ' + FT_API);
  const api = require(FT_API);
  return { clientId: api.clientId(), clientSecret: api.clientSecret() };
}

async function tokenAkses(cfg) {
  const t = cfg.tokens || {};
  const kini = Date.now();
  const kedaluwarsa = Number(t.expires_at || 0);
  if (t.access_token && kedaluwarsa - kini > 60 * 1000) return t.access_token;

  if (!t.refresh_token) fail('refresh_token tidak ada. Jalankan `firebase login` ulang.');
  const { clientId, clientSecret } = kredensialKlien();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: t.refresh_token,
    grant_type: 'refresh_token'
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });
  const json = await res.json();
  if (!res.ok) fail('gagal memperbarui token: ' + JSON.stringify(json));

  t.access_token = json.access_token;
  t.expires_at = Date.now() + Number(json.expires_in || 3600) * 1000;
  t.token_type = json.token_type || 'Bearer';
  cfg.tokens = t;
  fs.writeFileSync(CONFIGSTORE, JSON.stringify(cfg, null, 2));
  return t.access_token;
}

function keField(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(keField) } };
  const t = typeof v;
  if (t === 'string') return { stringValue: v };
  if (t === 'boolean') return { booleanValue: v };
  if (t === 'number') {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  const fields = {};
  Object.keys(v).forEach(k => { fields[k] = keField(v[k]); });
  return { mapValue: { fields } };
}

function keFields(obj) {
  const fields = {};
  Object.keys(obj || {}).forEach(k => { fields[k] = keField(obj[k]); });
  return fields;
}

function potong(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

async function tulisBatch(token, projectId, writes) {
  const url = 'https://firestore.googleapis.com/v1/projects/' + projectId +
    '/databases/(default)/documents:batchWrite';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ writes })
  });
  const json = await res.json();
  if (!res.ok) {
    fail('batchWrite gagal (' + res.status + '): ' + JSON.stringify(json));
  }
  return json;
}

async function utama() {
  const projectId = process.argv[2];
  if (!projectId) fail('pemakaian: node tools/firestore-push.js <projectId> [file-dataset.json]');
  const fileData = process.argv[3] || path.join(__dirname, 'firestore-data.json');
  if (!fs.existsSync(fileData)) fail('file dataset tidak ditemukan: ' + fileData);

  const data = JSON.parse(fs.readFileSync(fileData, 'utf8'));
  const cfg = bacaConfigstore();
  const token = await tokenAkses(cfg);
  console.log('Project : ' + projectId);
  console.log('Dataset : ' + fileData);

  let total = 0;
  for (const nama of KOLEKSI) {
    const isi = data[nama];
    if (isi === undefined || isi === null) continue;

    let dokumen = [];
    if (Array.isArray(isi)) {
      dokumen = isi.filter(Boolean).map(d => ({
        nama: d.id,
        fields: keFields(d)
      }));
    } else if (typeof isi === 'object') {
      dokumen = [{ nama: 'config', fields: keFields(isi) }];
    }

    const writes = dokumen.map(d => ({
      update: {
        name: 'projects/' + projectId + '/databases/(default)/documents/' + nama + '/' + encodeURIComponent(d.nama),
        fields: d.fields
      }
    }));

    let terkirim = 0;
    for (const bagian of potong(writes, 400)) {
      await tulisBatch(token, projectId, bagian);
      terkirim += bagian.length;
    }
    total += terkirim;
    console.log('  ' + nama.padEnd(18) + ' : ' + String(terkirim).padStart(4) + ' dokumen');
  }

  console.log('Selesai. Total ' + total + ' dokumen terkirim ke ' + projectId + '/(default).');
  console.log('Lihat di: https://console.firebase.google.com/project/' + projectId + '/firestore');
}

utama().catch(e => {
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
