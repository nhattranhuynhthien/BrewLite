import { Controller, Get, Post, Body, Param, UseGuards, Req, ParseIntPipe } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @UseGuards(AuthGuard)
  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(request.user.sub, createOrderDto);
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
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.ordersService.findForUser(id, request.user.sub);
  }
}