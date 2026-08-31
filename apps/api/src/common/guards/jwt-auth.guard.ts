import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Role } from "@prisma/client";
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

  const prefersAdmin = request.path.startsWith("/admin");
  const cookieNames = prefersAdmin
    ? [ADMIN_SESSION_COOKIE, CLIENT_SESSION_COOKIE]
    : [CLIENT_SESSION_COOKIE, ADMIN_SESSION_COOKIE];

  return cookieNames.flatMap((cookieName) => {
    const token = cookies[cookieName];
    return token ? [token] : [];
  });
}

async function activeUserFromPayload(
  prisma: PrismaService,
  payload: JwtPayload,
) {
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      email: true,
      role: true,
      active: true,
    },
  });

  if (!user?.active) {
    return undefined;
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role,
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
