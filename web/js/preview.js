// Tab "Pratinjau & Kirim".
//
// Urutannya dikunci: bandingkan -> simulasi -> konfirmasi -> kirim. Tombol
// kirim baru aktif setelah simulasi selesai untuk rencana yang sama.

import { api } from './api.js';
import { $, el, emptyRow, formatNumber, replaceChildren, toast, truncate } from './dom.js';
import { buildFilters, markStep } from './dashboard.js';
import * as jobs from './jobmonitor.js';
import { getEntity, notify, setPlan, state, subscribe } from './state.js';

const KEY_SEPARATOR = '␟';

const STATUS_LABEL = {
  match: ['Identik', 'badge'],
  conflict: ['Berbeda', 'badge-warn'],
  new: ['Baru', 'badge-info'],
  remote_only: ['Hanya di Feeder', 'badge'],
};

const RESULT_LABEL = {
  success: ['Berhasil', 'badge-ok'],
  rejected: ['Ditolak', 'badge-danger'],
  failed: ['Gagal', 'badge-danger'],
  uncertain: ['Tidak pasti', 'badge-warn'],
  skipped: ['Dilewati', 'badge'],
};

let currentItems = [];
let totalItems = 0;

function prettyKey(recordKey) {
  return recordKey.split(KEY_SEPARATOR).join(' / ');
}

function renderSummary(summary, results) {
  replaceChildren($('#planSummary'), [
    el('div', { className: 'stat' }, [
      el('span', { text: 'Total dibandingkan' }),
      el('strong', { text: formatNumber(summary.total || 0) }),
    ]),
    el('div', { className: 'stat ok' }, [
      el('span', { text: 'Identik' }),
      el('strong', { text: formatNumber(summary.match || 0) }),
    ]),
    el('div', { className: 'stat warn' }, [
      el('span', { text: 'Berbeda (akan diubah)' }),
      el('strong', { text: formatNumber(summary.conflict || 0) }),
    ]),
    el('div', { className: 'stat info' }, [
      el('span', { text: 'Baru (akan ditambah)' }),
      el('strong', { text: formatNumber(summary.new || 0) }),
    ]),
  ]);

  const parts = [];
  if (summary.dry_run_at) parts.push(`Simulasi terakhir: ${summary.dry_run_at}`);
  if (results && Object.keys(results).length) {
    parts.push(
      'Hasil: ' +
        Object.entries(results)
          .map(([key, value]) => `${key} ${value}`)
          .join(', '),
    );
  }
  $('#planMeta').textContent = parts.join(' | ');
}

function changeCell(item) {
  if (!item.changes.length) return el('span', { className: 'hint', text: '-' });
  const lines = item.changes.slice(0, 6).map((change) =>
    el('span', { className: 'change-line mono' }, [
      el('em', { text: `${change.field}: ` }),
      el('span', { className: 'change-old', text: truncate(change.remote || '(kosong)', 40) }),
      document.createTextNode(' → '),
      el('span', { className: 'change-new', text: truncate(change.local || '(kosong)', 40) }),
    ]),
  );
  if (item.changes.length > 6) {
    lines.push(el('span', { className: 'hint', text: `dan ${item.changes.length - 6} field lainnya` }));
  }
  return el('div', {}, lines);
}

