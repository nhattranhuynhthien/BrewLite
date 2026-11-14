import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  findMe(@Req() request: AuthenticatedRequest) {
    return this.usersService.findOne(request.user.sub);
  }

  @Patch('me')
  updateMe(@Req() request: AuthenticatedRequest, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(request.user.sub, updateUserDto);
  }
}
