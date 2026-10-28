import { NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ProductsService', () => {
  let service: ProductsService;
  let mockPrisma: any;

  const sampleProducts = [
    {
      id: 1,
      name: 'Cà phê sữa',
      price: 35000,
      imageUrl: '/images/ca-phe-sua.jpg',
      description: null,
      stock: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(() => {
    mockPrisma = {
      product: {
        findMany: jest.fn().mockResolvedValue(sampleProducts),
        findUnique: jest.fn().mockImplementation(({ where }) => {
          const found = sampleProducts.find((p) => p.id === where.id);
          return Promise.resolve(found || null);
        }),
      },
    };
    service = new ProductsService(mockPrisma as PrismaService);
  });

  it('returns all products', async () => {
    const products = await service.findAll();

    expect(products.length).toBeGreaterThan(0);
    expect(products[0]).toEqual(
      expect.objectContaining({
        id: expect.any(Number),
        name: expect.any(String),
        price: expect.any(Number),
        imageUrl: expect.any(String),
      }),
    );
  });

  it('returns one product by id', async () => {
    const product = await service.findOne(1);
    expect(product.id).toBe(1);
  });

  it('throws NotFoundException for an unknown id', async () => {
    await expect(service.findOne(9999)).rejects.toThrow(NotFoundException);
  });
});
