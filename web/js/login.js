import { api, ApiError, setCsrfToken } from './api.js';
import { $ } from './dom.js';

const form = $('#loginForm');
const errorBox = $('#loginError');
const button = $('#loginButton');

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorBox.hidden = true;
  button.disabled = true;
  button.textContent = 'Memeriksa...';

  try {
    const result = await api.post('/api/auth/login', {
      username: $('#username').value,
      password: $('#password').value,
    });
    setCsrfToken(result.csrf_token);
    window.location.href = '/';
  } catch (error) {
    showError(error instanceof ApiError ? error.message : 'Tidak dapat menghubungi server.');
    $('#password').value = '';
    $('#password').focus();
  } finally {
    button.disabled = false;
    button.textContent = 'Masuk';
  }
});
