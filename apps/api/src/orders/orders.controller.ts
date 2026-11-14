import { IntIdPipe } from '../common/int-id.pipe';
import { Controller, Get, Post, Patch, Body, Param, UseGuards, Req, Headers } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { OrderOperatorGuard } from './order-operator.guard';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @UseGuards(AuthGuard)
  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() createOrderDto: CreateOrderDto, @Headers('idempotency-key') key?: string) {
    return this.ordersService.create(request.user.sub, createOrderDto, key);
  }

  @UseGuards(AuthGuard)
  @Get('me')
  findMine(@Req() request: AuthenticatedRequest) {
    return this.ordersService.findByUser(request.user.sub);
  }

  @UseGuards(AuthGuard)
  @Get(':id')
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('id', IntIdPipe) id: number,
  ) {
    return this.ordersService.findForUser(id, request.user.sub);
  }

  @UseGuards(AuthGuard)
  @Patch(':id/cancel')
  cancel(
    @Param('id', IntIdPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.ordersService.cancel(id, request.user.sub);
  }

  @UseGuards(AuthGuard, OrderOperatorGuard)
  @Patch(':id/status')
  updateStatus(@Param('id', IntIdPipe) id: number, @Body() body: UpdateOrderStatusDto) {
    return this.ordersService.update(id, body);
  }
}
