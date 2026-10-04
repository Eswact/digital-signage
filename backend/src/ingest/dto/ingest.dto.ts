import {
  IsArray,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class AddOrderDto {
  /** Dış sistemdeki sipariş kimliği (opsiyonel; yoksa üretilir). */
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MinLength(1)
  code: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsString()
  @MinLength(1)
  columnId: string;
}

export class UpdateOrderDto {
  @IsOptional()
  @IsString()
  columnId?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  label?: string;
}

export class ReplaceOrdersDto {
  @IsArray()
  orders: Array<{
    id?: string;
    code: string;
    label?: string;
    columnId: string;
  }>;
}

export class CreateApiKeyDto {
  @IsString()
  @MinLength(1)
  name: string;
}
