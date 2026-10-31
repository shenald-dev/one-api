const request = require('supertest');
const { app } = require('./src/index.js');

async function run() {
  const res1 = await request(app)
    .post('/v1/chat/completions')
    .set('Content-Type', 'application/json')
    .set('Content-Length', '1') // request.size.invalid
    .send('{"a":1}');
  console.log("Size Invalid status:", res1.status, res1.text);

  const res2 = await request(app)
    .post('/v1/chat/completions')
    .set('Content-Type', 'application/json')
    .send('not json');
  console.log("Parse Failed status:", res2.status, res2.text);
}
run();
