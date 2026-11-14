const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadTs } = require('./load-ts.cjs');
const load = name => loadTs(path.resolve(__dirname, '../src', name));

const storage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key), clear: () => values.clear() };
};
global.localStorage = storage();
global.sessionStorage = storage();
global.window = { localStorage, dispatchEvent: () => {}, atob: value => Buffer.from(value, 'base64').toString('binary') };

const history = load('lib/order-history.ts');
const checkout = load('lib/checkout-attempt.ts');
const token = id => `header.${Buffer.from(JSON.stringify({ sub: id })).toString('base64url')}.signature`;

test('spending excludes unpaid, failed and refunded attempts, and uses payment amounts', () => {
  const payment = (status, amount) => ({ status, amount, method: 'WALLET' });
  assert.equal(history.successfulSpend([
    { total: 50000, payment: [payment('FAILED', 50000), payment('PAID', 50000)] },
    { total: 70000, payment: [] },
    { total: 90000, payment: [payment('REFUNDED', 90000)] },
  ]), 50000);
});

test('history finds formatted codes and selects the paid method after a failed attempt', () => {
  for (const query of ['42', 'BL00000042', '#bl00000042', '  BL00000042  ']) {
    assert.equal(history.matchesOrderCode(42, query), true);
  }
  assert.equal(history.matchesOrderCode(42, 'BL00000043'), false);
  const failed = { id: 1, status: 'FAILED', method: 'WALLET', amount: 50000 };
  const paid = { id: 2, status: 'PAID', method: 'MOMO', amount: 50000 };
  assert.equal(history.primaryPayment([failed, paid]), paid);
  assert.equal(history.paymentLabel('MOMO'), 'Ví MoMo');
  assert.equal(history.paymentLabel('CREDIT_CARD'), 'Thẻ ngân hàng');
});

test('checkout identity follows user and exact cart, survives reload and retains unknown attempts', async () => {
  const first = await checkout.checkoutStorageKey(token(7), '{"quantity":1}');
  const changed = await checkout.checkoutStorageKey(token(7), '{"quantity":2}');
  const otherUser = await checkout.checkoutStorageKey(token(8), '{"quantity":1}');
  assert.notEqual(first, changed);
  assert.notEqual(first, otherUser);
  const attempt = checkout.loadCheckoutAttempt(first);
  checkout.saveActiveCheckout(token(7), { storageKey: first, body: '{"quantity":1}' });
  sessionStorage.clear();
  assert.deepEqual(checkout.loadCheckoutAttempt(first), attempt);
  assert.equal(checkout.getActiveCheckout(token(7)).storageKey, first);
  assert.equal(checkout.getActiveCheckout(token(8)), null);
  checkout.finishCheckout(token(7), changed);
  assert.equal(checkout.getActiveCheckout(token(7)).storageKey, first);
  checkout.finishCheckout(token(7), first);
  assert.equal(checkout.getActiveCheckout(token(7)), null);
});

test('a payment consumes only the purchased variants and quantities', () => {
  const { useCartStore } = load('store/cart-store.ts');
  const product = { id: 1, name: 'Coffee', price: 35000, stock: 100, imageUrl: null };
  const extra = { ...product, id: 2, name: 'Tea' };
  useCartStore.getState().clearCart();
  useCartStore.getState().addItem(product, 2);
  const snapshot = useCartStore.getState().items;
  useCartStore.getState().addItem(product, 3);
  useCartStore.getState().addItem(extra, 1);
  useCartStore.getState().consumeItems(snapshot);
  assert.deepEqual(useCartStore.getState().items.map(item => [item.product.id, item.quantity]), [[1, 3], [2, 1]]);
});

test('a delayed 401 cannot sign out the account selected after the request started', async () => {
  const api = load('lib/api.ts');
  const originalFetch = global.fetch;
  let respond;
  global.fetch = () => new Promise(resolve => { respond = resolve; });
  const unauthorized = () => new Response(JSON.stringify({ message: 'Expired' }), {
    status: 401, headers: { 'content-type': 'application/json' },
  });
  try {
    api.setAccessToken('old-account-token');
    const pending = api.apiFetch('/orders/me');
    api.setAccessToken('new-account-token');
    respond(unauthorized());
    await assert.rejects(pending, error => error.status === 401);
    assert.equal(api.getAccessToken(), 'new-account-token');
    const current = api.apiFetch('/orders/me');
    respond(unauthorized());
    await assert.rejects(current, error => error.status === 401);
    assert.equal(api.getAccessToken(), null);
  } finally {
    global.fetch = originalFetch;
  }
});
