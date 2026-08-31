import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DataDeletionRequestDto } from './dto/data-deletion-request.dto';

@Injectable()
export class PrivacyService {
  constructor(private readonly prisma: PrismaService) {}

  createDataDeletionRequest(dto: DataDeletionRequestDto) {
    return this.prisma.dataDeletionRequest.create({
      data: {
        email: dto.email.toLowerCase().trim(),
        message: dto.message?.trim()
      }
    });
  }
}
