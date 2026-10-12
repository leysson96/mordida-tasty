import { Module } from "@nestjs/common";
import { CashTrustService } from "./cash-trust.service";

@Module({
  providers: [CashTrustService],
  exports: [CashTrustService],
})
export class CashTrustModule {}
