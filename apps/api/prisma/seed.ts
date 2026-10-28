import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const products = [
    { id: 1, name: 'Cà phê sữa', price: 35000, imageUrl: '/images/ca-phe-sua.jpg', stock: 100, description: 'Đậm đà, truyền thống' },
    { id: 2, name: 'Americano', price: 40000, imageUrl: '/images/americano.jpg', stock: 100, description: 'Thanh nhẹ, dễ uống' },
    { id: 3, name: 'Cappuccino', price: 45000, imageUrl: '/images/cappuccino.jpg', stock: 100, description: 'Béo ngậy, bọt sữa thơm' },
    { id: 4, name: 'Trà đào', price: 39000, imageUrl: '/images/tra-dao.jpg', stock: 100, description: 'Chua ngọt, mát lạnh' },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { id: p.id },
      update: {
        name: p.name,
        price: p.price,
        imageUrl: p.imageUrl,
        stock: p.stock,
        description: p.description,
      },
      create: p,
    });
  }

  // Khởi tạo mã giảm giá mẫu nếu chưa có
  await prisma.promotion.upsert({
    where: { code: 'GIAM10' },
    update: {},
    create: {
      code: 'GIAM10',
      discountPct: 10,
      maxDiscount: 50000,
      usageLimit: 100,
    },
  });

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

