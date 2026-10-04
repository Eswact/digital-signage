import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { OrientationType, TemplateType } from '../screen.entity';

const TEMPLATE_TYPES: TemplateType[] = [
  'order-board',
  'queue-number',
  'info-board',
  'media-player',
  'webview',
];

const ORIENTATIONS: OrientationType[] = ['landscape', 'portrait', 'auto'];

export class CreateScreenDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsIn(TEMPLATE_TYPES)
  template: TemplateType;

  @IsOptional()
  @IsIn(ORIENTATIONS)
  orientation?: OrientationType;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}

export class UpdateScreenDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsIn(ORIENTATIONS)
  orientation?: OrientationType;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;

  /**
   * Kısmi güncelleme: yalnızca verilen üst seviye anahtarlar data'ya yazılır
   * (null → anahtar silinir). Panel bunu kullanır; böylece ingest ile canlı
   * akan alanlar (orders, queue…) başka bir alan düzenlenirken ezilmez.
   */
  @IsOptional()
  @IsObject()
  merge?: Record<string, unknown>;
}
