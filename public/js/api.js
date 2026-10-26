export async function request(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const body = await response.json();
  if (!response.ok)
    throw Object.assign(
      new Error(body.error?.message || 'Não foi possível carregar os dados.'),
      { status: response.status },
    );
  return body.data;
}
