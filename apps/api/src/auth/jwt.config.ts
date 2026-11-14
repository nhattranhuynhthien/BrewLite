import type { JwtModuleOptions } from '@nestjs/jwt';

export function jwtOptions(secret = process.env.JWT_SECRET): JwtModuleOptions {
  if (
    !secret ||
    Buffer.byteLength(secret.trim(), 'utf8') < 32 ||
    secret === 'brewlite_super_secret_jwt_key_2026'
  ) {
    throw new Error('JWT_SECRET phải là secret riêng có ít nhất 32 byte; không được dùng secret mặc định cũ.');
  }
  return {
    secret,
    signOptions: { expiresIn: '1d', algorithm: 'HS256' },
    verifyOptions: { algorithms: ['HS256'] },
  };
}
