// Tab "Data Lokal": impor CSV yang akan dibandingkan dengan data Feeder.

import { api } from './api.js';
import { $, el, replaceChildren, toast } from './dom.js';
import { markStep } from './dashboard.js';
import { getEntity, notify } from './state.js';

function selectedEntity() {
  return getEntity($('#importEntity').value);
}

function renderColumns() {
  const entity = selectedEntity();
  const list = $('#entityColumns');
  if (!entity) {
    replaceChildren(list, []);
    return;
  }
  replaceChildren(list, [
    el('dt', { text: 'Kolom kunci (wajib)' }),
    el('dd', { text: entity.key_fields.join(', ') }),
    el('dt', { text: 'Kolom yang boleh ditulis' }),
    el('dd', { text: entity.writable_fields.join(', ') || '(tidak ada)' }),
    el('dt', { text: 'Kolom yang dibandingkan' }),
    el('dd', { text: entity.compare_fields.join(', ') }),
  ]);
}

function renderImportResult(result) {
  const box = $('#importResult');
  const children = [
    el('p', { className: 'notice notice-ok', text: result.message }),
  ];
  if (result.problem_count) {
    children.push(
      el('p', {
        className: 'notice notice-warn',
        text: `${result.problem_count} catatan saat membaca berkas (ditampilkan maksimal 50):`,
      }),
    );
    children.push(
      el(
        'ul',
        { className: 'bullets mt-xs' },
        result.problems.map((problem) => el('li', { text: problem })),
      ),
    );
  }
  replaceChildren(box, children);
}

async function importFile() {
  const entity = selectedEntity();
  const input = $('#importFile');
  if (!entity) return;
  if (!input.files || !input.files[0]) {
    toast('Pilih berkas CSV lebih dulu.', 'warn');
    return;
  }

  const button = $('#btnImport');
  button.disabled = true;
  try {
    const formData = new FormData();
    formData.append('entity', entity.key);
    formData.append('file', input.files[0]);
    const result = await api.postForm('/api/local/import', formData);
    renderImportResult(result);
    toast(result.message, 'ok');
    markStep('import', true);
    notify('local:imported', result);
  } catch (error) {
    replaceChildren($('#importResult'), [el('p', { className: 'notice notice-danger', text: error.message })]);
    toast(error.message, 'error');
  } finally {
    button.disabled = false;
  }
}

async function clearLocal() {
  const entity = selectedEntity();
  if (!entity) return;
  try {
    const result = await api.del(`/api/local/${entity.key}`);
    toast(`${result.removed} baris data lokal dihapus.`, 'ok');
    replaceChildren($('#importResult'), []);
    markStep('import', false);
    notify('local:imported', result);
  } catch (error) {
    toast(error.message, 'error');
  }
}

export function init() {
  $('#btnImport').addEventListener('click', importFile);
  $('#btnClearLocal').addEventListener('click', clearLocal);
  $('#importEntity').addEventListener('change', renderColumns);
  $('#btnTemplate').addEventListener('click', () => {
    const entity = selectedEntity();
    if (entity) api.download(`/api/local/template/${entity.key}`, `template_${entity.key}.csv`);
  });
  renderColumns();
}

export { renderColumns };
