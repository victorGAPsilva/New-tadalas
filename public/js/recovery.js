const $ = (s) => document.querySelector(s);
const token = new URLSearchParams(location.search).get('token');
const verify = location.pathname.startsWith('/verificar-email');
async function request(path, body) {
  const response = await fetch(`/api/customer${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error?.message || 'Não foi possível concluir.');
  return result.data;
}
$('#recovery-title').textContent = verify
  ? 'CONFIRME SEU E-MAIL.'
  : token
    ? 'NOVA SENHA.'
    : 'RECUPERE SEU ACESSO.';
$('#recovery-email-field').hidden = Boolean(token) || verify;
$('#recovery-passwords').hidden = !token || verify;
$('#recovery-email').required = !token && !verify;
for (const id of ['recovery-password', 'recovery-confirm'])
  $(`#${id}`).required = Boolean(token) && !verify;
$('#recovery-submit').textContent = verify
  ? 'Confirmar e-mail'
  : token
    ? 'Salvar nova senha'
    : 'Receber instruções';
if (verify && !token) {
  $('#recovery-submit').disabled = true;
  $('#recovery-message').textContent = 'Abra o link recebido por e-mail.';
}
if (!token && !verify)
  fetch('/api/customer/capabilities')
    .then((r) => r.json())
    .then((result) => {
      if (!result.data.emailEnabled) {
        $('#recovery-submit').disabled = true;
        $('#recovery-message').textContent =
          'O envio de e-mails ainda não está configurado. Entre em contato com o atendimento.';
      }
    })
    .catch(() => {
      $('#recovery-message').textContent =
        'Não foi possível consultar o serviço. Tente novamente.';
    });
$('#recovery-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = $('#recovery-submit');
  button.disabled = true;
  try {
    if (
      token &&
      !verify &&
      $('#recovery-password').value !== $('#recovery-confirm').value
    )
      throw new Error('As senhas não coincidem.');
    const result = await request(
      verify ? '/verify-email' : token ? '/reset-password' : '/forgot-password',
      verify
        ? { token }
        : token
          ? { token, password: $('#recovery-password').value }
          : { email: $('#recovery-email').value },
    );
    $('#recovery-message').textContent = result.message;
    if (token) {
      history.replaceState(null, '', location.pathname);
      $('#recovery-form').hidden = true;
    }
  } catch (error) {
    $('#recovery-message').textContent = error.message;
  } finally {
    button.disabled = false;
  }
});
