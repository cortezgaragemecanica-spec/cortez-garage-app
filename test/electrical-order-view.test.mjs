import test from 'node:test';
import assert from 'node:assert/strict';
import { electricalTags, electricalOrderView } from '../src/electrical-order-view.js';

test('identifica tags elétricas com acentos, plurais e limites de palavra', () => {
  assert.deepEqual(electricalTags('Lâmpadas H7, fusíveis e porta-escovas'), ['Lâmpada', 'H7', 'Fusível', 'Porta-escovas']);
  assert.deepEqual(electricalTags('Sensor de ABS, boia do tanque, relé'), ['Sensor de ABS', 'Boia do tanque', 'Relé']);
  assert.deepEqual(electricalTags('Filtro e pastilha H70'), []);
});

test('a visão elétrica exclui ordens sem itens e mostra só os valores elétricos da ordem mista', () => {
  const mechanical = { description: 'Pastilha', value: 100 };
  const electrical = { description: 'Lâmpada H4', value: 50, quantity: 2, sector: 'mecanica' };
  const order = { sourceSector: 'mecanica', total: 180, discount: 20, budget: { parts: [mechanical, electrical], services: [] } };
  const view = electricalOrderView(order);
  assert.equal(view.total, 90);
  assert.equal(view.discount, 10);
  assert.equal(view.partsValue, 100);
  assert.equal(view.budget.parts.length, 1);
  assert.deepEqual(view.budget.parts[0].tags, ['Lâmpada', 'H4']);
  assert.equal(order.budget.parts[1].sector, 'mecanica');
  assert.equal(electricalOrderView({ ...order, budget: { parts: [mechanical] } }), null);
  assert.equal(electricalOrderView({ ...order, budget: { parts: [{ ...electrical, refused: true }] } }), null);
});
