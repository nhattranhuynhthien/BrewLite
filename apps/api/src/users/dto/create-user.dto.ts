import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ description: 'Email của người dùng' })
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email: string;

  @ApiProperty({ description: 'Tên người dùng' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Mật khẩu' })
  @IsString()
  @IsNotEmpty()
  password: string;
}