import { apiFetch, getAccessToken, getUserIdFromAccessToken } from './api';
import { saveOrderPaymentAttempt, type OrderPaymentAttempt } from './checkout-attempt';

export type OrderPaymentMethod = 'WALLET' | 'CREDIT_CARD' | 'MOMO';

type PaymentResponse = {
  status?: string;
  message?: string;
  orderStatus?: string;
  rewardPointsAdded?: number;
  payment?: { status?: string };
  order?: { status?: string; rewardPointsEarned?: number };
};

export type SubmitOrderPaymentInput = {
  token: string;
  storageKey: string;
  attempt: OrderPaymentAttempt;
  orderId: number | string;
  amount: number;
  method: OrderPaymentMethod;
  orderStatus: string;
};

/**
 * Execute POST /payments idempotently for both initial checkout and History payment retries.
 */
export async function submitOrderPayment({
  token,
  storageKey,
  attempt,
  orderId,
  amount,
  method,
  orderStatus,
}: SubmitOrderPaymentInput): Promise<{
  payment: PaymentResponse;
  resolvedStatus: string;
}> {
  if (orderStatus === 'PAYMENT_FAILED' && attempt.paymentMethod) {
    attempt.paymentKey = crypto.randomUUID();
    delete attempt.paymentMethod;
    saveOrderPaymentAttempt(storageKey, attempt);
  }
  if (attempt.paymentMethod && attempt.paymentMethod !== method) {
    throw new Error(
      'Lần thanh toán trước chưa rõ kết quả. Vui lòng chọn lại phương thức trước đó để kiểm tra, hoặc hủy đơn trong lịch sử.',
    );
  }

  attempt.paymentMethod = method;
  saveOrderPaymentAttempt(storageKey, attempt);

  const payment = await apiFetch<PaymentResponse>('/payments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Idempotency-Key': attempt.paymentKey,
    },
    body: JSON.stringify({ orderId: Number(orderId), method, amount }),
  });

  const paymentStatus =
    payment?.orderStatus ??
    payment?.payment?.status ??
    payment?.status ??
    payment?.order?.status;

  if (!payment || typeof paymentStatus !== 'string') {
    throw new Error('API thanh toán không trả về trạng thái hợp lệ.');
  }

  if (paymentStatus === 'PAYMENT_FAILED' || paymentStatus === 'FAILED') {
    attempt.paymentKey = crypto.randomUUID();
    delete attempt.paymentMethod;
    saveOrderPaymentAttempt(storageKey, attempt);
    throw new Error(payment.message ?? 'Thanh toán thất bại. Vui lòng thử lại.');
  }

  if (paymentStatus !== 'PAID' && paymentStatus !== 'SUCCESS') {
    throw new Error(payment.message ?? `Thanh toán chưa hoàn tất (${paymentStatus}).`);
  }

  if (getUserIdFromAccessToken(getAccessToken() ?? '') !== getUserIdFromAccessToken(token)) {
    throw new Error(
      'Tài khoản đã thay đổi. Đơn đã thanh toán thuộc tài khoản trước; giỏ hiện tại được giữ nguyên.',
    );
  }

  return {
    payment,
    resolvedStatus: payment.order?.status ?? payment.orderStatus ?? paymentStatus ?? 'PAID',
  };
}
