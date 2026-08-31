import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: {
    actorId?: string;
    action: string;
    entity: string;
    entityId?: string;
    metadata?: Prisma.InputJsonValue;
    ip?: string;
    userAgent?: string;
  }) {
    return this.prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        metadata: input.metadata ?? Prisma.JsonNull,
        ip: input.ip,
        userAgent: input.userAgent
      }
    });
  }
}
