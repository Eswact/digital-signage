import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { ScheduleTarget } from '../schedule.entity';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateScheduleDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsIn(['device', 'group'])
  targetType: ScheduleTarget;

  @IsUUID()
  targetId: string;

  @IsUUID()
  screenId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  @Type(() => Number)
  days: number[];

  /** "HH:mm". Send both start and end, or neither for an all-day schedule. */
  @IsOptional()
  @Matches(TIME)
  startTime?: string | null;

  @IsOptional()
  @Matches(TIME)
  endTime?: string | null;

  @IsOptional()
  @IsInt()
  @Min(-100)
  @Max(100)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateScheduleDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsIn(['device', 'group']) targetType?: ScheduleTarget;
  @IsOptional() @IsUUID() targetId?: string;
  @IsOptional() @IsUUID() screenId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  @Type(() => Number)
  days?: number[];

  @IsOptional() @Matches(TIME) startTime?: string | null;
  @IsOptional() @Matches(TIME) endTime?: string | null;
  @IsOptional() @IsInt() @Min(-100) @Max(100) priority?: number;
  @IsOptional() @IsBoolean() enabled?: boolean;
}
