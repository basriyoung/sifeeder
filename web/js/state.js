// Keadaan bersama antar modul tampilan.

const listeners = new Set();

export const state = {
  username: '',
  entities: [],
  entityByKey: new Map(),
  status: null,
  currentJobId: null,
  currentPlanId: null,
  planPage: 0,
  planPageSize: 50,
  dryRunDone: false,
};

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notify(event, payload) {
  for (const fn of listeners) {
    try {
      fn(event, payload);
    } catch (error) {
      console.error('Listener gagal:', error);
    }
  }
}

export function setEntities(list) {
  state.entities = list;
  state.entityByKey = new Map(list.map((entity) => [entity.key, entity]));
  notify('entities', list);
}

export function getEntity(key) {
  return state.entityByKey.get(key) || null;
}

export function setPlan(planId) {
  state.currentPlanId = planId;
  state.planPage = 0;
  state.dryRunDone = false;
  notify('plan', planId);
}
