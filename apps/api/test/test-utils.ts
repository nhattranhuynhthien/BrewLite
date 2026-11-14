import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

/**
 * Chặn chạy e2e trên DB thật: DATABASE_URL phải trỏ tới DB có chữ "test"
 * (vd: brewlite_test). Đặt DATABASE_URL trong .env.test hoặc biến môi trường CI.
 */
export function assertTestDatabase(): void {
  const url = process.env.DATABASE_URL ?? '';
  const dbName = url.split('?')[0].split('/').pop() ?? '';
  if (!/test/i.test(dbName)) {
    throw new Error(
      `E2E chỉ được chạy trên DB test riêng (tên DB phải chứa "test"). Hiện tại: "${dbName || 'chưa đặt DATABASE_URL'}"`,
    );
  }
}

/**
 * Ký JWT bằng JwtService của chính app (dùng secret/option đã cấu hình trong
 * JwtModule), không hardcode secret trong test.
 */
export function signTestToken(
  app: INestApplication,
  user: { id: number; email: string },
): Promise<string> {
  return app.get(JwtService).signAsync({ sub: user.id, email: user.email });
}
