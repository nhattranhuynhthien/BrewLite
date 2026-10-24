import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaService } from '../prisma/prisma.service'; // 1. Bổ sung dòng import này

@Module({
  controllers: [UsersController],
  providers: [UsersService, PrismaService], // 2. Thêm PrismaService vào mảng providers
})
export class UsersModule {}