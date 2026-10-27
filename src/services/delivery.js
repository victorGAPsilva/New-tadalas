import { fail } from './product-validation.js';

export const deliveryRateCentsPerKm = 200;
export function distanceFee(distanceMeters) {
  if (
    !Number.isSafeInteger(distanceMeters) ||
    distanceMeters < 0 ||
    distanceMeters > 50000000
  )
    throw fail('Distância de entrega inválida.', 503);
  return Math.round((distanceMeters * deliveryRateCentsPerKm) / 1000);
}

export function createDeliveryService({
  apiKey = process.env.GOOGLE_ROUTES_API_KEY,
  fetchImpl = globalThis.fetch,
} = {}) {
  let active = 0;
  return {
    configured: Boolean(apiKey),
    async distance(origin, address) {
      if (!apiKey)
        throw fail(
          'Cálculo de entrega indisponível. Consulte o atendimento ou escolha retirada.',
          409,
        );
      if (!origin) throw fail('Endereço da loja ainda não configurado.', 409);
      if (active >= 4)
        throw fail(
          'Cálculo de entrega ocupado. Tente novamente em instantes.',
          429,
        );
      active++;
      try {
        let data;
        try {
          const response = await fetchImpl(
            'https://routes.googleapis.com/directions/v2:computeRoutes',
            {
              method: 'POST',
              redirect: 'error',
              signal: AbortSignal.timeout(7000),
              headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'routes.distanceMeters',
              },
              body: JSON.stringify({
                origin: { address: origin },
                destination: {
                  address: `${address.street}, ${address.number}, ${address.neighborhood}, ${address.city}, CEP ${address.postalCode}, Brasil`,
                },
                travelMode: 'DRIVE',
                routingPreference: 'TRAFFIC_UNAWARE',
                computeAlternativeRoutes: false,
                languageCode: 'pt-BR',
                units: 'METRIC',
              }),
            },
          );
          if (!response.ok) throw new Error('Route provider unavailable');
          data = await response.json();
        } catch {
          throw fail(
            'Não foi possível calcular a entrega agora. Tente novamente ou escolha retirada.',
            503,
          );
        }
        if (!Array.isArray(data?.routes))
          throw fail('Resposta de rota inválida. Tente novamente.', 503);
        if (!data.routes.length)
          throw fail(
            'Não encontramos uma rota de entrega para esse endereço. Confira os dados.',
            422,
          );
        const distance = data.routes[0].distanceMeters;
        distanceFee(distance);
        return distance;
      } finally {
        active--;
      }
    },
  };
}
