import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { UpsertAddressDto } from './dto/address.dto';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  listAddresses(userId: string) {
    return this.prisma.customerAddress.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }]
    });
  }

  async createAddress(userId: string, dto: UpsertAddressDto) {
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.customerAddress.updateMany({
          where: { userId },
          data: { isDefault: false }
        });
      }

      return tx.customerAddress.create({
        data: {
          ...this.addressData(dto),
          userId,
          isDefault: dto.isDefault ?? false
        }
      });
    });
  }

  async updateAddress(userId: string, addressId: string, dto: UpsertAddressDto) {
    await this.ensureOwnedAddress(userId, addressId);

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.customerAddress.updateMany({
          where: { userId },
          data: { isDefault: false }
        });
      }

      return tx.customerAddress.update({
        where: { id: addressId },
        data: {
          ...this.addressData(dto),
          isDefault: dto.isDefault ?? false
        }
      });
    });
  }

  async deleteAddress(userId: string, addressId: string) {
    await this.ensureOwnedAddress(userId, addressId);
    await this.prisma.customerAddress.delete({ where: { id: addressId } });
    return { ok: true };
  }

  async getLoyaltyProgress(userId: string) {
    const [program, completedOrders] = await Promise.all([
      this.settingsService.getLoyaltyProgram(),
      this.prisma.order.count({
        where: {
          userId,
          status: OrderStatus.DELIVERED,
        },
      }),
    ]);
    const rawProgress = completedOrders % program.goalOrders;
    const rewardReady = program.enabled && completedOrders >= program.goalOrders;
    const progressOrders =
      rawProgress === 0 && completedOrders > 0 ? program.goalOrders : rawProgress;
    const progressPercent = program.enabled
      ? Math.round((progressOrders / program.goalOrders) * 100)
      : 0;

    return {
      program,
      completedOrders,
      progressOrders: program.enabled ? progressOrders : 0,
      progressPercent,
      ordersRemaining:
        program.enabled && !rewardReady
          ? Math.max(0, program.goalOrders - progressOrders)
          : 0,
      earnedRewards: program.enabled
        ? Math.floor(completedOrders / program.goalOrders)
        : 0,
      rewardReady,
      rewardLabel:
        program.rewardType === "DISCOUNT_PERCENT"
          ? `${program.discountPercent}% de descuento`
          : program.freeProductName,
    };
  }

  private async ensureOwnedAddress(userId: string, addressId: string) {
    const address = await this.prisma.customerAddress.findFirst({
      where: { id: addressId, userId }
    });

    if (!address) {
      throw new NotFoundException('Address not found.');
    }

    return address;
  }

  private addressData(dto: UpsertAddressDto) {
    return {
      label: dto.label.trim(),
      recipientName: dto.recipientName.trim(),
      phone: dto.phone.trim(),
      street: dto.street.trim(),
      city: dto.city.trim(),
      postalCode: dto.postalCode.trim(),
      notes: dto.notes?.trim()
    };
  }
}
