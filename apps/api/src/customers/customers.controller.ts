import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CustomersService } from './customers.service';
import { UpsertAddressDto } from './dto/address.dto';

@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get('addresses')
  listAddresses(@CurrentUser() user: { id: string }) {
    return this.customersService.listAddresses(user.id);
  }

  @Post('addresses')
  createAddress(@CurrentUser() user: { id: string }, @Body() dto: UpsertAddressDto) {
    return this.customersService.createAddress(user.id, dto);
  }

  @Put('addresses/:id')
  updateAddress(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpsertAddressDto
  ) {
    return this.customersService.updateAddress(user.id, id, dto);
  }

  @Delete('addresses/:id')
  deleteAddress(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.customersService.deleteAddress(user.id, id);
  }
}
