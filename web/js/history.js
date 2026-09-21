// Tab "Riwayat & Audit".

import { api } from './api.js';
import { $, el, emptyRow, formatDateTime, replaceChildren, toast, truncate } from './dom.js';
import { setPlan, subscribe } from './state.js';
import { refresh as refreshPlan } from './preview.js';

const PLAN_STATUS = {
  draft: ['Draf', 'badge'],
  applying: ['Sedang dikirim', 'badge-warn'],
  applied: ['Sudah dikirim', 'badge-ok'],
  cancelled: ['Dibatalkan', 'badge-danger'],
};

function summaryText(summary) {
  const parts = [];
  if (summary.conflict) parts.push(`${summary.conflict} berbeda`);
  if (summary.new) parts.push(`${summary.new} baru`);
  if (summary.match) parts.push(`${summary.match} identik`);
  return parts.join(', ') || '-';
}

function resultText(summary) {
  const result = summary.result;
  if (!result) return summary.dry_run_at ? 'simulasi saja' : '-';
  return Object.entries(result)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ') || '-';
}

export async function loadPlans() {
  const body = $('#planList');
  try {
    const data = await api.get('/api/plan?limit=25');
    if (!data.plans.length) {
      replaceChildren(body, emptyRow(6, 'Belum ada rencana.'));
      return;
    }
    replaceChildren(
      body,
      data.plans.map((plan) => {
        const [label, cls] = PLAN_STATUS[plan.status] || [plan.status, 'badge'];
        return el('tr', {}, [
          el('td', { text: formatDateTime(plan.created_at) }),
          el('td', { text: plan.entity }),
          el('td', {}, [el('span', { className: `badge ${cls}`, text: label })]),
          el('td', { text: summaryText(plan.summary || {}) }),
          el('td', { className: 'hint', text: resultText(plan.summary || {}) }),
          el('td', {}, [
            el('button', {
              className: 'btn-sm btn-ghost',
              text: 'Buka',
              on: {
                click: () => {
                  setPlan(plan.id);
                  refreshPlan().catch((error) => toast(error.message, 'error'));
                  document.getElementById('tab-preview').click();
                },
              },
            }),
          ]),
        ]);
      }),
    );
  } catch (error) {
    replaceChildren(body, emptyRow(6, error.message));
  }
}

export async function loadAudit() {
  const body = $('#auditList');
  try {
    const data = await api.get('/api/audit?limit=120');
    if (!data.entries.length) {
      replaceChildren(body, emptyRow(5, 'Belum ada catatan.'));
      return;
    }
    replaceChildren(
      body,
      data.entries.map((entry) =>
        el('tr', {}, [
          el('td', { text: formatDateTime(entry.ts) }),
          el('td', { text: entry.actor || '-' }),
          el('td', { className: 'mono', text: entry.action }),
          el('td', { text: entry.entity || '-' }),
          el('td', { className: 'hint', text: truncate(JSON.stringify(entry.detail), 200) }),
        ]),
      ),
    );
  } catch (error) {
    replaceChildren(body, emptyRow(5, error.message));
  }
}

export function reload() {
  return Promise.all([loadPlans(), loadAudit()]);
}

export function init() {
  $('#btnReloadPlans').addEventListener('click', reload);
  $('#btnExportAudit').addEventListener('click', () =>
    api.download('/api/audit/export.csv', 'audit_neofeeder.csv'),
  );
  subscribe((event) => {
    if (event === 'job:finished' || event === 'plan:refresh') reload();
  });
}
