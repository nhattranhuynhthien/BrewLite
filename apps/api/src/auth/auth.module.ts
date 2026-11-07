import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaService } from '../prisma/prisma.service'; // Bổ sung PrismaService
import { JwtModule } from '@nestjs/jwt'; // Bổ sung JwtModule

@Module({
  // Thêm mảng imports để cấu hình JWT
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'brewlite_super_secret_jwt_key_2026', // Khóa bí mật dùng để ký Token
      signOptions: { expiresIn: '1d' }, // Token có hiệu lực 1 ngày
    }),
  ],
  controllers: [AuthController],
  // Thêm PrismaService vào mảng providers
  providers: [AuthService, PrismaService], 
})
export class AuthModule {}