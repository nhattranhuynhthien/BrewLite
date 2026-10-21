import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'; // Bổ sung thư viện Swagger
import { AuthGuard } from '../auth/auth.guard'; // Bổ sung Guard bảo vệ
import { AuthenticatedRequest } from '../auth/authenticated-request';

@ApiTags('Orders') // Nhóm vào mục Orders trên Swagger
@ApiBearerAuth()   // Hiện biểu tượng ổ khóa cho các API trong file này
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @UseGuards(AuthGuard) // Chặn API này, ai có Token mới được vào
  @Post()
  create(@Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(createOrderDto);
  }

  @UseGuards(AuthGuard)
  @Get('me')
  findMine(@Req() request: AuthenticatedRequest) {
    return this.ordersService.findByUser(request.user.sub);
  }

  @Get()
  findAll() {
    return this.ordersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(+id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateOrderDto: UpdateOrderDto,
  ) {
    return this.ordersService.update(id, updateOrderDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ordersService.remove(+id);
  }
}