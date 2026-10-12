import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';
import { toDataURL } from 'qrcode';
import { UsersService } from '../users/users.service';
import { TokenRevocationService } from './token-revocation.service';
import { User } from '../users/entities/user.entity';
import { RegisterUser } from '../users/dtos/register-user.dto';
import { JwtPayload, TokenScope } from '../common/interfaces/jwt-payload.interface';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import {
  AccessTokenResponse,
  LoginResponse,
  TwoFactorSetupResponse,
} from './interfaces/auth-response.interface';

@Injectable()
export class AuthService {
  static readonly TWO_FACTOR_TOKEN_TTL = '5m';

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly tokenRevocation: TokenRevocationService,
  ) {
    // Accept the previous and next 30s window to tolerate small clock drift.
    authenticator.options = { window: 1 };
  }

  /** Used by LocalStrategy. Returns null on any mismatch so the error never reveals which field failed. */
  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmailWithSecrets(email);
    if (!user || !user.isActive) return null;

    const matches = await this.usersService.comparePassword(password, user.password);
    if (!matches) return null;

    delete user.password;
    return user;
  }

  async register(dto: RegisterUser): Promise<AccessTokenResponse> {
    const user = await this.usersService.register(dto);
    return { accessToken: this.signToken(user, 'access'), user };
  }

  login(user: User): LoginResponse {
    if (user.isTwoFactorEnabled) {
      return { requiresTwoFactor: true, tempToken: this.signToken(user, '2fa') };
    }
    delete user.twoFactorSecret;
    return { accessToken: this.signToken(user, 'access'), user };
  }

  /** Second step of the login when 2FA is on: trades the temp token plus a TOTP code for an access token. */
  async authenticateTwoFactor(userId: string, code: string): Promise<AccessTokenResponse> {
    const user = await this.usersService.findByIdWithSecrets(userId);
    if (!user.isActive || !user.isTwoFactorEnabled || !user.twoFactorSecret) {
      throw new UnauthorizedException('Two-factor authentication is not enabled');
    }
    this.assertValidCode(code, user.twoFactorSecret);

    delete user.password;
    delete user.twoFactorSecret;
    return { accessToken: this.signToken(user, 'access'), user };
  }

  /** Creates (or rotates) the TOTP secret. 2FA stays off until the user confirms a code. */
  async generateTwoFactorSecret(userId: string): Promise<TwoFactorSetupResponse> {
    const user = await this.usersService.findByIdWithSecrets(userId);
    if (user.isTwoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is already enabled');
    }

    const secret = authenticator.generateSecret();
    const issuer = this.configService.get<string>('TWO_FACTOR_ISSUER') ?? 'CineReserva';
    const otpauthUrl = authenticator.keyuri(user.email, issuer, secret);

    await this.usersService.setTwoFactorSecret(user.id, secret);

    return { secret, otpauthUrl, qrCodeDataUrl: await toDataURL(otpauthUrl) };
  }

  async enableTwoFactor(userId: string, code: string): Promise<{ isTwoFactorEnabled: true }> {
    const user = await this.usersService.findByIdWithSecrets(userId);
    if (user.isTwoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is already enabled');
    }
    if (!user.twoFactorSecret) {
      throw new BadRequestException('Generate a two-factor secret first');
    }
    this.assertValidCode(code, user.twoFactorSecret);

    await this.usersService.setTwoFactorEnabled(user.id, true);
    return { isTwoFactorEnabled: true };
  }

  async disableTwoFactor(userId: string, code: string): Promise<{ isTwoFactorEnabled: false }> {
    const user = await this.usersService.findByIdWithSecrets(userId);
    if (!user.isTwoFactorEnabled || !user.twoFactorSecret) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }
    this.assertValidCode(code, user.twoFactorSecret);

    await this.usersService.setTwoFactorEnabled(user.id, false);
    return { isTwoFactorEnabled: false };
  }

  /** Revokes the access token of the current request; other sessions stay open. */
  async logout(user: AuthenticatedUser): Promise<{ loggedOut: true }> {
    if (!user.tokenId || !user.tokenExpiresAt) {
      throw new BadRequestException('This token cannot be revoked, log in again to get a new one');
    }
    await this.tokenRevocation.revoke(user.tokenId, user.id, new Date(user.tokenExpiresAt * 1000));
    return { loggedOut: true };
  }

  private assertValidCode(code: string, secret: string) {
    if (!authenticator.verify({ token: code, secret })) {
      throw new UnauthorizedException('Invalid two-factor code');
    }
  }

  private signToken(user: User, scope: TokenScope): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roles: (user.roles ?? []).map((r) => r.name),
      scope,
    };
    const jwtid = randomUUID();
    return scope === '2fa'
      ? this.jwtService.sign(payload, { expiresIn: AuthService.TWO_FACTOR_TOKEN_TTL, jwtid })
      : this.jwtService.sign(payload, { jwtid });
  }
}
