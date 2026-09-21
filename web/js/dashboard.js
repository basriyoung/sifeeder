// Tab "Tarik Data": pilih entitas dan filter, jalankan pengambilan data.

import { api } from './api.js';
import { $, el, emptyRow, formatDateTime, formatNumber, replaceChildren, setOptions, toast } from './dom.js';
import * as jobs from './jobmonitor.js';
import { getEntity, state, subscribe } from './state.js';

const flowState = { pull: false, import: false, plan: false, dryrun: false, apply: false };

export function markStep(step, done = true) {
  flowState[step] = done;
  const list = $('#flowSteps');
  if (!list) return;
  let activeAssigned = false;
  for (const item of list.children) {
    const key = item.dataset.step;
    item.classList.toggle('done', Boolean(flowState[key]));
    const isActive = !flowState[key] && !activeAssigned;
    item.classList.toggle('active', isActive);
    if (isActive) activeAssigned = true;
  }
}

function currentEntity() {
  return getEntity($('#pullEntity').value);
}

function updateFilterAvailability() {
  const entity = currentEntity();
  const semesterField = $('#pullSemester');
  const prodiField = $('#pullProdi');
  if (!entity) return;

  const supportsSemester = entity.filter_columns.includes('id_semester');
  const supportsProdi = entity.filter_columns.includes('id_prodi');
  semesterField.disabled = !supportsSemester;
  prodiField.disabled = !supportsProdi;
  if (!supportsSemester) semesterField.value = '';
  if (!supportsProdi) prodiField.value = '';

  const writes = [];
  if (entity.can_insert) writes.push(`tambah (${entity.insert_act})`);
  if (entity.can_update) writes.push(`ubah (${entity.update_act})`);
  $('#entityHint').textContent =
    `${entity.description} Kunci: ${entity.key_fields.join(' + ')}. ` +
    (writes.length ? `Operasi tulis: ${writes.join(', ')}.` : 'Entitas ini hanya bisa dibaca.') +
    (entity.schema_verified ? '' : ' Daftar field belum diverifikasi ke server Anda; periksa lewat GetDictionary di tab Konfigurasi.');
}

export function buildFilters() {
  const filters = {};
  const semester = $('#pullSemester');
  const prodi = $('#pullProdi');
  if (!semester.disabled && semester.value) filters.id_semester = semester.value;
  if (!prodi.disabled && prodi.value) filters.id_prodi = prodi.value;
  return filters;
}

export function renderEntitySummary() {
  const body = $('#entitySummary');
  if (!state.entities.length) {
    replaceChildren(body, emptyRow(5, 'Belum ada entitas.'));
    return;
  }
  replaceChildren(
    body,
    state.entities.map((entity) => {
      const operations = [];
      if (entity.can_insert) operations.push('tambah');
      if (entity.can_update) operations.push('ubah');
      return el('tr', {}, [
        el('td', { text: entity.label }),
        el('td', { className: 'mono', text: formatNumber(entity.remote_records) }),
        el('td', { className: 'mono', text: formatNumber(entity.local_records) }),
        el('td', { text: formatDateTime(entity.last_pull) }),
        el('td', {}, [
          el('span', {
            className: `badge ${operations.length ? 'badge-info' : ''}`,
            text: operations.length ? operations.join(' / ') : 'baca saja',
          }),
        ]),
      ]);
    }),
  );
}

async function loadReference(name, select, labelFn, valueKey) {
  try {
    const data = await api.get(`/api/reference/${name}`);
    setOptions(select, data.items, { value: valueKey, label: labelFn, placeholder: '(semua)' });
  } catch (error) {
    select.disabled = true;
    jobs.appendLog('warn', `Referensi ${name} tidak dapat dimuat: ${error.message}`);
  }
}

