import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

@Injectable()
export class AdminTwoFactorGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();

    if (request.user?.role !== Role.ADMIN) {
      return true;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: request.user.id },
      select: { twoFactorEnabled: true }
    });

    if (!user?.twoFactorEnabled) {
      throw new ForbiddenException('Debes activar 2FA para usar el panel de administrador.');
    }

    return true;
  }
}
