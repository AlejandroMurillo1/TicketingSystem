import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

/**
 * Accepts full access tokens only. Roles are re-read from the database on every
 * request, so a role change or a deactivation takes effect without a new login.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (payload.scope !== 'access') {
      throw new UnauthorizedException('Two-factor authentication is still pending');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Token is no longer valid');
    }

    return { id: user.id, email: user.email, roles: user.roles.map((r) => r.name) };
  }
}
