export type HistoryPayment = {
  id?: number;
  method: string;
  status: string;
  amount: number;
  createdAt?: string;
};

export function orderCode(id: number | string): string {
  return `BL${String(id).padStart(8, '0')}`;
}

export function matchesOrderCode(id: number | string, search: string): boolean {
  const query = search.trim().replace(/^#/, '').toLocaleLowerCase('vi');
  return !query || String(id).includes(query) || orderCode(id).toLowerCase().includes(query);
}

export function successfulSpend(orders: { payment?: HistoryPayment[] }[]): number {
  return orders.reduce((total, order) => total + (order.payment ?? [])
    .filter(payment => payment.status === 'PAID')
    .reduce((sum, payment) => sum + payment.amount, 0), 0);
}

export function primaryPayment(payments: HistoryPayment[] = []): HistoryPayment | undefined {
  const newest = [...payments].sort((a, b) =>
    (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || (b.id ?? 0) - (a.id ?? 0));
  return newest.find(payment => payment.status === 'PAID')
    ?? newest.find(payment => payment.status === 'REFUNDED') ?? newest[0];
}

export function paymentLabel(method?: string): string {
  return ({ WALLET: 'Ví điện tử', CREDIT_CARD: 'Thẻ ngân hàng', MOMO: 'Ví MoMo' } as Record<string, string>)[method ?? '']
    ?? 'Chưa có thông tin';
}
