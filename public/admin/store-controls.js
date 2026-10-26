import { el } from '/js/components/dom.js';

export function initStoreControls({ api, notice }) {
  const $ = (selector) => document.querySelector(selector);
  const days = [
    'Domingo',
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado',
  ];
  let current,
    formVersion,
    busy = false;
  const error = (text) => {
    $('#admin-store-error').textContent = text;
  };
  function renderStatus(value) {
    current = value;
    const status = $('#admin-store-status');
    status.textContent = value.status.open
      ? 'Loja aberta · recebendo pedidos'
      : 'Loja fechada · novos pedidos pausados';
    status.classList.toggle('is-closed', !value.status.open);
    $('#admin-store-mode').textContent =
      value.storeMode === 'schedule'
        ? 'Automático · seguindo os horários cadastrados'
        : 'Manual · abertura e fechamento pelo botão';
    $('#admin-store-toggle').textContent = value.status.open
      ? 'Fechar loja agora'
      : 'Abrir loja agora';
    $('#admin-store-toggle').disabled = busy;
    $('#admin-store-timezone').textContent =
      `Fuso horário: ${value.timezone}. Ajuste o fuso em Configurações, se necessário.`;
  }
  function addSlot(slot = { day: new Date().getDay(), open: '', close: '' }) {
    const row = el('div', undefined, 'store-schedule-row');
    function field(title, node) {
      const label = el('label', title);
      label.append(node);
      row.append(label);
    }
    const day = el('select');
    days.forEach((name, index) => {
      const option = el('option', name);
      option.value = index;
      day.append(option);
    });
    day.value = slot.day;
    field('Dia da semana', day);
    const open = el('input'),
      close = el('input');
    open.type = close.type = 'time';
    open.required = close.required = true;
    open.value = slot.open;
    close.value = slot.close;
    field('Abertura', open);
    field('Fechamento', close);
    const remove = el('button', 'Remover intervalo', 'secondary');
    remove.type = 'button';
    remove.addEventListener('click', () => {
      row.remove();
      $('#admin-store-add-slot').focus();
    });
    row.append(remove);
    row.read = () => ({
      day: Number(day.value),
      open: open.value,
      close: close.value,
    });
    $('#admin-store-schedule').append(row);
  }
  async function load(resetForm = false) {
    try {
      const value = await api('/settings/operation');
      // Ignore a poll started before a successful write.
      if (current && value.version < current.version) return;
      renderStatus(value);
      if (resetForm) {
        formVersion = value.version;
        $('#admin-store-schedule').replaceChildren();
        value.schedule.forEach(addSlot);
        if (!value.schedule.length) addSlot();
      }
      $('#admin-store-save-hours').disabled = busy || formVersion === undefined;
    } catch (e) {
      error(e.message);
    }
  }
  function lock(value) {
    busy = value;
    $('#admin-store-toggle').disabled = value || !current;
    for (const control of $('#admin-store-hours-form').elements)
      control.disabled = value || !current;
  }
  async function update(body, schedule = false) {
    if (busy || !current) return;
    error('');
    $('#admin-store-hours-feedback').textContent = '';
    const version = schedule ? formVersion : current.version;
    lock(true);
    try {
      const result = await api('/settings/operation', {
        method: 'PATCH',
        body: { ...body, version },
      });
      if (schedule || formVersion === version) formVersion = result.version;
      renderStatus(result);
      const message = schedule
        ? 'Horários salvos. A loja agora abre e fecha automaticamente.'
        : result.status.open
          ? 'Loja aberta no modo manual.'
          : 'Loja fechada no modo manual.';
      notice(message);
      $('#admin-store-hours-feedback').textContent = message;
    } catch (e) {
      error(
        `${e.message} Se os horários mudaram em outra tela, use “Recarregar horários salvos” antes de editar novamente.`,
      );
      await load();
    } finally {
      lock(false);
    }
  }
  $('#admin-store-toggle').addEventListener('click', () => {
    if (current)
      update({ storeMode: 'manual', manualOpen: !current.status.open });
  });
  $('#admin-store-add-slot').addEventListener('click', () => {
    if ($('#admin-store-schedule').children.length >= 21)
      return error('Cadastre até 21 intervalos.');
    addSlot();
  });
  $('#admin-store-reload').addEventListener('click', () => {
    error('');
    load(true);
  });
  $('#admin-store-hours-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const schedule = [...$('#admin-store-schedule').children].map((row) =>
      row.read(),
    );
    if (!schedule.length)
      return error('Adicione ao menos um dia e seus horários.');
    update({ storeMode: 'schedule', schedule }, true);
  });
  load(true);
  const timer = setInterval(() => {
    if (!document.hidden && !busy) load();
  }, 30000);
  window.addEventListener('pagehide', () => clearInterval(timer));
}
