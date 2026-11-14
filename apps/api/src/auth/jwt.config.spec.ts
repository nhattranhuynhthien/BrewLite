import { randomBytes } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { jwtOptions } from './jwt.config';

describe('JWT configuration and verification', () => {
  it.each(['', 'short', ' '.repeat(64), 'brewlite_super_secret_jwt_key_2026'])(
    'rejects an absent, weak or previously public secret', secret => {
      expect(() => jwtOptions(secret)).toThrow('JWT_SECRET');
    },
  );

  it('fails during module initialization when no secret is configured', async () => {
    await expect(Test.createTestingModule({
      imports: [JwtModule.registerAsync({ useFactory: () => jwtOptions('') })],
    }).compile()).rejects.toThrow('JWT_SECRET');
  });

  it('accepts its own tokens, rejects the old signing key and keeps verification bound to the configured key', async () => {
    const jwt = new JwtService(jwtOptions(randomBytes(48).toString('hex')));
    const guard = new AuthGuard(jwt);
    const user = { sub: 42, email: 'test@example.com' };
    const request: { headers: { authorization: string }; user?: typeof user } = {
      headers: { authorization: `Bearer ${await jwt.signAsync(user)}` },
    };
    const context = { switchToHttp: () => ({ getRequest: () => request }) } as ExecutionContext;
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toMatchObject(user);

    const forged = new JwtService({ secret: 'brewlite_super_secret_jwt_key_2026' });
    request.headers.authorization = `Bearer ${await forged.signAsync(user)}`;
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    request.headers.authorization = `Bearer ${await jwt.signAsync({ ...user, sub: -1 })}`;
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    request.headers.authorization = `Bearer ${await jwt.signAsync(user, { algorithm: 'HS384' })}`;
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    request.headers.authorization = `Bearer ${await jwt.signAsync(user, { expiresIn: -1 })}`;
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
});
