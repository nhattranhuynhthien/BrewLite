import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(category?: string) {
    return this.prisma.product.findMany({
      where: {
        isAvailable: true,
        ...(category ? { category } : {}),
      },
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number) {
    const product = await this.prisma.product.findFirst({
      where: { id, isAvailable: true },
    });
    if (!product) throw new NotFoundException(`Không tìm thấy sản phẩm ${id}`);
    return product;
  }
}
