import { Controller, Get, Param } from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('menu')
  listMenu() {
    return this.productsService.listMenu();
  }

  @Get('products/:slug')
  getProduct(@Param('slug') slug: string) {
    return this.productsService.getProductBySlug(slug);
  }
}
