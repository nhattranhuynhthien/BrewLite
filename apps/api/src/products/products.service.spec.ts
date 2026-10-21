import { NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  let service: ProductsService;

  beforeEach(() => {
    service = new ProductsService();
  });

  it('returns all products', () => {
    const products = service.findAll();

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

  it('returns one product by id', () => {
    expect(service.findOne(1).id).toBe(1);
  });

  it('throws NotFoundException for an unknown id', () => {
    expect(() => service.findOne(9999)).toThrow(NotFoundException);
  });
});
