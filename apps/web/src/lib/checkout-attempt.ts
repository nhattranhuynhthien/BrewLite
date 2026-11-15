import { getUserIdFromAccessToken } from './api';

export type CheckoutAttempt = {
  orderKey: string;
  paymentKey: string;
  paymentMethod?: string;
};

export type OrderPaymentAttempt = {
  paymentKey: string;
  paymentMethod?: string;
};

export type ActiveCheckout = {
  storageKey: string;
  body: string;
  orderId?: number;
  cartSnapshot?: unknown[];
};

function activeKey(token: string): string {
  const id = getUserIdFromAccessToken(token);
  if (!id) throw new Error('Vui lòng đăng nhập lại trước khi thanh toán.');
  return `brewlite-active-checkout:${id}`;
}

export function getActiveCheckout(token: string): ActiveCheckout | null {
  const raw = localStorage.getItem(activeKey(token));
  if (!raw) return null;
  const active = JSON.parse(raw) as ActiveCheckout;
  if (typeof active.storageKey !== 'string' || typeof active.body !== 'string') {
    throw new Error('Lần đặt đơn trước chưa rõ kết quả. Vui lòng kiểm tra lịch sử đơn.');
  }
  return active;
}

export function saveActiveCheckout(token: string, active: ActiveCheckout) {
  localStorage.setItem(activeKey(token), JSON.stringify(active));
}

export function finishCheckout(token: string, storageKey: string) {
  localStorage.removeItem(storageKey);
  sessionStorage.removeItem(storageKey);
  if (getActiveCheckout(token)?.storageKey === storageKey) localStorage.removeItem(activeKey(token));
}

export async function withCheckoutLock<T>(token: string, callback: () => Promise<T>): Promise<T> {
  if (!navigator.locks) return callback();
  return navigator.locks.request(activeKey(token), { ifAvailable: true }, async lock => {
    if (!lock) throw new Error('Một tab khác đang thanh toán. Vui lòng chờ kết quả.');
    return callback();
  });
}

// Persist before sending a request: a lost response must not create a new order.
// Storage is scoped to the authenticated user and exact cart, not the access token.
export async function checkoutStorageKey(token: string, body: string): Promise<string> {
  const userId = getUserIdFromAccessToken(token);
  if (!userId) throw new Error('Vui lòng đăng nhập lại trước khi thanh toán.');
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body));
  return `brewlite-checkout:${userId}:${Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('')}`;
}

export function loadCheckoutAttempt(key: string): CheckoutAttempt {
  const raw = localStorage.getItem(key) ?? sessionStorage.getItem(key);
  if (raw) {
    const saved = JSON.parse(raw) as CheckoutAttempt;
    if (typeof saved.orderKey !== 'string' || typeof saved.paymentKey !== 'string') {
      throw new Error('Thông tin thanh toán đã lưu không hợp lệ. Vui lòng kiểm tra lịch sử đơn.');
    }
    return saved;
  }
  const attempt = { orderKey: crypto.randomUUID(), paymentKey: crypto.randomUUID() };
  saveCheckoutAttempt(key, attempt);
  return attempt;
}

export function saveCheckoutAttempt(key: string, attempt: CheckoutAttempt) {
  localStorage.setItem(key, JSON.stringify(attempt));
}

function orderPayKey(token: string, orderId: number | string): string {
  const id = getUserIdFromAccessToken(token);
  if (!id) throw new Error('Vui lòng đăng nhập lại trước khi thanh toán.');
  return `brewlite-order-pay:${id}:${orderId}`;
}

export function saveOrderPaymentAttempt(key: string, attempt: OrderPaymentAttempt) {
  const raw = localStorage.getItem(key) ?? sessionStorage.getItem(key);
  const existing = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  const next: Record<string, unknown> = { ...existing, paymentKey: attempt.paymentKey };
  if (attempt.paymentMethod) {
    next.paymentMethod = attempt.paymentMethod;
  } else {
    delete next.paymentMethod;
  }
  localStorage.setItem(key, JSON.stringify(next));
}

export function loadOrderPaymentAttempt(
  token: string,
  orderId: number | string,
  orderStatus: string,
): { storageKey: string; attempt: OrderPaymentAttempt; linkedCheckoutKey: string | null } {
  const numericOrderId = Number(orderId);
  const active = getActiveCheckout(token);
  if (active && Number.isInteger(numericOrderId) && active.orderId === numericOrderId) {
    const attempt = loadCheckoutAttempt(active.storageKey);
    if (orderStatus === 'PAYMENT_FAILED' && attempt.paymentMethod) {
      attempt.paymentKey = crypto.randomUUID();
      delete attempt.paymentMethod;
      saveCheckoutAttempt(active.storageKey, attempt);
    }
    return { storageKey: active.storageKey, attempt, linkedCheckoutKey: active.storageKey };
  }

  const storageKey = orderPayKey(token, orderId);
  const raw = localStorage.getItem(storageKey) ?? sessionStorage.getItem(storageKey);
  if (raw) {
    const saved = JSON.parse(raw) as OrderPaymentAttempt;
    if (typeof saved.paymentKey !== 'string') {
      throw new Error('Thông tin thanh toán đã lưu không hợp lệ. Vui lòng kiểm tra lịch sử đơn.');
    }
    if (orderStatus === 'PAYMENT_FAILED' && saved.paymentMethod) {
      saved.paymentKey = crypto.randomUUID();
      delete saved.paymentMethod;
      saveOrderPaymentAttempt(storageKey, saved);
    }
    return { storageKey, attempt: saved, linkedCheckoutKey: null };
  }

  const attempt: OrderPaymentAttempt = { paymentKey: crypto.randomUUID() };
  saveOrderPaymentAttempt(storageKey, attempt);
  return { storageKey, attempt, linkedCheckoutKey: null };
}

export function finishOrderPaymentAttempt(
  token: string,
  storageKey: string,
  orderId: number | string,
  linkedCheckoutKey: string | null,
) {
  const fallbackKey = orderPayKey(token, orderId);
  localStorage.removeItem(storageKey);
  sessionStorage.removeItem(storageKey);
  localStorage.removeItem(fallbackKey);
  sessionStorage.removeItem(fallbackKey);
  if (linkedCheckoutKey) {
    finishCheckout(token, linkedCheckoutKey);
  }
}

export function clearLinkedCheckoutForOrder(token: string | null, orderId: number | string) {
  if (!token) return;
  const numericOrderId = Number(orderId);
  const fallbackKey = orderPayKey(token, orderId);
  localStorage.removeItem(fallbackKey);
  sessionStorage.removeItem(fallbackKey);
  try {
    const active = getActiveCheckout(token);
    if (active && Number.isInteger(numericOrderId) && active.orderId === numericOrderId) {
      finishCheckout(token, active.storageKey);
    }
  } catch {
    // Ignore malformed checkout storage during cleanup after order cancellation.
  }
}
