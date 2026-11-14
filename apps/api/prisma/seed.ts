import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Product catalog is managed by migrations; demo seed never overwrites it.
  // Đảm bảo cập nhật các đường dẫn ảnh cũ nếu có trong CSDL
  await prisma.product.updateMany({
    where: { imageUrl: '/images/ca-phe-sua.jpg' },
    data: { imageUrl: '/img/menu/ca-phe-sua-da.png' },
  });
  await prisma.product.updateMany({
    where: { imageUrl: '/images/americano.jpg' },
    data: { imageUrl: '/img/menu/americano.png' },
  });
  await prisma.product.updateMany({
    where: { imageUrl: '/images/cappuccino.jpg' },
    data: { imageUrl: '/img/menu/cappuccino.png' },
  });
  await prisma.product.updateMany({
    where: { imageUrl: '/images/tra-dao.jpg' },
    data: { imageUrl: '/img/menu/tra-dao.png' },
  });

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

  // Khởi tạo dữ liệu Topping
  console.log('Bắt đầu tạo dữ liệu Topping...');
  const toppingsData = [
    { id: 1, name: 'Trân châu đen', price: 5000 },
    { id: 2, name: 'Trân châu trắng', price: 5000 },
    { id: 3, name: 'Thạch trái cây', price: 8000 },
    { id: 4, name: 'Kem phô mai (Macchiato)', price: 10000 },
    { id: 5, name: 'Pudding trứng', price: 7000 },
    { id: 6, name: 'Thạch sương sáo', price: 5000 },
    { id: 7, name: 'Thạch dừa', price: 5000 },
  ];

  for (const topping of toppingsData) {
    await prisma.topping.upsert({
      where: { id: topping.id },
      update: {},
      create: topping,
    });
  }

  for (const table of ['Product', 'Topping']) {
    await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1))`);
  }
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
