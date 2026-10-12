import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterUser } from '../users/dtos/register-user.dto';
import { LoginDto } from './dtos/login.dto';
import { TwoFactorCodeDto } from './dtos/two-factor-code.dto';
import { LocalAuthGuard } from '../common/guards/local-auth.guard';
import { JwtTwoFactorGuard } from '../common/guards/jwt-two-factor.guard';
import { Auth, GetUser } from '../common/decorators';
import { User } from '../users/entities/user.entity';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Sign up as a customer and receive an access token' })
  @ApiResponse({ status: 201, description: 'User created' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  register(@Body() dto: RegisterUser) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  @ApiBody({ type: LoginDto })
  @ApiOperation({
    summary: 'Log in with email and password',
    description:
      'Returns { accessToken, user }. If the user has 2FA enabled it returns { requiresTwoFactor, tempToken } instead; send that token to /auth/2fa/authenticate.',
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(@GetUser() user: User) {
    return this.authService.login(user);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @Auth()
  @ApiOperation({
    summary: 'Log out: revoke the access token used in this request',
    description: 'The token is rejected with 401 from now on. Tokens from other logins stay valid.',
  })
  logout(@GetUser() user: AuthenticatedUser) {
    return this.authService.logout(user);
  }

  @Post('2fa/authenticate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtTwoFactorGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Second login step: tempToken as Bearer plus the TOTP code' })
  @ApiResponse({ status: 401, description: 'Invalid code or token' })
  authenticateTwoFactor(@GetUser('id') userId: string, @Body() dto: TwoFactorCodeDto) {
    return this.authService.authenticateTwoFactor(userId, dto.code);
  }

  @Post('2fa/generate')
  @Auth()
  @ApiOperation({ summary: 'Create a TOTP secret and QR code for an authenticator app' })
  generateTwoFactor(@GetUser('id') userId: string) {
    return this.authService.generateTwoFactorSecret(userId);
  }

  @Post('2fa/enable')
  @HttpCode(HttpStatus.OK)
  @Auth()
  @ApiOperation({ summary: 'Turn 2FA on by confirming a code from the authenticator app' })
  enableTwoFactor(@GetUser('id') userId: string, @Body() dto: TwoFactorCodeDto) {
    return this.authService.enableTwoFactor(userId, dto.code);
  }

  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  @Auth()
  @ApiOperation({ summary: 'Turn 2FA off (requires a current code)' })
  disableTwoFactor(@GetUser('id') userId: string, @Body() dto: TwoFactorCodeDto) {
    return this.authService.disableTwoFactor(userId, dto.code);
  }
}