function renderRows(items) {
  const body = $('#diffBody');
  const onlyChanges = $('#onlyChanges').checked;
  const visible = onlyChanges ? items.filter((item) => item.diff_status !== 'match') : items;

  if (!visible.length) {
    replaceChildren(body, emptyRow(6, 'Tidak ada baris untuk ditampilkan.'));
    return;
  }

  replaceChildren(
    body,
    visible.map((item) => {
      const [statusText, statusClass] = STATUS_LABEL[item.diff_status] || [item.diff_status, 'badge'];
      const checkbox = el('input', {
        attrs: {
          type: 'checkbox',
          'aria-label': `Pilih ${prettyKey(item.record_key)}`,
          disabled: item.action === 'skip',
        },
        dataset: { key: item.record_key },
        on: { change: (event) => toggleSelection([item.record_key], event.target.checked) },
      });
      checkbox.checked = Boolean(item.selected);

      const resultCell = item.result_status
        ? (() => {
            const [label, cls] = RESULT_LABEL[item.result_status] || [item.result_status, 'badge'];
            const badge = el('span', { className: `badge ${cls}`, text: label });
            return item.result_message
              ? el('div', {}, [badge, el('div', { className: 'hint', text: truncate(item.result_message, 160) })])
              : badge;
          })()
        : el('span', { className: 'hint', text: '-' });

      return el('tr', {}, [
        el('td', {}, [checkbox]),
        el('td', { className: 'mono', text: prettyKey(item.record_key) }),
        el('td', {}, [el('span', { className: `badge ${statusClass}`, text: statusText })]),
        el('td', { text: item.action === 'insert' ? 'Tambah' : item.action === 'update' ? 'Ubah' : 'Lewati' }),
        el('td', {}, [changeCell(item)]),
        el('td', {}, [resultCell]),
      ]);
    }),
  );
}

async function toggleSelection(recordKeys, selected) {
  if (!state.currentPlanId) return;
  try {
    const result = await api.post(`/api/plan/${state.currentPlanId}/selection`, {
      record_keys: recordKeys,
      selected,
    });
    updateActionButtons(result.selected_items);
  } catch (error) {
    toast(error.message, 'error');
    await loadPlan();
  }
}

function updateActionButtons(selectedCount) {
  const hasPlan = Boolean(state.currentPlanId);
  const hasSelection = hasPlan && selectedCount > 0;
  $('#btnDryRun').disabled = !hasSelection;
  $('#btnApply').disabled = !hasSelection || !state.dryRunDone;
  $('#btnExportPlan').disabled = !hasPlan;

  const badge = $('#dryRunBadge');
  if (!hasPlan) {
    badge.className = 'badge';
    badge.textContent = 'Belum ada rencana';
  } else if (state.dryRunDone) {
    badge.className = 'badge badge-ok';
    badge.textContent = `Simulasi selesai - ${formatNumber(selectedCount)} record siap dikirim`;
  } else {
    badge.className = 'badge badge-warn';
    badge.textContent = 'Simulasi belum dijalankan';
  }
}

export async function loadPlan() {
  if (!state.currentPlanId) return;
  const offset = state.planPage * state.planPageSize;
  const data = await api.get(
    `/api/plan/${state.currentPlanId}?limit=${state.planPageSize}&offset=${offset}`,
  );
  currentItems = data.items;
  totalItems = data.total_items;
  state.dryRunDone = Boolean(data.plan.summary && data.plan.summary.dry_run_at);

  renderSummary(data.plan.summary || {}, data.results);
  renderRows(currentItems);
  updateActionButtons(data.selected_items);

  const from = totalItems ? offset + 1 : 0;
  const to = Math.min(offset + state.planPageSize, totalItems);
  $('#pageInfo').textContent = `Menampilkan ${from}-${to} dari ${formatNumber(totalItems)} baris`;
  $('#btnPrevPage').disabled = state.planPage === 0;
  $('#btnNextPage').disabled = to >= totalItems;

  if (data.plan.status === 'applied') {
    markStep('apply', true);
  }
}

async function buildPlan() {
  const entityKey = $('#pullEntity').value;
  const entity = getEntity(entityKey);
  if (!entity) return;
  if (!entity.can_insert && !entity.can_update) {
    toast(`Entitas "${entity.label}" tidak mendukung pengiriman data.`, 'warn');
    return;
  }

  const button = $('#btnBuildPlan');
  button.disabled = true;
  try {
    const result = await api.post('/api/plan', {
      entity: entityKey,
      filters: buildFilters(),
      include_matches: $('#includeMatches').checked,
    });
    setPlan(result.plan_id);
    await loadPlan();
    markStep('plan', true);
    toast(
      `Rencana siap: ${result.summary.conflict} berbeda, ${result.summary.new} baru, ${result.summary.match} identik.`,
      'ok',
    );
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    button.disabled = false;
  }
}

