import { Body, Controller, Post, Req } from "@nestjs/common";
import { SkipThrottle, Throttle } from "@nestjs/throttler";
import { Request } from "express";
import { CreateCheckoutSessionDto } from "./dto/create-checkout-session.dto";
import { PaymentsService } from "./payments.service";

@Controller("payments")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post("checkout")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  createCheckoutSession(@Body() dto: CreateCheckoutSessionDto) {
    return this.paymentsService.createCheckoutSession(dto);
  }

  @Post("webhook")
  @SkipThrottle()
  handleWebhook(@Req() request: Request & { rawBody?: Buffer }) {
    return this.paymentsService.handleWebhook(request);
  }
}
