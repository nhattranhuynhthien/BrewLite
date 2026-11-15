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

test('cart store enforces total stock limit across repeated adds and multiple variants', () => {
  const { useCartStore, getProductQuantityInCart, getRemainingProductStock } = load('store/cart-store.ts');
  const limited = { id: 10, name: 'Matcha', price: 45000, stock: 3, imageUrl: null };
  useCartStore.getState().clearCart();

  useCartStore.getState().addItem(limited, 2, { size: 'M', toppings: [], sweetness: 'Bình thường', ice: 'Bình thường', note: '' });
  assert.equal(getProductQuantityInCart(useCartStore.getState().items, 10), 2);
  assert.equal(getRemainingProductStock(useCartStore.getState().items, limited), 1);

  // Adding a second variant requests 2, but store caps total across all variants to stock (3).
  useCartStore.getState().addItem(limited, 2, { size: 'L', toppings: [], sweetness: 'Ít đường', ice: 'Bình thường', note: '' });
  assert.equal(getProductQuantityInCart(useCartStore.getState().items, 10), 3);
  assert.equal(getRemainingProductStock(useCartStore.getState().items, limited), 0);

  // Adding again does nothing once stock is exhausted.
  useCartStore.getState().addItem(limited, 1, { size: 'M', toppings: [], sweetness: 'Bình thường', ice: 'Bình thường', note: '' });
  assert.equal(getProductQuantityInCart(useCartStore.getState().items, 10), 3);

  // setQuantity cannot increase one variant above remaining stock considering the other variant.
  const { getCartItemKey } = load('lib/product-options.ts');
  const mKey = getCartItemKey(10, { size: 'M', toppings: [], sweetness: 'Bình thường', ice: 'Bình thường', note: '' });
  useCartStore.getState().setQuantity(mKey, 5);
  assert.equal(getProductQuantityInCart(useCartStore.getState().items, 10), 3);
});

