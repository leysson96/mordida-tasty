import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, Role } from "@prisma/client";
import * as argon2 from "argon2";
import { AuthService } from "../auth/auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateStaffUserDto, UpdateStaffUserDto } from "./dto/staff.dto";

const staffRoles = [Role.ADMIN, Role.KITCHEN] as const;

const staffUserSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  role: true,
  active: true,
  disabledAt: true,
  emailVerifiedAt: true,
  twoFactorEnabled: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type StaffUser = Prisma.UserGetPayload<{
  select: typeof staffUserSelect;
}>;

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  listStaff(role?: Role) {
    if (role) {
      this.assertStaffRole(role);
    }

    return this.prisma.user.findMany({
      where: {
        role: role ?? { in: [...staffRoles] },
      },
      orderBy: [{ active: "desc" }, { role: "asc" }, { createdAt: "desc" }],
      select: staffUserSelect,
    });
  }

  async createStaff(dto: CreateStaffUserDto) {
    this.assertStaffRole(dto.role);
    const email = normalizeEmail(dto.email);
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException("Email is already registered.");
    }

    return this.prisma.user.create({
      data: {
        email,
        name: dto.name.trim(),
        phone: cleanOptional(dto.phone),
        role: dto.role,
        active: true,
        disabledAt: null,
        emailVerifiedAt: new Date(),
        passwordHash: await argon2.hash(dto.password),
      },
      select: staffUserSelect,
    });
  }

  async updateStaff(id: string, dto: UpdateStaffUserDto) {
    const staff = await this.findStaffOrThrow(id);
    const nextRole = dto.role ?? staff.role;
    this.assertStaffRole(nextRole);

    if (staff.role === Role.ADMIN && staff.active && nextRole !== Role.ADMIN) {
      await this.assertAnotherActiveAdminExists(staff.id);
    }

    const data: Prisma.UserUpdateInput = {};

    if (dto.email !== undefined) {
      const email = normalizeEmail(dto.email);
      if (email !== staff.email) {
        const existing = await this.prisma.user.findUnique({
          where: { email },
          select: { id: true },
        });
        if (existing) {
          throw new ConflictException("Email is already registered.");
        }
        data.email = email;
      }
    }

    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }

    if (dto.phone !== undefined) {
      data.phone = cleanOptional(dto.phone);
    }

    if (dto.role !== undefined) {
      data.role = dto.role;
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: staffUserSelect,
    });
  }

  async setStaffActive(input: {
    actorId: string;
    staffId: string;
    active: boolean;
  }) {
    const staff = await this.findStaffOrThrow(input.staffId);

    if (!input.active) {
      if (input.actorId === staff.id) {
        throw new BadRequestException(
          "No puedes desactivar tu propio usuario.",
        );
      }

      if (staff.role === Role.ADMIN && staff.active) {
        await this.assertAnotherActiveAdminExists(staff.id);
      }
    }

    return this.prisma.user.update({
      where: { id: staff.id },
      data: {
        active: input.active,
        disabledAt: input.active ? null : new Date(),
      },
      select: staffUserSelect,
    });
  }

  async resetTwoFactor(staffId: string) {
    await this.findStaffOrThrow(staffId);

    return this.prisma.user.update({
      where: { id: staffId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
      select: staffUserSelect,
    });
  }

  async requestPasswordReset(staffId: string) {
    const staff = await this.findStaffOrThrow(staffId);
    if (!staff.active) {
      throw new BadRequestException(
        "No se puede enviar recuperacion a un usuario desactivado.",
      );
    }

    return this.authService.requestPasswordReset({ email: staff.email });
  }

  private async findStaffOrThrow(id: string) {
    const staff = await this.prisma.user.findFirst({
      where: {
        id,
        role: { in: [...staffRoles] },
      },
      select: staffUserSelect,
    });

    if (!staff) {
      throw new NotFoundException("Staff user not found.");
    }

    return staff;
  }

  private assertStaffRole(
    role: Role,
  ): asserts role is (typeof staffRoles)[number] {
    if (!staffRoles.includes(role as (typeof staffRoles)[number])) {
      throw new BadRequestException("Role must be ADMIN or KITCHEN.");
    }
  }

  private async assertAnotherActiveAdminExists(userId: string) {
    const activeAdmins = await this.prisma.user.count({
      where: {
        id: { not: userId },
        role: Role.ADMIN,
        active: true,
      },
    });

    if (activeAdmins === 0) {
      throw new BadRequestException("Debe quedar al menos un admin activo.");
    }
  }
}

function normalizeEmail(email: string) {
  return email.toLowerCase().trim();
}

function cleanOptional(value?: string) {
  const clean = value?.trim();
  return clean || null;
}
