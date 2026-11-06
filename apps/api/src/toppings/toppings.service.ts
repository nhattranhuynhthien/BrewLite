import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ToppingsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.topping.findMany({ orderBy: { id: 'asc' } });
  }
}
