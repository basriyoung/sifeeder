// Pembungkus pemanggilan API.
//
// Token CSRF disimpan di memori modul (bukan localStorage) dan dilampirkan
// pada setiap permintaan yang mengubah keadaan. Sesi sendiri dibawa oleh
// cookie HttpOnly yang tidak bisa dibaca JavaScript.

let csrfToken = null;

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

export function setCsrfToken(token) {
  csrfToken = token || null;
}

export function getCsrfToken() {
  return csrfToken;
}

async function parseBody(response) {
  const type = response.headers.get('content-type') || '';
  if (type.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
  return await response.text();
}

async function request(method, path, { body, formData, signal } = {}) {
  const headers = { Accept: 'application/json' };
  const options = { method, headers, credentials: 'same-origin', signal };

  if (method !== 'GET' && method !== 'HEAD') {
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
    if (formData) {
      options.body = formData; // Content-Type diisi peramban beserta boundary.
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
  }

  const response = await fetch(path, options);

  if (response.status === 401) {
    setCsrfToken(null);
    window.location.href = '/login';
    throw new ApiError('Sesi berakhir.', 401, null);
  }

  const payload = await parseBody(response);

  if (!response.ok) {
    const detail =
      (payload && typeof payload === 'object' && (payload.detail || payload.message)) ||
      (typeof payload === 'string' && payload) ||
      `Permintaan gagal (HTTP ${response.status}).`;
    throw new ApiError(
      Array.isArray(detail) ? detail.map((d) => d.msg || String(d)).join('; ') : String(detail),
      response.status,
      payload,
    );
  }
  return payload;
}

export const api = {
  get: (path, options) => request('GET', path, options),
  post: (path, body, options) => request('POST', path, { ...options, body }),
  postForm: (path, formData, options) => request('POST', path, { ...options, formData }),
  del: (path, options) => request('DELETE', path, options),

  async session() {
    const data = await fetch('/api/session', { credentials: 'same-origin' }).then((r) => r.json());
    if (data.authenticated) setCsrfToken(data.csrf_token);
    return data;
  },

  download(path, filename) {
    const link = document.createElement('a');
    link.href = path;
    link.download = filename || '';
    link.rel = 'noopener';
    document.body.append(link);
    link.click();
    link.remove();
  },
};
