import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AuthSessionScope, Role } from "@prisma/client";
import { Request } from "express";
import {
  ADMIN_SESSION_COOKIE,
  CLIENT_SESSION_COOKIE,
} from "../../auth/auth-cookies";
import { AuthenticatedUser } from "../decorators/current-user.decorator";
import { PrismaService } from "../../prisma/prisma.service";

interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  sid?: string;
}

function readBearerToken(request: Request) {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return undefined;
  }

  return header.slice("Bearer ".length).trim();
}

function readCookieTokens(request: Request) {
  const cookies = (request as Request & { cookies?: Record<string, string> })
    .cookies;
  if (!cookies) {
    return [];
  }

  const cookieNames = request.path.startsWith("/admin")
    ? [ADMIN_SESSION_COOKIE]
    : [CLIENT_SESSION_COOKIE];

  return cookieNames.flatMap((cookieName) => {
    const token = cookies[cookieName];
    return token ? [token] : [];
  });
}

async function activeUserFromPayload(
  prisma: PrismaService,
  payload: JwtPayload,
) {
  if (!payload.sid) {
    return undefined;
  }

  const session = await prisma.authSession.findUnique({
    where: { id: payload.sid },
    select: {
      id: true,
      userId: true,
      scope: true,
      expiresAt: true,
      absoluteExpiresAt: true,
      revokedAt: true,
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          active: true,
        },
      },
    },
  });

  if (
    !session ||
    session.userId !== payload.sub ||
    session.revokedAt ||
    session.expiresAt <= new Date() ||
    session.absoluteExpiresAt <= new Date() ||
    !session.user.active ||
    session.user.email !== payload.email ||
    session.user.role !== payload.role ||
    session.scope !==
      (payload.role === Role.CLIENTE
        ? AuthSessionScope.CUSTOMER
        : AuthSessionScope.STAFF)
  ) {
    return undefined;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    role: session.user.role,
    sessionId: session.id,
    authPurpose: "session",
  } satisfies AuthenticatedUser;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const bearerToken = readBearerToken(request);
    const tokens = bearerToken
      ? [bearerToken, ...readCookieTokens(request)]
      : readCookieTokens(request);

    if (tokens.length === 0) {
      throw new UnauthorizedException("Authentication token is required.");
    }

    for (const token of tokens) {
      try {
        const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
        request.user = await activeUserFromPayload(this.prisma, payload);
        if (!request.user) {
          continue;
        }
        return true;
      } catch {
        request.user = undefined;
      }
    }

    throw new UnauthorizedException("Invalid or expired authentication token.");
  }
}

@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const bearerToken = readBearerToken(request);
    const tokens = bearerToken
      ? [bearerToken, ...readCookieTokens(request)]
      : readCookieTokens(request);

    if (tokens.length === 0) {
      return true;
    }

    for (const token of tokens) {
      try {
        const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
        request.user = await activeUserFromPayload(this.prisma, payload);
        if (!request.user) {
          continue;
        }
        break;
      } catch {
        request.user = undefined;
      }
    }

    return true;
  }
}

@Injectable()
export class GuestOrCustomerJwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const bearerToken = readBearerToken(request);
    const tokens = bearerToken
      ? [bearerToken, ...readCookieTokens(request)]
      : readCookieTokens(request);

    if (tokens.length === 0) {
      return true;
    }

    for (const token of tokens) {
      try {
        const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
        const user = await activeUserFromPayload(this.prisma, payload);
        if (user?.role !== Role.CLIENTE) {
          continue;
        }

        request.user = user;
        return true;
      } catch {
        request.user = undefined;
      }
    }

    throw new UnauthorizedException("Invalid or expired customer session.");
  }
}
