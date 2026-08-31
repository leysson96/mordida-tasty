import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertAddressDto } from './dto/address.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

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
