import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  const prisma = {
    product: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };
  let service: ProductsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<ProductsService>(ProductsService);
  });

  it('returns available products ordered by id', async () => {
    prisma.product.findMany.mockResolvedValue([]);

    await service.findAll();

    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: { isAvailable: true },
      orderBy: { id: 'asc' },
    });
  });

  it('filters available products by category', async () => {
    prisma.product.findMany.mockResolvedValue([]);

    await service.findAll('coffee');

    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: { isAvailable: true, category: 'coffee' },
      orderBy: { id: 'asc' },
    });
  });

  it('returns one available product by id', async () => {
    const product = { id: 1, name: 'Cà phê', isAvailable: true };
    prisma.product.findFirst.mockResolvedValue(product);

    await expect(service.findOne(1)).resolves.toBe(product);
    expect(prisma.product.findFirst).toHaveBeenCalledWith({
      where: { id: 1, isAvailable: true },
    });
  });

  it('throws NotFoundException for an unavailable or unknown product', async () => {
    prisma.product.findFirst.mockResolvedValue(null);

    await expect(service.findOne(9999)).rejects.toThrow(NotFoundException);
  });
});
