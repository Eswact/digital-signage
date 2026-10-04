import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { UserRole } from '../user.entity';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['superadmin', 'user'])
  role?: UserRole;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['superadmin', 'user'])
  role?: UserRole;

  /** Verilirse parola sıfırlanır. */
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}
