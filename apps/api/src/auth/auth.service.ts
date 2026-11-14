import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterDto, LoginDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  // --- HÀM ĐĂNG KÝ ---
  async register(data: RegisterDto) {
    const email = data.email.trim().toLowerCase();
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictException('Email đã được sử dụng');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    let newUser: { id: number; name: string | null; email: string; rewardPoints: number };
    try {
      newUser = await this.prisma.user.create({
        data: {
          email,
          name: data.name.trim(),
          password: hashedPassword,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Email đã được sử dụng');
      }
      throw error;
    }

    return {
      message: 'Đăng ký thành công',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        rewardPoints: newUser.rewardPoints,
      },
    };
  }

  async login(data: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: data.email.trim().toLowerCase() } });
    const isPasswordValid = user ? await bcrypt.compare(data.password, user.password) : false;
    if (!user || !isPasswordValid) throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');

    const payload = { sub: user.id, email: user.email };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      message: 'Đăng nhập thành công',
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        rewardPoints: user.rewardPoints,
      },
    };
  }

  async getProfile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, rewardPoints: true, createdAt: true },
    });
    if (!user) throw new UnauthorizedException('Tài khoản không còn tồn tại');
    return user;
  }
}