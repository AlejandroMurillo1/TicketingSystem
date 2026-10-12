import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtTwoFactorStrategy } from './strategies/jwt-two-factor.strategy';
import { TokenRevocationService } from './token-revocation.service';
import { RevokedToken } from './entities/revoked-token.entity';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    TypeOrmModule.forFeature([RevokedToken]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN') ?? '2h' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenRevocationService, LocalStrategy, JwtStrategy, JwtTwoFactorStrategy],
  exports: [AuthService],
})
export class AuthModule {}
