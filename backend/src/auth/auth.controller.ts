import { Body, Controller, Get, Headers, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { LIMITS } from '../common/throttle';
import { AuthService } from './auth.service';
import {
  AcceptInvitationDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
  ResetPasswordDto,
  SwitchOrgDto,
  TwoFactorCodeDto,
  TwoFactorDisableDto,
  TwoFactorLoginDto,
  TokenDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { OptionalJwtAuthGuard } from './optional-jwt.guard';
import { AuthUser, CurrentUser } from './current-user.decorator';

const meta = (userAgent?: string) => ({ userAgent });

@UseGuards(ThrottlerGuard)
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** İlk kurulum mu? (hiç kullanıcı yok → panel "ilk yöneticiyi oluştur" gösterir) */
  @Get('setup')
  setup() {
    return this.auth.setupStatus();
  }

  @Throttle(LIMITS.login)
  @Post('register')
  register(@Body() dto: RegisterDto, @Headers('user-agent') ua?: string) {
    return this.auth.register(dto, meta(ua));
  }

  @Throttle(LIMITS.login)
  @Post('login')
  login(@Body() dto: LoginDto, @Headers('user-agent') ua?: string) {
    return this.auth.login(dto, meta(ua));
  }

  /** 2FA etkin hesapta ikinci adım: TOTP ya da kurtarma kodu. */
  @Throttle(LIMITS.login)
  @Post('login/2fa')
  loginTwoFactor(@Body() dto: TwoFactorLoginDto, @Headers('user-agent') ua?: string) {
    return this.auth.loginTwoFactor(dto.challenge, dto.code, meta(ua));
  }

  @Throttle(LIMITS.refresh)
  @Post('refresh')
  refresh(@Body() dto: RefreshDto, @Headers('user-agent') ua?: string) {
    return this.auth.refresh(dto.refreshToken, meta(ua));
  }

  @Throttle(LIMITS.refresh)
  @Post('switch-org')
  switchOrg(@Body() dto: SwitchOrgDto, @Headers('user-agent') ua?: string) {
    return this.auth.switchOrg(dto.refreshToken, dto.organizationId, meta(ua));
  }

  @Post('logout')
  async logout(@Body() dto: RefreshDto) {
    await this.auth.logout(dto.refreshToken);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  async logoutAll(@CurrentUser() user: AuthUser) {
    await this.auth.logoutAll(user.id);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user);
  }

  // --- Parola ---

  @Throttle(LIMITS.sensitive)
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.auth.forgotPassword(dto.email);
    return { ok: true };
  }

  @Throttle(LIMITS.sensitive)
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.auth.resetPassword(dto.token, dto.password);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Throttle(LIMITS.sensitive)
  @Post('change-password')
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Headers('user-agent') ua?: string,
  ) {
    return this.auth.changePassword(user, dto.currentPassword, dto.newPassword, meta(ua));
  }

  // --- Davet ---

  @Throttle(LIMITS.sensitive)
  @Post('invitation/info')
  invitationInfo(@Body() dto: TokenDto) {
    return this.auth.invitationInfo(dto.token);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Throttle(LIMITS.sensitive)
  @Post('invitation/accept')
  acceptInvitation(
    @Body() dto: AcceptInvitationDto,
    @CurrentUser() user: AuthUser | null,
    @Headers('user-agent') ua?: string,
  ) {
    return this.auth.acceptInvitation(dto, user, meta(ua));
  }

  // --- 2FA ---

  @UseGuards(JwtAuthGuard)
  @Post('2fa/setup')
  twoFactorSetup(@CurrentUser() user: AuthUser) {
    return this.auth.twoFactorSetup(user);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle(LIMITS.sensitive)
  @Post('2fa/enable')
  twoFactorEnable(@CurrentUser() user: AuthUser, @Body() dto: TwoFactorCodeDto) {
    return this.auth.twoFactorEnable(user, dto.code);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle(LIMITS.sensitive)
  @Post('2fa/disable')
  async twoFactorDisable(@CurrentUser() user: AuthUser, @Body() dto: TwoFactorDisableDto) {
    await this.auth.twoFactorDisable(user, dto.password, dto.code);
    return { ok: true };
  }
}
