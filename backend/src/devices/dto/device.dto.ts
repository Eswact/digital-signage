import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

/** Android'in her bağlantı öncesi kendini kaydetmesi (auth gerektirmez, idempotent). */
export class RegisterDeviceDto {
  @IsString()
  @Length(4, 64)
  deviceId: string;

  /** Önceki kayıtta alınan gizli anahtar (ilk kayıtta yok). */
  @IsOptional()
  @IsString()
  @Length(16, 128)
  secret?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  appVersion?: number;

  @IsOptional()
  @IsString()
  appVersionName?: string;

  /** Desteklenen şablonlar ve şema sürümleri, ör. { "order-board": 1 }. */
  @IsOptional()
  @IsObject()
  templates?: Record<string, number>;
}

/** Panelden Device ID girilerek eşleştirme (auth gerektirir). */
export class PairDeviceDto {
  @IsString()
  @Length(4, 64)
  deviceId: string;

  @IsOptional()
  @IsString()
  name?: string;
}

export class UpdateDeviceDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUUID()
  groupId?: string | null;
}

export class AssignScreenDto {
  @IsUUID()
  screenId: string;
}
