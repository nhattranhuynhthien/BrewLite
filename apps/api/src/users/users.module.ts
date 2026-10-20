import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaService } from '../prisma/prisma.service'; // Thêm dòng import này

@Module({
  controllers: [UsersController],
  providers: [UsersService, PrismaService], // Bổ sung PrismaService vào mảng này
})
export class UsersModule {}