import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthenticatedRequest, AuthenticatedUser } from './authenticated-request';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractTokenFromHeader(request);
    
    if (!token) {
      throw new UnauthorizedException('Bạn chưa đăng nhập (Thiếu Token)');
    }
    try {
      // Xác thực token và gắn thông tin giải mã được vào request.user
      const payload = await this.jwtService.verifyAsync<AuthenticatedUser>(token, {
        secret: 'BREWLITE_SECRET_KEY_2026'
      });
      if (typeof payload.sub !== 'number' || typeof payload.email !== 'string') {
        throw new UnauthorizedException('Token không chứa danh tính người dùng hợp lệ');
      }
      request.user = payload;
    } catch {
      throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn');
    }
    return true;
  }

  private extractTokenFromHeader(request: AuthenticatedRequest): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}