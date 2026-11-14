import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { jwtOptions } from './jwt.config';

@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      useFactory: () => jwtOptions(),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
