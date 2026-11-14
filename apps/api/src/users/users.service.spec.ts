import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  let service: UsersService;
  const prisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns a profile without the password field', async () => {
    const profile = { id: 2, name: 'Customer', email: 'customer@example.com', rewardPoints: 4 };
    prisma.user.findUnique.mockResolvedValue(profile);

    await expect(service.findOne(2)).resolves.toBe(profile);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 2 },
      select: { id: true, name: true, email: true, rewardPoints: true, createdAt: true },
    });
  });
});
