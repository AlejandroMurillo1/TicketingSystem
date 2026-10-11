import { User } from '../../users/entities/user.entity';

export interface AccessTokenResponse {
  accessToken: string;
  user: User;
}

export interface TwoFactorRequiredResponse {
  requiresTwoFactor: true;
  tempToken: string;
}

export type LoginResponse = AccessTokenResponse | TwoFactorRequiredResponse;

export interface TwoFactorSetupResponse {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}
