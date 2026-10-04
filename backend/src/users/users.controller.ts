import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { User } from './user.entity';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { OrganizationsService } from '../organizations/organizations.service';

/** Parola hash'ini asla dışarı sızdırma. */
function toPublic(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    role: user.role,
    createdAt: user.createdAt,
  };
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('superadmin')
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly orgs: OrganizationsService,
  ) {}

  @Get()
  async list() {
    const list = await this.users.list();
    return list.map(toPublic);
  }

  @Post()
  async create(@Body() dto: CreateUserDto) {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) throw new ConflictException('This email is already registered');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.users.create({
      email: dto.email,
      passwordHash,
      name: dto.name,
      role: dto.role ?? 'user',
    });
    // Her hesap kendi kişisel organizasyonuyla başlar (sahibi kendisi).
    await this.orgs.createPersonalOrg(user);
    return toPublic(user);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundException('User not found');

    // Son superadmin'i user'a düşürme (kendini de dahil) engellenir.
    if (dto.role === 'user' && user.role === 'superadmin') {
      const supers = await this.users.countSuperadmins();
      if (supers <= 1) {
        throw new BadRequestException('The last administrator cannot be demoted');
      }
    }

    const passwordHash = dto.password
      ? await bcrypt.hash(dto.password, 10)
      : undefined;
    const updated = await this.users.updateProfile(id, {
      name: dto.name,
      role: dto.role,
      passwordHash,
    });
    // A password set by an admin must end the sessions opened with the old one.
    if (passwordHash) await this.users.revokeSessions(id);
    return toPublic(updated!);
  }

  @Delete(':id')
  async remove(@CurrentUser() current: AuthUser, @Param('id') id: string) {
    if (current.id === id) {
      throw new ForbiddenException('You cannot delete yourself');
    }
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundException('User not found');
    if (user.role === 'superadmin') {
      const supers = await this.users.countSuperadmins();
      if (supers <= 1) {
        throw new BadRequestException('The last administrator cannot be deleted');
      }
    }
    // Tek üyesi olduğu organizasyonlar silinir; başkalarıyla paylaşılan
    // organizasyonun tek sahibiyse önce sahiplik devredilmeli (hata).
    await this.orgs.handleUserDeletion(id);
    await this.users.remove(id);
    return { ok: true };
  }
}
