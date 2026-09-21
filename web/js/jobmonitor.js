// Pemantau pekerjaan latar.
//
// Kemajuan yang tampil adalah angka nyata yang dilaporkan server, bukan
// animasi. Bila server tidak menjawab, nilainya berhenti alih-alih terus naik.

import { api } from './api.js';
import { $, el, formatDuration, formatNumber, toast } from './dom.js';
import { notify, state } from './state.js';

const POLL_MS = 900;
const MAX_TERMINAL_LINES = 400;

let timer = null;
let lastSeq = 0;

const nodes = {};

function cache() {
  if (nodes.bar) return nodes;
  Object.assign(nodes, {
    bar: $('#jobBar'),
    percent: $('#jobPercent'),
    counter: $('#jobCounter'),
    subtitle: $('#jobSubtitle'),
    processed: $('#statProcessed'),
    success: $('#statSuccess'),
    failed: $('#statFailed'),
    uncertain: $('#statUncertain'),
    rate: $('#statRate'),
    eta: $('#statEta'),
    terminal: $('#terminal'),
    cancel: $('#btnCancel'),
    uncertainNotice: $('#uncertainNotice'),
  });
  return nodes;
}

export function appendLog(level, message) {
  const n = cache();
  if (!n.terminal) return;
  const time = new Date().toLocaleTimeString('id-ID');
  const line = el('div', {
    className: `log-${level === 'success' ? 'success' : level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'info'}`,
    text: `[${time}] [${level.toUpperCase()}] ${message}`,
  });
  n.terminal.append(line);
  while (n.terminal.childElementCount > MAX_TERMINAL_LINES) {
    n.terminal.firstElementChild.remove();
  }
  n.terminal.scrollTop = n.terminal.scrollHeight;
}

export function clearTerminal() {
  const n = cache();
  if (n.terminal) n.terminal.replaceChildren();
}

function render(job) {
  const n = cache();
  const percent = Math.min(100, Math.max(0, job.percent || 0));
  n.bar.style.width = `${percent}%`;
  n.bar.className = `progress-bar${job.status === 'error' || job.failed ? ' danger' : job.status === 'done' ? ' ok' : ''}`;
  n.percent.textContent = `${percent}%`;
  n.counter.textContent = `${formatNumber(job.processed)} / ${formatNumber(job.total)} record`;

  const statusText = {
    queued: 'Menunggu giliran',
    running: 'Sedang berjalan',
    done: 'Selesai',
    error: 'Berhenti karena kesalahan',
    cancelled: 'Dibatalkan',
  }[job.status] || job.status;
  n.subtitle.textContent = `${job.label || job.kind} - ${statusText}${job.message ? ` - ${job.message}` : ''}`;

  n.processed.textContent = formatNumber(job.processed);
  n.success.textContent = formatNumber(job.succeeded);
  n.failed.textContent = formatNumber(job.failed);
  n.uncertain.textContent = formatNumber(job.uncertain);
  n.rate.textContent = `${job.rate_per_second || 0}/s`;
  n.eta.textContent = job.eta_seconds === null || job.eta_seconds === undefined
    ? '-'
    : formatDuration(job.eta_seconds);

  if (job.uncertain > 0) {
    n.uncertainNotice.hidden = false;
    n.uncertainNotice.textContent =
      `${job.uncertain} record berstatus tidak pasti: permintaan terkirim tetapi jawabannya ` +
      'tidak diterima. Periksa record tersebut langsung di Neo Feeder sebelum mengulang pengiriman.';
  } else {
    n.uncertainNotice.hidden = true;
  }

  const running = job.status === 'queued' || job.status === 'running';
  n.cancel.disabled = !running;
}

async function poll() {
  if (!state.currentJobId) return;
  let payload;
  try {
    payload = await api.get(`/api/jobs/${state.currentJobId}?after_seq=${lastSeq}`);
  } catch (error) {
    appendLog('error', `Gagal membaca status proses: ${error.message}`);
    stop();
    return;
  }

  for (const entry of payload.logs || []) {
    appendLog(entry.level, entry.message);
  }
  lastSeq = payload.last_seq || lastSeq;
  render(payload.job);

  if (['done', 'error', 'cancelled'].includes(payload.job.status)) {
    stop();
    const kind = payload.job.status === 'done' ? 'ok' : payload.job.status === 'cancelled' ? 'warn' : 'error';
    toast(payload.job.message || `Proses ${payload.job.status}.`, kind);
    notify('job:finished', payload.job);
  }
}

export function start(job) {
  stop();
  state.currentJobId = job.id;
  lastSeq = 0;
  render(job);
  notify('job:started', job);
  timer = setInterval(poll, POLL_MS);
  poll();
}

export function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export async function cancelCurrent() {
  if (!state.currentJobId) return;
  try {
    await api.post(`/api/jobs/${state.currentJobId}/cancel`, {});
    toast('Permintaan pembatalan dikirim.', 'warn');
  } catch (error) {
    toast(error.message, 'error');
  }
}

export async function resumeActiveJob() {
  try {
    const status = await api.get('/api/status');
    if (status.active_job) {
      appendLog('info', 'Menyambung ke proses yang sedang berjalan di server.');
      start(status.active_job);
    }
  } catch {
    /* diabaikan: status akan dimuat ulang oleh pemanggil */
  }
}
