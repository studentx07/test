'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const workerSource = fs.readFileSync(path.join(root, 'worker', 'index.js'), 'utf8');

function loadWorker(fetchImpl) {
  const source = workerSource.replace('export default', 'const worker =') + '\nworker;';
  return vm.runInNewContext(source, {
    TextEncoder, TextDecoder, Uint8Array, Response, JSON, String, Math,
    fetch: fetchImpl
  });
}

const env = {
  ALLOWED_ORIGINS: 'https://sakina.example',
  OPENAI_API_KEY: 'test-provider-key',
  SAKINA_ACCESS_TOKEN: 'test-access-token',
  OPENAI_MODEL: 'gpt-5.5'
};

function request(body, token = 'test-access-token') {
  return new Request('https://worker.example/chat', {
    method: 'POST',
    headers: {
      Origin: 'https://sakina.example',
      'Content-Type': 'application/json',
      'X-Sakina-Token': token
    },
    body: JSON.stringify(body)
  });
}

test('AI worker JavaScript parses as a module after export wrapper removal', () => {
  assert.match(workerSource, /export default \{/);
  new vm.Script(workerSource.replace('export default', 'const worker ='));
});

test('AI worker keeps provider credentials server-side and disables response storage', () => {
  assert.match(workerSource, /env\.OPENAI_API_KEY/);
  assert.match(workerSource, /env\.SAKINA_ACCESS_TOKEN/);
  assert.match(workerSource, /store:\s*false/);
  assert.doesNotMatch(workerSource, /OPENAI_API_KEY\s*[:=]\s*["'][^"']/);
});

test('AI worker validates origin, auth, message count and message size', () => {
  for (const pattern of [
    /allowed\.includes\(origin\)/,
    /X-Sakina-Token/,
    /MAX_BODY_BYTES/,
    /MAX_MESSAGES/,
    /MAX_MESSAGE_CHARS/,
    /messages\[messages\.length - 1\]\.role !== "user"/
  ]) assert.match(workerSource, pattern);
});

test('AI worker rejects an invalid access token before calling the provider', async () => {
  let providerCalled = false;
  const worker = loadWorker(async () => { providerCalled = true; });
  const response = await worker.fetch(request({
    messages: [{ role: 'user', text: 'مرحبا' }]
  }, 'wrong-token'), env);
  assert.equal(response.status, 401);
  assert.equal(providerCalled, false);
});

test('AI worker sends chat to Responses API and returns the generated reply', async () => {
  let captured;
  const worker = loadWorker(async (url, options) => {
    captured = { url, options, body: JSON.parse(options.body) };
    return new Response(JSON.stringify({
      output: [{
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text: 'أهلًا، أنا سكينة.' }]
      }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });

  const response = await worker.fetch(request({
    messages: [
      { role: 'user', text: 'مرحبا' },
      { role: 'assistant', text: 'أهلًا.' },
      { role: 'user', text: 'كيف حالك؟' }
    ]
  }), env);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { reply: 'أهلًا، أنا سكينة.' });
  assert.equal(captured.url, 'https://api.openai.com/v1/responses');
  assert.equal(captured.options.headers.Authorization, 'Bearer test-provider-key');
  assert.equal(captured.body.model, 'gpt-5.5');
  assert.equal(captured.body.store, false);
  assert.equal(captured.body.input.length, 3);
  assert.match(captured.body.instructions, /أنت سكينة/);
});

test('AI worker does not expose upstream provider error details', async () => {
  const worker = loadWorker(async () => new Response(
    JSON.stringify({ error: { message: 'private provider detail' } }),
    { status: 429, headers: { 'Content-Type': 'application/json' } }
  ));
  const response = await worker.fetch(request({
    messages: [{ role: 'user', text: 'مرحبا' }]
  }), env);
  const data = await response.json();
  assert.equal(response.status, 502);
  assert.equal(data.error, 'AI provider request failed');
  assert.equal(data.providerStatus, 429);
  assert.equal(JSON.stringify(data).includes('private provider detail'), false);
});
