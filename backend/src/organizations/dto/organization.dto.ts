import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ORG_ROLES, OrgRole } from '../membership.entity';

export class RenameOrgDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  /** IANA time zone, e.g. "Europe/Istanbul". */
  @IsOptional()
  @IsString()
  timezone?: string;
}

export class InviteDto {
  @IsEmail()
  email: string;

  @IsIn(ORG_ROLES)
  role: OrgRole;
}

export class SetRoleDto {
  @IsIn(ORG_ROLES)
  role: OrgRole;
}

/** Limit alanları: yoksa üst katmandaki (platform) değer geçerli kalır. */
export class LimitsDto {
  @IsOptional() @IsInt() @Min(0) @Max(100000) maxScreens?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100000) maxDevices?: number;
  @IsOptional() @IsInt() @Min(1) @Max(10000) maxMembers?: number;
  @IsOptional() @IsInt() @Min(0) @Max(10_000_000) storageQuotaMb?: number;
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000) maxMediaFiles?: number;
  @IsOptional() @IsInt() @Min(1) @Max(86_400) maxVideoSeconds?: number;
  @IsOptional() @IsInt() @Min(1) @Max(100_000) maxUploadMb?: number;
}

export class AdminUpdateOrgDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsString() plan?: string;

  /** null → organizasyon istisnalarını temizle (platform varsayılanına dön). */
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => LimitsDto)
  limits?: LimitsDto | null;
}
