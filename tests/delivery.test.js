import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDeliveryService,
  distanceFee,
} from '../src/services/delivery.js';

test('frete é proporcional a R$ 2 por km com arredondamento apenas em centavos', () => {
  assert.equal(distanceFee(3500), 700);
  assert.equal(distanceFee(1234), 247);
  assert.equal(distanceFee(1001), 200);
  assert.equal(distanceFee(0), 0);
  for (const invalid of [-1, NaN, 1.5, '1000', undefined, 50000001])
    assert.throws(() => distanceFee(invalid));
});

test('adaptador de rotas mantém chave no backend, fixa origem e trata indisponibilidade sem frete zero', async () => {
  const destination = {
    street: 'Rua de teste',
    number: '10',
    neighborhood: 'Bairro fixture',
    city: 'São Paulo',
    postalCode: '01001-000',
  };
  const service = createDeliveryService({
    apiKey: 'fixture-not-a-real-key',
    fetchImpl: async (url, options) => {
      assert.equal(
        url,
        'https://routes.googleapis.com/directions/v2:computeRoutes',
      );
      assert.equal(options.redirect, 'error');
      assert.equal(
        options.headers['X-Goog-FieldMask'],
        'routes.distanceMeters',
      );
      const request = JSON.parse(options.body);
      assert.equal(request.origin.address, 'Origem confirmada pelo servidor');
      assert.equal(request.travelMode, 'DRIVE');
      assert.match(request.destination.address, /Rua de teste, 10/);
      return {
        ok: true,
        json: async () => ({ routes: [{ distanceMeters: 3500 }] }),
      };
    },
  });
  assert.equal(
    await service.distance('Origem confirmada pelo servidor', destination),
    3500,
  );
  await assert.rejects(
    createDeliveryService({ apiKey: '' }).distance('Origin', destination),
    { status: 409 },
  );
  await assert.rejects(
    createDeliveryService({
      apiKey: 'fixture',
      fetchImpl: async () => {
        throw new Error('private upstream detail');
      },
    }).distance('Origin', destination),
    (error) => error.status === 503 && !error.message.includes('private'),
  );
  await assert.rejects(
    createDeliveryService({
      apiKey: 'fixture',
      fetchImpl: async () => ({ ok: true, json: async () => ({ routes: [] }) }),
    }).distance('Origin', destination),
    { status: 422 },
  );
  await assert.rejects(
    createDeliveryService({
      apiKey: 'fixture',
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ routes: [{ distanceMeters: -1 }] }),
      }),
    }).distance('Origin', destination),
    { status: 503 },
  );
});
