import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnvironment } from './config/env';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { CustomersModule } from './customers/customers.module';
import { HealthModule } from './health/health.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { PrivacyModule } from './privacy/privacy.module';
import { ProductsModule } from './products/products.module';
import { SettingsModule } from './settings/settings.module';
import { OriginGuard } from './common/guards/origin.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
      validate: validateEnvironment
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120
      }
    ]),
    PrismaModule,
    SettingsModule,
    AuthModule,
    ProductsModule,
    CustomersModule,
    OrdersModule,
    PaymentsModule,
    AdminModule,
    PrivacyModule,
    HealthModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: OriginGuard
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    }
  ]
})
export class AppModule {}
