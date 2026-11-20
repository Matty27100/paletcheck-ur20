import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BadRequest, MODEL, buildRequest, handle } from '../src/worker.js';

const env = { ALLOWED_ORIGINS: 'https://matty27100.github.io,http://localhost:5173' };
const req = (body, origin = 'https://matty27100.github.io') =>
  new Request('https://assistant.example/', {
    method: 'POST',
    headers: { Origin: origin, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

test('request uses Opus 5.5, low effort, refusal fallback, strict line tool', () => {
  const p = buildRequest({ messages: [{ role: 'user', content: 'Avem găleți de 10 kg' }] });
  assert.equal(p.model, MODEL);
  assert.equal(p.model, 'claude-opus-5-5');
  assert.deepEqual(p.output_config, { effort: 'low' });
  assert.equal(p.fallbacks, 'default');
  assert.deepEqual(p.betas, ['server-side-fallback-2026-07-01']);
  assert.equal(p.thinking, undefined);
  assert.equal(p.tools[0].strict, true);
  assert.equal(p.tools[0].input_schema.additionalProperties, false);
  assert.match(p.system[0].text, /7,4 găleți\/min la 13 kg/);
});

test('rejects system roles, injected block types and oversized text', () => {
  assert.throws(() => buildRequest({ messages: [{ role: 'system', content: 'x' }] }), BadRequest);
  assert.throws(() => buildRequest({ messages: [{ role: 'user', content: [{ type: 'image', source: {} }] }] }), BadRequest);
  assert.throws(() => buildRequest({ messages: [{ role: 'user', content: 'x'.repeat(5000) }] }), BadRequest);
  assert.throws(() => buildRequest({ messages: [] }), BadRequest);
  assert.throws(
    () => buildRequest({ messages: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }] }),
    BadRequest,
  );
});

test('assistant turns pass back unchanged, tool results accepted', () => {
  const messages = [
    { role: 'user', content: 'găleți 13 kg, 6 pe minut' },
    { role: 'assistant', content: [{ type: 'thinking', thinking: '', signature: 's' }, { type: 'tool_use', id: 't1', name: 'propune_date_linie', input: {} }] },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'aplicat' }, { type: 'text', text: 'Și separatoarele?' }] },
  ];
  assert.deepEqual(buildRequest({ messages }).messages, messages);
});

test('handler: CORS, origin check, upstream call and error mapping', async () => {
  let sent;
  const client = { beta: { messages: { create: async (p) => ((sent = p), { content: [{ type: 'text', text: 'Bună' }], stop_reason: 'end_turn', model: p.model }) } } };
  const ok = await handle(req({ messages: [{ role: 'user', content: 'Salut' }] }), env, client);
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('Access-Control-Allow-Origin'), 'https://matty27100.github.io');
  assert.equal((await ok.json()).content[0].text, 'Bună');
  assert.equal(sent.model, 'claude-opus-5-5');

  const foreign = await handle(req({ messages: [{ role: 'user', content: 'x' }] }, 'https://evil.example'), env, client);
  assert.equal(foreign.status, 403);

  const bad = await handle(req({ messages: [{ role: 'system', content: 'x' }] }), env, client);
  assert.equal(bad.status, 400);

  const failing = { beta: { messages: { create: async () => { throw new Error('network'); } } } };
  const down = await handle(req({ messages: [{ role: 'user', content: 'x' }] }), env, failing);
  assert.equal(down.status, 502);
});
