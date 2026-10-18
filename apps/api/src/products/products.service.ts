import { Injectable, NotFoundException } from '@nestjs/common';

export interface Product {
  id: number;
  name: string;
  price: number;
  imageUrl: string;
}

@Injectable()
export class ProductsService {
  // Dữ liệu mẫu cho Sprint 1, sau này thay bằng PostgreSQL (Prisma).
  private readonly products: Product[] = [
    { id: 1, name: 'Cà phê sữa', price: 35000, imageUrl: '/images/ca-phe-sua.jpg' },
    { id: 2, name: 'Americano', price: 40000, imageUrl: '/images/americano.jpg' },
    { id: 3, name: 'Cappuccino', price: 45000, imageUrl: '/images/cappuccino.jpg' },
    { id: 4, name: 'Trà đào', price: 39000, imageUrl: '/images/tra-dao.jpg' },
  ];

  findAll(): Product[] {
    return this.products;
  }

  findOne(id: number): Product {
    const product = this.products.find((p) => p.id === id);
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }
    return product;
  }
}
