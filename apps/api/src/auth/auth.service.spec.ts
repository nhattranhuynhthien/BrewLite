import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  const prisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };
  const jwtService = { signAsync: jest.fn() };

  beforeEach(async () => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns a token and safe account details after login', async () => {
    const passwordHash = await bcrypt.hash('password', 10);
    prisma.user.findUnique.mockResolvedValue({
      id: 8,
      email: 'customer@example.com',
      name: 'Customer',
      password: passwordHash,
      rewardPoints: 3,
    });
    jwtService.signAsync.mockResolvedValue('signed-token');

    await expect(
      service.login({ email: 'CUSTOMER@example.com', password: 'password' }),
    ).resolves.toEqual({
        message: 'Đăng nhập thành công',
        accessToken: 'signed-token',
        user: { id: 8, name: 'Customer', email: 'customer@example.com', rewardPoints: 3 },
      });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'customer@example.com' } });
  });
});