test('order quote fetches server voucher discount and rejects invalid/exhausted codes', async () => {
  const quoteLib = load('lib/order-quote.ts');
  const originalFetch = global.fetch;
  const product = { id: 5, name: 'Cold Brew', price: 50000, stock: 10, imageUrl: null };
  const cart = [{ product, quantity: 2 }];

  try {
    global.fetch = async (url, init) => {
      assert.match(String(url), /\/orders\/quote$/);
      const sent = JSON.parse(init.body);
      if (sent.voucherCode === 'VIP25') {
        return new Response(JSON.stringify({
          subtotal: 100000,
          voucherCode: 'VIP25',
          voucherDiscount: 25000,
          voucher: { code: 'VIP25', discountPct: 25, maxDiscount: 40000 },
          totalAfterVoucher: 75000,
          pointsToUse: 0,
          pointsDiscount: 0,
          total: 75000,
          earnedPoints: 7,
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response(JSON.stringify({ message: 'Mã giảm giá không hợp lệ hoặc đã hết hạn!' }), {
        status: 400, headers: { 'content-type': 'application/json' },
      });
    };

    const valid = await quoteLib.fetchOrderQuote({ items: cart, voucherCode: 'VIP25' });
    assert.equal(valid.voucherDiscount, 25000);
    assert.equal(valid.total, 75000);

    await assert.rejects(
      quoteLib.fetchOrderQuote({ items: cart, voucherCode: 'EXPIRED' }),
      err => err.status === 400 && /không hợp lệ|hết hạn/.test(err.message),
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('history order payment shares unfinished checkout key and rotates key after PAYMENT_FAILED', async () => {
  localStorage.clear();
  sessionStorage.clear();
  const api = load('lib/api.ts');
  const userToken = token(21);
  api.setAccessToken(userToken);
  const { submitOrderPayment } = load('lib/order-payment.ts');
  const orderBody = JSON.stringify({ items: [{ productId: 3, quantity: 1 }] });
  const storageKey = await checkout.checkoutStorageKey(userToken, orderBody);
  const checkoutAttempt = checkout.loadCheckoutAttempt(storageKey);
  checkout.saveActiveCheckout(userToken, { storageKey, body: orderBody, orderId: 99 });

  // While PENDING with no prior payment call, loadOrderPaymentAttempt shares the active paymentKey.
  const loadedPending = checkout.loadOrderPaymentAttempt(userToken, 99, 'PENDING');
  assert.equal(loadedPending.storageKey, storageKey);
  assert.equal(loadedPending.linkedCheckoutKey, storageKey);
  assert.equal(loadedPending.attempt.paymentKey, checkoutAttempt.paymentKey);

  const originalFetch = global.fetch;
  const sentHeaders = [];
  try {
    let callCount = 0;
    global.fetch = async (_url, init) => {
      callCount += 1;
      const headers = new Headers(init.headers);
      sentHeaders.push({ key: headers.get('Idempotency-Key'), body: JSON.parse(init.body) });
      if (callCount === 1) {
        return new Response(JSON.stringify({ status: 'FAILED', orderStatus: 'PAYMENT_FAILED', message: 'Thẻ từ chối' }), {
          status: 201, headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ status: 'PAID', orderStatus: 'PAID', order: { id: 99, status: 'PAID' } }), {
        status: 201, headers: { 'content-type': 'application/json' },
      });
    };

    await assert.rejects(
      submitOrderPayment({
        token: userToken,
        storageKey: loadedPending.storageKey,
        attempt: loadedPending.attempt,
        orderId: 99,
        amount: 35000,
        method: 'CREDIT_CARD',
        orderStatus: 'PENDING',
      }),
      err => /Thẻ từ chối/.test(err.message),
    );

    // Also test stale paymentMethod left on disk when status on server is PAYMENT_FAILED (e.g. crash before cleanup).
    checkout.saveOrderPaymentAttempt(loadedPending.storageKey, {
      paymentKey: checkoutAttempt.paymentKey,
      paymentMethod: 'CREDIT_CARD',
    });
    const loadedRetry = checkout.loadOrderPaymentAttempt(userToken, 99, 'PAYMENT_FAILED');
    assert.notEqual(loadedRetry.attempt.paymentKey, checkoutAttempt.paymentKey);
    assert.equal(loadedRetry.attempt.paymentMethod, undefined);

    const paid = await submitOrderPayment({
      token: userToken,
      storageKey: loadedRetry.storageKey,
      attempt: loadedRetry.attempt,
      orderId: 99,
      amount: 35000,
      method: 'MOMO',
      orderStatus: 'PAYMENT_FAILED',
    });
    assert.equal(paid.resolvedStatus, 'PAID');
    assert.equal(sentHeaders[0].body.method, 'CREDIT_CARD');
    assert.equal(sentHeaders[1].body.method, 'MOMO');
    assert.notEqual(sentHeaders[0].key, sentHeaders[1].key);

    checkout.finishOrderPaymentAttempt(userToken, loadedRetry.storageKey, 99, loadedRetry.linkedCheckoutKey);
    assert.equal(checkout.getActiveCheckout(userToken), null);
  } finally {
    global.fetch = originalFetch;
    api.setAccessToken(null);
  }
});

test('cart store syncCatalog updates remaining stock without wiping user items', () => {
  const { useCartStore, getRemainingProductStock } = load('store/cart-store.ts');
  const cup = { id: 33, name: 'Latte Cuối', price: 45000, stock: 1, isAvailable: true, imageUrl: null };
  useCartStore.getState().clearCart();
  useCartStore.getState().addItem(cup, 1);
  assert.equal(getRemainingProductStock(useCartStore.getState().items, cup), 0);

  // Another customer buys the last cup: stock drops to 0.
  useCartStore.getState().syncCatalog([{ ...cup, stock: 0, isAvailable: false }]);
  const synced = useCartStore.getState().items;
  assert.equal(synced.length, 1);
  assert.equal(synced[0].product.stock, 0);
  assert.equal(synced[0].product.isAvailable, false);
});
