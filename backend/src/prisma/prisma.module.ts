import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // Biến module này thành toàn cục
@Module({
  providers: [PrismaService],
  exports: [PrismaService], // Cho phép các module khác gọi PrismaService
})
export class PrismaModule {}