// Titik masuk dashboard: memuat sesi, entitas, dan mengaitkan semua tab.

import { api } from './api.js';
import { $, $$, toast } from './dom.js';
import * as dashboard from './dashboard.js';
import * as history from './history.js';
import * as jobs from './jobmonitor.js';
import * as localdata from './localdata.js';
import * as preview from './preview.js';
import * as settings from './settings.js';
import { setEntities, state, subscribe } from './state.js';

function initTabs() {
  const tabs = $$('.tab');
  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      for (const other of tabs) {
        const active = other === tab;
        other.setAttribute('aria-selected', active ? 'true' : 'false');
        $(`#view-${other.dataset.view}`).hidden = !active;
      }
      if (tab.dataset.view === 'history') history.reload();
      if (tab.dataset.view === 'settings') settings.refresh().catch(() => {});
    });
  }
}

export async function refreshEntities() {
  const data = await api.get('/api/entities');
  setEntities(data.entities);
  localdata.renderColumns();
}

async function boot() {
  const session = await api.session();
  if (!session.authenticated) {
    window.location.href = '/login';
    return;
  }
  state.username = session.username;

  initTabs();
  dashboard.init();
  localdata.init();
  preview.init();
  history.init();
  settings.init();

  $('#logoutButton').addEventListener('click', async () => {
    try {
      await api.post('/api/auth/logout', {});
    } finally {
      window.location.href = '/login';
    }
  });

  subscribe((event) => {
    if (event === 'job:finished' || event === 'local:imported') {
      refreshEntities().catch(() => {});
    }
  });

  jobs.appendLog('info', `Masuk sebagai ${session.username}.`);

  try {
    await refreshEntities();
    await settings.refresh();
    await dashboard.loadReferences();
    await jobs.resumeActiveJob();
    await history.reload();
  } catch (error) {
    toast(error.message, 'error');
    jobs.appendLog('error', error.message);
  }
}

boot().catch((error) => {
  console.error(error);
  toast('Gagal memuat aplikasi. Muat ulang halaman.', 'error');
});