export async function loadReferences() {
  await Promise.all([
    loadReference(
      'semester',
      $('#pullSemester'),
      (item) => `${item.nama_semester || item.id_semester} (${item.id_semester})`,
      'id_semester',
    ),
    loadReference(
      'prodi',
      $('#pullProdi'),
      (item) =>
        `${item.nama_program_studi || item.id_prodi}${item.kode_program_studi ? ` (${item.kode_program_studi})` : ''}`,
      'id_prodi',
    ),
  ]);
}

async function startPull() {
  const entity = currentEntity();
  if (!entity) return;
  const button = $('#btnPull');
  button.disabled = true;
  try {
    const result = await api.post('/api/pull', { entity: entity.key, filters: buildFilters() });
    jobs.start(result.job);
  } catch (error) {
    toast(error.message, 'error');
    jobs.appendLog('error', error.message);
  } finally {
    button.disabled = false;
  }
}

function showConnectionProblem(message, hints = []) {
  const notice = $('#connNotice');
  const children = [el('strong', { text: 'Tidak terhubung ke Neo Feeder. ' }), document.createTextNode(message)];
  if (hints.length) {
    children.push(el('ul', { className: 'bullets mt-xs' }, hints.map((hint) => el('li', { text: hint }))));
  }
  notice.replaceChildren(...children);
  notice.hidden = false;
}

function setBadge(ok, text) {
  const badge = $('#connBadge');
  badge.className = `badge ${ok ? 'badge-ok' : 'badge-danger'}`;
  badge.replaceChildren(
    el('span', { className: `dot ${ok ? 'dot-ok' : 'dot-danger'}` }),
    document.createTextNode(` ${text}`),
  );
}

async function ping() {
  const badge = $('#connBadge');
  badge.className = 'badge';
  badge.replaceChildren(el('span', { className: 'dot' }), document.createTextNode(' Memeriksa...'));

  try {
    const result = await api.get('/api/feeder/ping');
    if (result.connected) {
      $('#connNotice').hidden = true;
      setBadge(
        true,
        `Terhubung${result.nama_perguruan_tinggi ? ` - ${result.nama_perguruan_tinggi}` : ''} (${result.latency_ms} ms)`,
      );
      jobs.appendLog('success', `Koneksi Feeder normal (${result.latency_ms} ms).`);
    } else {
      setBadge(false, 'Tidak terhubung');
      const message = result.message || 'Koneksi ke Feeder gagal.';
      showConnectionProblem(message, result.hints || []);
      jobs.appendLog('error', message);
    }
  } catch (error) {
    setBadge(false, 'Tidak terhubung');
    showConnectionProblem(error.message);
    jobs.appendLog('error', error.message);
  }
}

function exportTerminal() {
  const lines = Array.from($('#terminal').children).map((node) => node.textContent);
  if (!lines.length) {
    toast('Belum ada log untuk diunduh.', 'warn');
    return;
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = el('a', { attrs: { href: url, download: `log_neofeeder_${new Date().toISOString().slice(0, 10)}.txt` } });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function init() {
  $('#btnPull').addEventListener('click', startPull);
  $('#btnCancel').addEventListener('click', jobs.cancelCurrent);
  $('#btnPing').addEventListener('click', ping);
  $('#btnClearLog').addEventListener('click', jobs.clearTerminal);
  $('#btnExportLog').addEventListener('click', exportTerminal);
  $('#pullEntity').addEventListener('change', updateFilterAvailability);

  subscribe((event, payload) => {
    if (event === 'entities') {
      const selectable = state.entities.filter((entity) => !entity.reference_only);
      setOptions($('#pullEntity'), state.entities, { value: 'key', label: 'label' });
      setOptions($('#importEntity'), selectable.filter((e) => e.can_insert || e.can_update), {
        value: 'key',
        label: 'label',
      });
      updateFilterAvailability();
      renderEntitySummary();
    }
    if (event === 'job:finished' && payload.kind === 'pull' && payload.status === 'done') {
      markStep('pull', true);
    }
  });

  markStep('pull', false);
  ping();
}
