import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const users = [
    { email: 'admin@brewlite.com', name: 'Admin', password: 'Admin@123', role: Role.ADMIN },
    { email: 'staff@brewlite.com', name: 'Nhân viên quầy', password: 'Staff@123', role: Role.STAFF },
    { email: 'khach@brewlite.com', name: 'Khách Hàng', password: 'Khach@123', role: Role.CUSTOMER },
  ];

  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        name: u.name,
        password: passwordHash,
        role: u.role,
      },
    });
    console.log(`✔ ${u.role}: ${u.email}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());