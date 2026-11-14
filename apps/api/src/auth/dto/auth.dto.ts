import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { BcryptPasswordLength } from './password-length';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty()
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  name: string;

  @ApiProperty()
  @IsString()
  @MinLength(6, { message: 'Mật khẩu phải từ 6 ký tự' })
  @BcryptPasswordLength()
  password: string;
}

export class LoginDto {
  @ApiProperty()
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @BcryptPasswordLength()
  password: string;
}
