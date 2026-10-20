import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service'; // Import Prisma

@Injectable()
export class UsersService {
  // Nhúng Prisma vào thông qua constructor
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    // Đoạn code này sẽ thực sự lưu dữ liệu xuống PostgreSQL
    const newUser = await this.prisma.user.create({
      data: createUserDto,
    });
    
    // Trả về dữ liệu người dùng vừa tạo (bao gồm cả id)
    return newUser; 
  }

  // --- HÀM LẤY DỮ LIỆU THẬT ---
  findAll() {
    // Gọi thẳng vào bảng User trong PostgreSQL để lấy toàn bộ danh sách
    return this.prisma.user.findMany(); 
  }

  findOne(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}