async function runDryRun() {
  if (!state.currentPlanId) return;
  try {
    const result = await api.post(`/api/plan/${state.currentPlanId}/apply`, { dry_run: true });
    jobs.start(result.job);
    toast('Simulasi berjalan. Tidak ada data yang dikirim ke PDDIKTI.', 'info');
  } catch (error) {
    toast(error.message, 'error');
  }
}

function openConfirmDialog(selectedCount, entityLabel) {
  const dialog = $('#confirmDialog');
  const input = $('#confirmInput');
  const okButton = $('#confirmOk');

  $('#confirmText').textContent =
    `${formatNumber(selectedCount)} record entitas "${entityLabel}" akan ditulis ke PDDIKTI ` +
    'lewat Neo Feeder. Tindakan ini tidak dapat dibatalkan dari aplikasi ini.';
  input.value = '';
  okButton.disabled = true;
  dialog.showModal();
  input.focus();

  return new Promise((resolve) => {
    const onInput = () => {
      okButton.disabled = input.value.trim().toUpperCase() !== 'KIRIM';
    };
    const finish = (value) => {
      input.removeEventListener('input', onInput);
      okButton.removeEventListener('click', onOk);
      $('#confirmCancel').removeEventListener('click', onCancel);
      dialog.removeEventListener('close', onCancel);
      if (dialog.open) dialog.close();
      resolve(value);
    };
    const onOk = () => finish(input.value.trim().toUpperCase());
    const onCancel = () => finish(null);

    input.addEventListener('input', onInput);
    okButton.addEventListener('click', onOk);
    $('#confirmCancel').addEventListener('click', onCancel);
    dialog.addEventListener('close', onCancel);
  });
}

async function applyPlan() {
  if (!state.currentPlanId || !state.dryRunDone) return;
  const data = await api.get(`/api/plan/${state.currentPlanId}?limit=1`);
  const confirmText = await openConfirmDialog(data.selected_items, data.entity.label);
  if (!confirmText) return;

  try {
    const result = await api.post(`/api/plan/${state.currentPlanId}/apply`, {
      dry_run: false,
      confirm: true,
      confirm_text: confirmText,
    });
    jobs.start(result.job);
    toast('Pengiriman dimulai.', 'info');
  } catch (error) {
    toast(error.message, 'error');
  }
}

export function init() {
  $('#btnBuildPlan').addEventListener('click', buildPlan);
  $('#btnDryRun').addEventListener('click', runDryRun);
  $('#btnApply').addEventListener('click', applyPlan);
  $('#onlyChanges').addEventListener('change', () => renderRows(currentItems));
  $('#btnExportPlan').addEventListener('click', () => {
    if (state.currentPlanId) {
      api.download(`/api/plan/${state.currentPlanId}/export.csv`, `rencana_${state.currentPlanId.slice(0, 8)}.csv`);
    }
  });
  $('#checkAll').addEventListener('change', (event) => {
    const keys = currentItems.filter((item) => item.action !== 'skip').map((item) => item.record_key);
    if (keys.length) toggleSelection(keys, event.target.checked).then(loadPlan);
  });
  $('#btnPrevPage').addEventListener('click', () => {
    if (state.planPage > 0) {
      state.planPage -= 1;
      loadPlan();
    }
  });
  $('#btnNextPage').addEventListener('click', () => {
    state.planPage += 1;
    loadPlan();
  });

  subscribe((event, payload) => {
    if (event !== 'job:finished') return;
    if (payload.kind !== 'apply') return;
    const wasDryRun = (payload.result || {}).dry_run;
    if (payload.status === 'done' && wasDryRun) markStep('dryrun', true);
    if (payload.status === 'done' && !wasDryRun) markStep('apply', true);
    loadPlan().catch(() => {});
    notify('plan:refresh', payload);
  });

  updateActionButtons(0);
}

export { loadPlan as refresh };
