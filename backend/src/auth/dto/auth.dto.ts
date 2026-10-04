import { IsEmail, IsOptional, IsString, Length, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsString()
  name?: string;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

export class TwoFactorLoginDto {
  @IsString()
  challenge: string;

  /** 6 haneli TOTP kodu ya da kurtarma kodu. */
  @IsString()
  @Length(6, 32)
  code: string;
}

export class RefreshDto {
  @IsString()
  @Length(20, 200)
  refreshToken: string;
}

export class SwitchOrgDto extends RefreshDto {
  @IsString()
  organizationId: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8)
  password: string;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class AcceptInvitationDto {
  @IsString()
  token: string;

  /** Hesabı olmayan davetli için zorunlu. */
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsString()
  name?: string;
}

export class TwoFactorCodeDto {
  @IsString()
  @Length(6, 32)
  code: string;
}

export class TwoFactorDisableDto extends TwoFactorCodeDto {
  @IsString()
  password: string;
}

export class TokenDto {
  @IsString()
  token: string;
}
