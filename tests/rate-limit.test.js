import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rateLimited, clientIp } from '../api/order.js';

const env = { UPSTASH_REDIS_REST_URL: 'https://redis.example', UPSTASH_REDIS_REST_TOKEN: 'token' };
const redisReply = (count) => async () => new Response(JSON.stringify([{ result: count }, { result: 1 }]), { status: 200 });

test('no Upstash config: never limits', async () => {
  const fetchImpl = async () => { throw new Error('must not be called'); };
  assert.equal(await rateLimited('1.2.3.4', { fetchImpl, env: {} }), false);
});

test('over the limit: blocked', async () => {
  assert.equal(await rateLimited('1.2.3.4', { fetchImpl: redisReply(6), env }), true);
});

test('within the limit: allowed', async () => {
  assert.equal(await rateLimited('1.2.3.4', { fetchImpl: redisReply(5), env }), false);
});

test('Redis outage: fails open so real orders are not blocked', async () => {
  const fetchImpl = async () => { throw new Error('ECONNREFUSED'); };
  assert.equal(await rateLimited('1.2.3.4', { fetchImpl, env }), false);
});

test('sends INCR and EXPIRE NX for the client key', async () => {
  let sent;
  const fetchImpl = async (url, init) => { sent = { url, body: JSON.parse(init.body), auth: init.headers.Authorization }; return redisReply(1)(); };
  await rateLimited('1.2.3.4', { fetchImpl, env });
  assert.equal(sent.url, 'https://redis.example/pipeline');
  assert.equal(sent.auth, 'Bearer token');
  assert.deepEqual(sent.body[0], ['INCR', 'rl:order:1.2.3.4']);
  assert.deepEqual(sent.body[1], ['EXPIRE', 'rl:order:1.2.3.4', 3600, 'NX']);
});

test('clientIp takes the first X-Forwarded-For hop', () => {
  assert.equal(clientIp({ headers: { 'x-forwarded-for': '9.9.9.9, 10.0.0.1' } }), '9.9.9.9');
  assert.equal(clientIp({ headers: {}, socket: { remoteAddress: '127.0.0.1' } }), '127.0.0.1');
});
