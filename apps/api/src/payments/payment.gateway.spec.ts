import { MockPaymentGateway } from './payment.gateway';

describe('Mock gateway idempotency', () => {
  it('charges only once for concurrent retries and preserves the original result', async () => {
    const gateway = new MockPaymentGateway();
    gateway.success = false;
    const results = await Promise.all([
      gateway.charge(1, 35000, 'WALLET', 'same'),
      gateway.charge(1, 35000, 'WALLET', 'same'),
    ]);
    expect(results).toEqual([{ success: false }, { success: false }]);
    gateway.success = true;
    expect(await gateway.charge(1, 35000, 'WALLET', 'same')).toEqual({ success: false });
    expect(gateway.calls).toHaveLength(1);
    await expect(gateway.charge(2, 35000, 'WALLET', 'same')).rejects.toThrow();
  });
});
