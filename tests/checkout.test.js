import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/order.js';
import { PRODUCTS } from '../src/data/burr-data.js';
import { MAX_ORDER_QTY } from '../src/data/constants.js';
import { addToCart, initialCartState, restoreCart, serializeCart } from '../src/data/cart.js';

const product = PRODUCTS[0];

test('cart survives reload and adding a second product from its page', () => {
  const first = initialCartState(null, product.code.toLowerCase());
  assert.equal(first.open, true);
  const saved = serializeCart(first.items);
  assert.deepEqual(JSON.parse(saved), [{ code: product.code, qty: 1 }]);
  const reloaded = initialCartState(saved, null);
  assert.equal(reloaded.open, false);
  assert.deepEqual(reloaded.items, first.items);
  const second = initialCartState(saved, PRODUCTS[1].code);
  assert.deepEqual(second.items.map((p) => p.code), [product.code, PRODUCTS[1].code]);
  assert.equal(initialCartState(saved, product.code).items[0].qty, 2);
  assert.deepEqual(restoreCart(serializeCart([])), []);
});

test('stored cart ignores corrupt data and restores current catalog prices', () => {
  for (const raw of ['broken JSON', '{}', 'null', '[null,3,{}]']) assert.deepEqual(restoreCart(raw), []);
  const cart = restoreCart(JSON.stringify([
    { code: 'unknown', qty: 1 },
    { code: product.code, qty: 2, price: 1, name_ru: 'fake' },
    { code: product.code, qty: 3 },
    { code: PRODUCTS[1].code, qty: -1 },
  ]));
  assert.deepEqual(cart, [{ ...product, qty: 5 }]);
  const max = [{ ...product, qty: MAX_ORDER_QTY }];
  assert.equal(addToCart(max, product)[0].qty, MAX_ORDER_QTY);
});

async function request(body) {
  const response = {
    code: 200,
    setHeader() {},
    status(code) { this.code = code; return this; },
    json(data) { this.data = data; return this; },
  };
  await handler({ method: 'POST', headers: { origin: 'https://borfrezy.in.ua' }, body }, response);
  return response;
}

test('checkout rejects malformed items before attempting delivery', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => { throw new Error('No network allowed'); });
  const invalidItems = [
    [null], [1], [[]], [{}], [{ code: 'missing', qty: 1 }],
    [{ code: 'toString', qty: 1 }], [{ code: '__proto__', qty: 1 }],
    ...[0, -1, 1.5, '2', null, MAX_ORDER_QTY + 1].map((qty) => [{ code: product.code, qty }]),
    [{ code: product.code, qty: 1 }, { code: product.code, qty: 1 }],
  ];
  for (const items of invalidItems) {
    const res = await request({ customer: { phone: '0000000000' }, items });
    assert.equal(res.code, 400, JSON.stringify(items));
  }
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('one-item checkout uses canonical product data and accepts orders below 2000', async (t) => {
  const saved = { ...process.env };
  process.env.TELEGRAM_BOT_TOKEN = 'test-token';
  process.env.TELEGRAM_CHAT_ID = 'test-chat';
  delete process.env.RESEND_API_KEY;
  t.after(() => {
    for (const key of ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'RESEND_API_KEY']) {
      if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
    }
  });
  const messages = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    messages.push(JSON.parse(options.body));
    return { ok: true };
  });
  const result = await request({
    language: 'ru', customer: { name: 'Local test', phone: '0000000000' },
    items: [{ code: product.code, qty: 1, price: 1, name_ru: 'FAKE PRODUCT', headD: 999 }],
  });
  assert.equal(result.code, 200);
  assert.equal(messages.length, 1);
  assert.ok(messages[0].text.includes(product.name_ru));
  assert.ok(messages[0].text.includes(`Разом: ${product.price} грн`));
  assert.ok(!messages[0].text.includes('FAKE PRODUCT'));
  assert.ok(!messages[0].text.includes('Ø999'));

  messages.length = 0;
  const large = await request({ customer: { phone: '0000000000', comment: '&'.repeat(1200) }, items: PRODUCTS.map((p) => ({ code: p.code, qty: 1 })) });
  assert.equal(large.code, 200);
  assert.ok(messages.length > 1);
  const fullText = messages.map((m) => m.text).join('\n');
  for (const p of PRODUCTS) assert.ok(fullText.includes(`(${p.code})`));
  assert.ok(fullText.includes(`Разом: ${PRODUCTS.reduce((sum, p) => sum + p.price, 0)} грн`));
  for (const message of messages) {
    assert.ok(message.text.length <= 4096);
    assert.ok(!message.text.replaceAll('&amp;', '').includes('&'));
    assert.equal((message.text.match(/<b>/g) || []).length, (message.text.match(/<\/b>/g) || []).length);
  }
});
