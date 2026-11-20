// Cloudflare Worker: keeps the Anthropic API key out of the public site and calls
// Claude for the in-app assistant. Deploy with `npx wrangler deploy` after
// `npx wrangler secret put ANTHROPIC_API_KEY`.
import Anthropic from '@anthropic-ai/sdk';
import { LINE_TOOL, SYSTEM_PROMPT } from './prompt.js';

export const MODEL = 'claude-opus-5-5';
const MAX_MESSAGES = 30;
const MAX_TEXT = 3000;
const ASSISTANT_BLOCKS = new Set(['text', 'tool_use', 'thinking', 'redacted_thinking', 'fallback']);
const USER_BLOCKS = new Set(['text', 'tool_result']);

export class BadRequest extends Error {}

function checkText(t) {
  if (typeof t !== 'string' || t.length > MAX_TEXT) throw new BadRequest('text too long');
}

// Validates the conversation the browser sends back. Assistant turns are passed back
// unchanged (thinking and fallback blocks included); only user/assistant roles are accepted.
export function buildRequest(body) {
  const messages = body?.messages;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
    throw new BadRequest('messages must be a non-empty array of at most ' + MAX_MESSAGES);
  }
  messages.forEach((m, i) => {
    if (m.role !== 'user' && m.role !== 'assistant') throw new BadRequest('only user and assistant roles');
    if (i === 0 && m.role !== 'user') throw new BadRequest('first message must be from the user');
    if (typeof m.content === 'string') return checkText(m.content);
    if (!Array.isArray(m.content)) throw new BadRequest('content must be text or blocks');
    const allowed = m.role === 'user' ? USER_BLOCKS : ASSISTANT_BLOCKS;
    for (const b of m.content) {
      if (!allowed.has(b?.type)) throw new BadRequest('block type not allowed: ' + b?.type);
      if (b.type === 'text') checkText(b.text);
      if (b.type === 'tool_result') checkText(typeof b.content === 'string' ? b.content : JSON.stringify(b.content));
    }
  });
  if (messages[messages.length - 1].role !== 'user') throw new BadRequest('last message must be from the user');

  return {
    model: MODEL,
    max_tokens: 2000, // short chat replies by design
    output_config: { effort: 'low' }, // chat: fast replies; thinking stays adaptive
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default', // on a policy decline the API retries on a fallback model in the same call
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    tools: [LINE_TOOL],
    messages,
  };
}

function cors(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return {
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0] || 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    Vary: 'Origin',
  };
}

const json = (data, status, headers) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...headers } });

export async function handle(request, env, client) {
  const headers = cors(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, headers);
  if (headers['Access-Control-Allow-Origin'] !== request.headers.get('Origin')) {
    return json({ error: 'origin not allowed' }, 403, headers);
  }

  let params;
  try {
    params = buildRequest(await request.json());
  } catch (e) {
    return json({ error: e instanceof BadRequest ? e.message : 'invalid JSON' }, 400, headers);
  }

  try {
    const response = await client.beta.messages.create(params);
    return json({ content: response.content, stop_reason: response.stop_reason, model: response.model }, 200, headers);
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return json({ error: 'busy' }, 429, headers);
    if (error instanceof Anthropic.APIError) return json({ error: 'upstream', status: error.status }, 502, headers);
    return json({ error: 'unavailable' }, 502, headers);
  }
}

export default {
  fetch(request, env) {
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1 });
    return handle(request, env, client);
  },
};
