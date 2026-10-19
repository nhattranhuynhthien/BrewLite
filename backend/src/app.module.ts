import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PaymentsModule } from './payments/payments.module';
import { Product } from './payments/product.entity';
import { ProcPaymentKeyEntity } from './payments/procpayment-key.entity';

@Module({
  imports: [
    // 1. Khởi tạo kết nối PostgreSQL ở cấp độ toàn cục ứng dụng
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',     // Thay bằng username DB của bạn
      password: '123456', // Thay bằng password DB của bạn
      database: 'brewlite',     // Thay bằng tên database của bạn
      entities: [Product, ProcPaymentKeyEntity], // Khai báo các entity ở đây
      synchronize: true,        // Tự động tạo bảng (chỉ dùng khi dev)
    }),
    // 2. Module thanh toán
    PaymentsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
