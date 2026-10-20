import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { ADMIN_ENROLLMENT_COOKIE } from '../../auth/auth-cookies';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

@Injectable()
export class AdminTwoFactorGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();

    if (
      request.user?.role !== Role.ADMIN &&
      request.user?.role !== Role.KITCHEN
    ) {
      throw new ForbiddenException('Esta ruta requiere una cuenta interna.');
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

@Injectable()
export class TwoFactorEnrollmentGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const token = request.cookies?.[ADMIN_ENROLLMENT_COOKIE];
    if (!token) {
      throw new ForbiddenException('El enrolamiento 2FA ha caducado.');
    }

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        email: string;
        role: Role;
        purpose?: string;
      }>(token);
      if (
        payload.purpose !== '2fa-enrollment' ||
        (payload.role !== Role.ADMIN && payload.role !== Role.KITCHEN)
      ) {
        throw new Error('Invalid enrollment purpose.');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          role: true,
          active: true,
          twoFactorEnabled: true,
        },
      });
      if (
        !user?.active ||
        user.twoFactorEnabled ||
        user.email !== payload.email ||
        user.role !== payload.role
      ) {
        throw new Error('Enrollment user is not eligible.');
      }

      request.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        authPurpose: '2fa-enrollment',
      };
      return true;
    } catch {
      throw new ForbiddenException('El enrolamiento 2FA no es valido.');
    }
  }
}
