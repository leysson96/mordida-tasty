import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Post()
  createOrder(
    @Body() dto: CreateOrderDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentUser() user?: AuthenticatedUser
  ) {
    return this.ordersService.createOrder(dto, idempotencyKey, user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('mine')
  listMine(@CurrentUser() user: { id: string }) {
    return this.ordersService.listMine(user.id);
  }

  @Get('track/:orderNumber')
  getTracking(@Param('orderNumber') orderNumber: string, @Query('t') trackingToken?: string) {
    return this.ordersService.getPublicTracking(orderNumber, trackingToken);
  }
}
