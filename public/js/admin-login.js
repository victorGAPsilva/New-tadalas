const $ = (selector) => document.querySelector(selector);
const button = $('#login-button');
async function sessionRequest(path, body) {
  const response = await fetch(`/api/admin${path}`, {
    credentials: 'same-origin',
    ...(body
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      result.error?.message || 'Não foi possível entrar. Tente novamente.',
    );
  return result.data;
}
$('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  button.disabled = true;
  $('#login-error').textContent = '';
  try {
    await sessionRequest('/login', {
      username: $('#username').value.trim(),
      password: $('#password').value,
    });
    $('#password').value = '';
    window.location.replace('/admin/');
  } catch (error) {
    $('#login-error').textContent = error.message;
    button.disabled = false;
  }
});
if (new URLSearchParams(location.search).get('expired') === '1')
  $('#login-error').textContent = 'Sua sessão expirou. Entre novamente.';
async function init() {
  button.disabled = true;
  try {
    const status = await sessionRequest('/status');
    $('#setup-message').hidden = status.configured;
    if (!status.configured) return;
    button.disabled = false;
    try {
      await sessionRequest('/session');
      window.location.replace('/admin/');
    } catch {
      /* A new visitor can enter credentials. */
    }
  } catch {
    $('#login-error').textContent =
      'Não foi possível conectar. Recarregue a página para tentar novamente.';
  }
}
init();
