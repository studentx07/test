'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const workerSource = fs.readFileSync(path.join(root, 'worker', 'index.js'), 'utf8');

function loadWorker() {
  const source = workerSource.replace('export default', 'const worker =') + '\nworker;';
  return vm.runInNewContext(source, {
    TextEncoder, TextDecoder, Uint8Array, Response, JSON, String, Math
  });
}

const env = {
  ALLOWED_ORIGINS: 'https://sakina.example',
  SAKINA_ACCESS_TOKEN: 'test-access-token',
  AI: { run: async () => ({ response: 'أهلًا، أنا سكينة.' }) }
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

test('AI worker uses the Cloudflare AI binding and a free-plan model without provider API keys', () => {
  assert.match(workerSource, /env\.AI\.run/);
  assert.match(workerSource, /@cf\/google\/gemma-4-26b-a4b-it/);
  assert.match(workerSource, /env\.SAKINA_ACCESS_TOKEN/);
  assert.doesNotMatch(workerSource, /OPENAI_API_KEY|api\.openai\.com/);
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

test('AI worker rejects an invalid access token before calling Workers AI', async () => {
  let modelCalled = false;
  const worker = loadWorker();
  const testEnv = { ...env, AI: { run: async () => { modelCalled = true; return { response: 'no' }; } } };
  const response = await worker.fetch(request({
    messages: [{ role: 'user', text: 'مرحبا' }]
  }, 'wrong-token'), testEnv);
  assert.equal(response.status, 401);
  assert.equal(modelCalled, false);
});

test('AI worker sends the system prompt and chat to the selected Workers AI model', async () => {
  let captured;
  const worker = loadWorker();
  const testEnv = { ...env, AI: { run: async (model, input) => {
    captured = { model, input };
    return { response: 'أهلًا، أنا سكينة.' };
  } } };

  const response = await worker.fetch(request({
    messages: [
      { role: 'user', text: 'مرحبا' },
      { role: 'assistant', text: 'أهلًا.' },
      { role: 'user', text: 'كيف حالك؟' }
    ]
  }), testEnv);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { reply: 'أهلًا، أنا سكينة.' });
  assert.equal(captured.model, '@cf/google/gemma-4-26b-a4b-it');
  assert.equal(captured.input.store, false);
  assert.equal(captured.input.max_tokens, 700);
  assert.equal(captured.input.messages.length, 4);
  assert.equal(captured.input.messages[0].role, 'system');
  assert.match(captured.input.messages[0].content, /أنت سكينة/);
});

test('AI worker does not expose Workers AI error details', async () => {
  const worker = loadWorker();
  const testEnv = { ...env, AI: { run: async () => { throw new Error('private provider detail'); } } };
  const response = await worker.fetch(request({
    messages: [{ role: 'user', text: 'مرحبا' }]
  }), testEnv);
  const data = await response.json();
  assert.equal(response.status, 502);
  assert.match(data.error, /free quota/);
  assert.equal(JSON.stringify(data).includes('private provider detail'), false);
});
