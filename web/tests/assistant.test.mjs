import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractLine, localReply } from '../src/lib/assistantLocal.js';

test('reads line data out of a Romanian sentence', () => {
  assert.deepEqual(extractLine('Avem găleți de 10 kg, cam 400 pe oră, 44 pe palet, 3 schimburi, fără mâner'), {
    weight: 10,
    rate: 6.7,
    perPallet: 44,
    shifts: 3,
    handle: 'nu',
  });
  assert.deepEqual(extractLine('13 kg la 7,4 găleți/min, cu mâner'), { weight: 13, rate: 7.4, handle: 'da' });
  assert.deepEqual(extractLine('lucrăm un singur schimb'), { shifts: 1 });
  assert.deepEqual(extractLine('Ce înseamnă rezultatul?'), {});
});

test('answers from facts and proposes values', () => {
  assert.ok(localReply('găleți de 5 kg, 8 pe minut').proposal.rate === 8);
  assert.match(localReply('Cât costă o celulă?').text, /130\.000 EUR/);
  assert.match(localReply('Se poate lega la SAP?').text, /PROFINET/);
  assert.match(localReply('Ce rămâne manual?').text, /separatoarelor/);
  assert.match(localReply('blabla').text, /descrii linia/);
});
