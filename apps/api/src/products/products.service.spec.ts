import { NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  let service: ProductsService;

  beforeEach(() => {
    service = new ProductsService();
  });

  it('returns all products', () => {
    expect(service.findAll().length).toBeGreaterThan(0);
  });

  it('returns one product by id', () => {
    expect(service.findOne(1).id).toBe(1);
  });

  it('throws NotFoundException for an unknown id', () => {
    expect(() => service.findOne(9999)).toThrow(NotFoundException);
  });
});
