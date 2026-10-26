fetch('/api/customer/session', { credentials: 'same-origin' })
  .then((response) => (response.ok ? response.json() : null))
  .then((result) => {
    if (result?.data)
      document.querySelectorAll('[data-customer-link]').forEach((link) => {
        link.textContent = 'Minha conta';
        link.href = '/conta/';
      });
  })
  .catch(() => {});
