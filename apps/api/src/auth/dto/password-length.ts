import { registerDecorator } from 'class-validator';

// bcrypt compares at most 72 UTF-8 bytes, including for multi-byte characters.
export function BcryptPasswordLength(): PropertyDecorator {
  return (target, propertyKey) => registerDecorator({
    name: 'bcryptPasswordLength',
    target: target.constructor,
    propertyName: String(propertyKey),
    options: { message: 'Mật khẩu không được vượt quá 72 byte UTF-8.' },
    validator: {
      validate: (value: unknown) => typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= 72,
    },
  });
}
