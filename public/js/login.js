import { initProfile } from './profile.js';
const $ = (selector) => document.querySelector(selector);
let registering = false,
  csrfToken;
const onProfilePage = location.pathname.startsWith('/conta');
async function api(
  path,
  body,
  method = body ? 'POST' : 'GET',
  scope = 'customer',
) {
  const response = await fetch(`/api/${scope}${path}`, {
    credentials: 'same-origin',
    ...(body
      ? {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
          },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const result = await response.json();
  if (!response.ok)
    throw Object.assign(
      new Error(
        result.error?.message || 'Não foi possível concluir. Tente novamente.',
      ),
      { status: response.status },
    );
  return result.data;
}
function setMode(create) {
  registering = create;
  $('#account-error').textContent = '';
  $('#name-field').hidden = !create;
  $('#confirm-field').hidden = !create;
  $('#password-hint').hidden = !create;
  $('#customer-name').required = create;
  $('#customer-email').type = create ? 'email' : 'text';
  $('#identifier-label').textContent = create ? 'E-mail' : 'E-mail ou usuário';
  $('#customer-confirm').required = create;
  $('#customer-password').minLength = create ? 12 : 1;
  $('#customer-password').autocomplete = create
    ? 'new-password'
    : 'current-password';
  $('#show-login').setAttribute('aria-pressed', String(!create));
  $('#show-register').setAttribute('aria-pressed', String(create));
  $('#customer-submit').textContent = create
    ? 'Criar minha conta ↗'
    : 'Entrar ↗';
}
function activate(session) {
  if (session.role === 'admin') return window.location.replace('/admin/');
  if (!onProfilePage) return window.location.replace('/conta/');
  csrfToken = session.csrfToken;
  $('#auth-view').hidden = true;
  $('#profile-view').hidden = false;
  $('#profile-name').textContent = session.displayName;
  $('#profile-full-name').textContent = session.displayName;
  $('#profile-email').textContent = session.username;
  initProfile(session, api);
}
$('#show-login').addEventListener('click', () => setMode(false));
$('#show-register').addEventListener('click', () => setMode(true));
$('#customer-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  $('#account-error').textContent = '';
  const create = registering,
    email = $('#customer-email').value.trim(),
    password = $('#customer-password').value;
  if (create && password !== $('#customer-confirm').value) {
    $('#account-error').textContent = 'As senhas não coincidem.';
    return;
  }
  const buttons = [
    $('#customer-submit'),
    $('#show-login'),
    $('#show-register'),
  ];
  buttons.forEach((button) => (button.disabled = true));
  let created = false;
  try {
    if (create) {
      await api('/register', {
        name: $('#customer-name').value,
        email,
        password,
      });
      created = true;
    }
    const session = await api(
      '/login',
      { identifier: email, password },
      'POST',
      'auth',
    );
    $('#customer-password').value = '';
    $('#customer-confirm').value = '';
    activate(session);
  } catch (error) {
    if (created) setMode(false);
    $('#account-error').textContent = created
      ? 'Conta criada. Entre com seu e-mail e senha para continuar.'
      : error.message;
  } finally {
    buttons.forEach((button) => (button.disabled = false));
  }
});
$('#customer-logout').addEventListener('click', async () => {
  $('#customer-logout').disabled = true;
  try {
    await api('/logout', {});
    window.location.replace('/login/');
  } catch (error) {
    if (error.status === 401) {
      window.location.replace('/login/');
      return;
    }
    $('#profile-error').textContent = error.message;
    $('#customer-logout').disabled = false;
  }
});
if (onProfilePage) $('#auth-view').hidden = true;
if (new URLSearchParams(location.search).get('expired') === '1')
  $('#account-error').textContent = 'Sua sessão expirou. Entre novamente.';
async function init() {
  try {
    const session = await api('/session', undefined, 'GET', 'auth');
    if (session) activate(session);
    else if (onProfilePage) window.location.replace('/login/');
  } catch {
    $('#auth-view').hidden = false;
    $('#account-error').textContent =
      'Não foi possível conectar. Recarregue a página para tentar novamente.';
  }
}
init();
