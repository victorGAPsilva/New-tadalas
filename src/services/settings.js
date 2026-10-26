import { randomUUID } from 'node:crypto';
import { fail } from './product-validation.js';
export function storeStatus(settings, now = new Date()) {
  if (settings.storeMode === 'manual')
    return {
      open: settings.manualOpen,
      message: settings.manualOpen ? 'Recebendo pedidos' : 'Pedidos pausados',
    };
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: settings.timezone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(
      parts.weekday,
    ),
    minute = Number(parts.hour) * 60 + Number(parts.minute);
  const minutes = (time) =>
    Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  const open = settings.schedule.some((slot) => {
    const start = minutes(slot.open),
      end = minutes(slot.close);
    return start < end
      ? slot.day === day && minute >= start && minute < end
      : (slot.day === day && minute >= start) ||
          ((slot.day + 1) % 7 === day && minute < end);
  });
  return { open, message: open ? 'Aberto para pedidos' : 'Fechado no momento' };
}
export function settingsService(
  store,
  { whatsappNumber, now = Date.now } = {},
) {
  return {
    get: () => store.get('settings', 'public'),
    public() {
      const value = store.get('settings', 'public');
      return {
        ...value,
        whatsappNumber: whatsappNumber || value.whatsappNumber,
        status: storeStatus(value, new Date(now())),
      };
    },
    update(input) {
      const previous = store.get('settings', 'public');
      if (!input || input.version !== previous.version)
        throw fail('As configurações mudaram. Atualize a página.', 409);
      const text = (key, max) => {
        const v = input[key];
        if (
          v !== null &&
          v !== undefined &&
          (typeof v !== 'string' || v.length > max)
        )
          throw fail(`Confira ${key}.`);
        return v?.trim() || null;
      };
      const brand = text('brand', 100);
      if (!brand) throw fail('Informe o nome da marca.');
      const number = text('whatsappNumber', 15);
      if (!/^\d{10,15}$/.test(number))
        throw fail('Informe o WhatsApp com código do país e apenas números.');
      const instagramUrl = text('instagramUrl', 200);
      if (
        instagramUrl &&
        !/^https:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9_.]+\/?$/.test(
          instagramUrl,
        )
      )
        throw fail('Informe o perfil oficial do Instagram.');
      for (const key of ['manualOpen', 'pickupEnabled', 'deliveryEnabled'])
        if (typeof input[key] !== 'boolean')
          throw fail('Configuração de atendimento inválida.');
      if (!input.pickupEnabled && !input.deliveryEnabled)
        throw fail('Ative retirada ou entrega.');
      if (!['manual', 'schedule'].includes(input.storeMode))
        throw fail('Modo de funcionamento inválido.');
      const timezone = text('timezone', 80) || 'America/Sao_Paulo';
      try {
        new Intl.DateTimeFormat('pt-BR', { timeZone: timezone }).format();
      } catch {
        throw fail('Fuso horário inválido.');
      }
      const schedule = input.schedule || [];
      if (!Array.isArray(schedule) || schedule.length > 21)
        throw fail('Informe até 21 intervalos de funcionamento.');
      for (const s of schedule)
        if (
          !s ||
          !Number.isInteger(s.day) ||
          s.day < 0 ||
          s.day > 6 ||
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.open) ||
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.close) ||
          s.open === s.close
        )
          throw fail('Confira os dias e horários de funcionamento.');
      if (input.storeMode === 'schedule' && !schedule.length)
        throw fail('Cadastre ao menos um horário.');
      const zones = input.deliveryZones || [];
      if (!Array.isArray(zones) || zones.length > 100)
        throw fail('Cadastre até 100 regiões.');
      const seen = new Set();
      const deliveryZones = zones.map((z) => {
        if (
          !z ||
          typeof z.name !== 'string' ||
          !z.name.trim() ||
          z.name.length > 100 ||
          !Number.isInteger(z.feeCents) ||
          z.feeCents < 0 ||
          z.feeCents > 100000
        )
          throw fail('Confira as regiões e taxas de entrega.');
        const id = z.id || randomUUID();
        if (
          typeof id !== 'string' ||
          !/^[a-zA-Z0-9-]{1,80}$/.test(id) ||
          seen.has(id)
        )
          throw fail('Região de entrega inválida.');
        seen.add(id);
        return { id, name: z.name.trim(), feeCents: z.feeCents };
      });
      if (input.deliveryEnabled && !deliveryZones.length)
        throw fail('Cadastre ao menos uma região com sua taxa.');
      const paymentMethods = input.paymentMethods;
      if (
        !Array.isArray(paymentMethods) ||
        !paymentMethods.length ||
        paymentMethods.some((m) => !['pix', 'cash', 'card'].includes(m))
      )
        throw fail('Selecione as formas de pagamento aceitas.');
      const estimatedMinutes =
        input.estimatedMinutes === null || input.estimatedMinutes === ''
          ? null
          : Number(input.estimatedMinutes);
      if (
        estimatedMinutes !== null &&
        (!Number.isInteger(estimatedMinutes) ||
          estimatedMinutes < 1 ||
          estimatedMinutes > 240)
      )
        throw fail(
          'Informe uma estimativa entre 1 e 240 minutos, ou deixe vazia.',
        );
      const asset = (key) => {
        const path = text(key, 240);
        if (
          path &&
          !/^\/assets\/(?:[\w-]+\/)*[\w.-]+\.(png|jpe?g|webp|avif)$/i.test(path)
        )
          throw fail('Imagem local inválida.');
        return path;
      };
      return store.put('settings', 'public', {
        brand,
        whatsappNumber: number,
        instagramUrl,
        address: text('address', 300),
        openingHours: text('openingHours', 300),
        logoUrl: asset('logoUrl'),
        heroImageUrl: previous.heroImageUrl,
        version: previous.version + 1,
        storeMode: input.storeMode,
        manualOpen: input.manualOpen,
        timezone,
        schedule,
        pickupEnabled: input.pickupEnabled,
        deliveryEnabled: input.deliveryEnabled,
        deliveryZones,
        paymentMethods: [...new Set(paymentMethods)],
        estimatedMinutes,
      });
    },
  };
}
