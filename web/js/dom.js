// Pembantu DOM.
//
// Semua teks yang berasal dari server dimasukkan lewat textContent, tidak
// pernah lewat innerHTML. Dengan begitu nama mahasiswa atau pesan galat dari
// Feeder tidak bisa dieksekusi sebagai HTML di halaman ini.

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export function el(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  const { text, className, attrs, dataset, on } = options;
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value === false || value === null || value === undefined) continue;
      node.setAttribute(key, value === true ? '' : String(value));
    }
  }
  if (dataset) {
    for (const [key, value] of Object.entries(dataset)) node.dataset[key] = String(value);
  }
  if (on) {
    for (const [event, handler] of Object.entries(on)) node.addEventListener(event, handler);
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function replaceChildren(node, children) {
  clear(node);
  for (const child of [].concat(children)) {
    if (child) node.append(child);
  }
  return node;
}

export function emptyRow(colspan, message) {
  return el('tr', {}, [el('td', { className: 'empty', text: message, attrs: { colspan } })]);
}

export function setOptions(select, items, { value, label, placeholder }) {
  const previous = select.value;
  clear(select);
  if (placeholder !== undefined) {
    select.append(el('option', { text: placeholder, attrs: { value: '' } }));
  }
  for (const item of items) {
    select.append(
      el('option', {
        text: typeof label === 'function' ? label(item) : item[label],
        attrs: { value: typeof value === 'function' ? value(item) : item[value] },
      }),
    );
  }
  if (previous && Array.from(select.options).some((o) => o.value === previous)) {
    select.value = previous;
  }
}

// ---------------------------------------------------------------------
// Pemberitahuan singkat
// ---------------------------------------------------------------------
const TOAST_MS = 6000;

export function toast(message, kind = 'info') {
  const stack = $('#toastStack');
  if (!stack) return;
  const node = el('div', { className: `toast toast-${kind}`, text: message });
  stack.append(node);
  setTimeout(() => node.remove(), TOAST_MS);
}

// ---------------------------------------------------------------------
// Pemformatan
// ---------------------------------------------------------------------
export function formatNumber(value) {
  return Number(value || 0).toLocaleString('id-ID');
}

export function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return '-';
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatDateTime(iso) {
  if (!iso) return '-';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  return date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

export function truncate(text, max = 120) {
  const value = String(text ?? '');
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
