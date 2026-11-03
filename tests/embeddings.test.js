const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { app } = require('../src/index');
const embeddingsEngine = require('../src/providers/embeddings');

test('Embeddings: generates deterministic normalized embeddings', () => {
  const vec1 = embeddingsEngine.generateLocalEmbedding('quantum computing', 1536);
  const vec2 = embeddingsEngine.generateLocalEmbedding('quantum computing', 1536);
  const vec3 = embeddingsEngine.generateLocalEmbedding('different text', 1536);

  assert.strictEqual(vec1.length, 1536);
  assert.deepStrictEqual(vec1, vec2); // deterministic
  assert.notDeepStrictEqual(vec1, vec3); // different for different text

  // Verify L2 norm is ~1.0
  let norm = 0;
  for (const v of vec1) norm += v * v;
  assert.ok(Math.abs(Math.sqrt(norm) - 1.0) < 0.01);
});

test('Embeddings: POST /v1/embeddings handles single string input', async () => {
  const res = await request(app)
    .post('/v1/embeddings')
    .send({
      model: 'text-embedding-3-small',
      input: 'Universal Edge LLM Gateway'
    });

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.object, 'list');
  assert.strictEqual(res.body.data.length, 1);
  assert.strictEqual(res.body.data[0].index, 0);
  assert.strictEqual(res.body.data[0].embedding.length, 1536);
  assert.ok(res.body.usage.prompt_tokens > 0);
});

test('Embeddings: POST /v1/embeddings handles batch array inputs', async () => {
  const res = await request(app)
    .post('/v1/embeddings')
    .send({
      model: 'text-embedding-3-small',
      input: ['First chunk of text', 'Second chunk of text']
    });

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.data.length, 2);
  assert.strictEqual(res.body.data[0].index, 0);
  assert.strictEqual(res.body.data[1].index, 1);
});

test('Embeddings: POST /v1/embeddings rejects missing input', async () => {
  const res = await request(app)
    .post('/v1/embeddings')
    .send({ model: 'text-embedding-3-small' });

  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.error.param, 'input');
});
