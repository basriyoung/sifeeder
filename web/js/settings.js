// Tab "Konfigurasi": menampilkan konfigurasi aktif apa adanya.
//
// Halaman ini sengaja tidak menyediakan kotak isian kredensial. Semua nilai
// sensitif hanya ada di berkas .env pada server.

import { api } from './api.js';
import { $, el, replaceChildren, toast } from './dom.js';
import { state } from './state.js';

function row(term, value) {
  return [el('dt', { text: term }), el('dd', { text: String(value) })];
}

export function render(status) {
  const list = $('#settingsList');
  replaceChildren(list, [
    ...row('Versi aplikasi', `${status.app_name || 'SiFeeder'} v${status.version || '-'}`),
    ...row('Endpoint web service', status.endpoint),
    ...row('Sumber kredensial', status.credentials_source),
    ...row('Ukuran batch', status.batch_size),
    ...row('Jeda antar request', `${status.throttle_seconds} detik`),
    ...row('Maksimal percobaan ulang (baca)', status.max_retries),
    ...row('Verifikasi sertifikat TLS', status.verify_tls ? 'aktif' : 'nonaktif'),
    ...row('Penyamaran data pribadi di log', status.mask_personal_data ? 'aktif' : 'nonaktif'),
    ...row(
      'Sisa masa token',
      status.token_seconds_left === null || status.token_seconds_left === undefined
        ? 'belum ada token'
        : `${Math.floor(status.token_seconds_left / 60)} menit`,
    ),
  ]);

  const notices = [];
  if (status.allow_insecure_http) {
    notices.push(
      el('p', {
        className: 'notice notice-danger',
        text:
          'FEEDER_ALLOW_INSECURE_HTTP aktif. Kredensial dan token dikirim tanpa enkripsi. ' +
          'Gunakan HTTPS kecuali Feeder benar-benar berjalan di mesin yang sama.',
      }),
    );
  }
  if (!status.verify_tls) {
    notices.push(
      el('p', {
        className: 'notice notice-danger',
        text: 'Verifikasi sertifikat TLS dimatikan. Koneksi rawan disadap di tengah jalan.',
      }),
    );
  }
  if (!notices.length) {
    notices.push(el('p', { className: 'notice notice-ok', text: 'Tidak ada peringatan keamanan aktif.' }));
  }
  replaceChildren($('#securityNotices'), notices);
}

async function fetchDictionary() {
  const fungsi = $('#dictFungsi').value.trim();
  if (!fungsi) {
    toast('Isi nama fungsi WS lebih dulu.', 'warn');
    return;
  }
  const output = $('#dictResult');
  const button = $('#btnDict');
  button.disabled = true;
  try {
    const data = await api.get(`/api/feeder/dictionary?fungsi=${encodeURIComponent(fungsi)}`);
    output.textContent = JSON.stringify(data.schema, null, 2);
    output.hidden = false;
  } catch (error) {
    output.textContent = error.message;
    output.hidden = false;
    toast(error.message, 'error');
  } finally {
    button.disabled = false;
  }
}

export async function refresh() {
  const status = await api.get('/api/status');
  state.status = status;
  render(status);

  const versionTag = $('#appVersion');
  if (versionTag && status.version) versionTag.textContent = `v${status.version}`;

  $('#metaEndpoint').replaceChildren(
    el('strong', { text: 'Endpoint: ' }),
    document.createTextNode(status.endpoint),
  );
  const minutes =
    status.token_seconds_left === null || status.token_seconds_left === undefined
      ? null
      : Math.floor(status.token_seconds_left / 60);
  $('#metaToken').replaceChildren(
    el('strong', { text: 'Token: ' }),
    document.createTextNode(minutes === null ? 'belum diambil' : `aktif ${minutes} menit lagi`),
  );
  return status;
}

export function init() {
  $('#btnDict').addEventListener('click', fetchDictionary);
}
