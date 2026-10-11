import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

/** Accepts only the short-lived token issued by /auth/login when 2FA is enabled. */
@Injectable()
export class JwtTwoFactorStrategy extends PassportStrategy(Strategy, 'jwt-2fa') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    if (payload.scope !== '2fa') {
      throw new UnauthorizedException('A two-factor pending token is required');
    }
    return { id: payload.sub, email: payload.email, roles: payload.roles };
  }
}
