import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

/** POS'lar numarayı sıklıkla sayı olarak gönderir (42) → "42". */
const toNumberString = ({ value }: { value: unknown }) =>
  typeof value === 'number' ? String(value) : value;

export class SetCurrentDto {
  @Transform(toNumberString)
  @IsString()
  @MinLength(1)
  number: string;

  @IsOptional()
  @IsString()
  name?: string;
}

export class QueueItemDto {
  /** Dış sistemdeki kayıt kimliği (opsiyonel; yoksa üretilir). */
  @IsOptional()
  @IsString()
  id?: string;

  /** Verilmezse son numaradan bir sonraki üretilir. */
  @IsOptional()
  @Transform(toNumberString)
  @IsString()
  @MinLength(1)
  number?: string;

  @IsOptional()
  @IsString()
  name?: string;
}

export class UpdateQueueItemDto {
  @IsOptional()
  @Transform(toNumberString)
  @IsString()
  @MinLength(1)
  number?: string;

  @IsOptional()
  @IsString()
  name?: string;
}

export class ReplaceQueueDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QueueItemDto)
  items: QueueItemDto[];
}
