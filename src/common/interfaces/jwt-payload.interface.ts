export type TokenScope = 'access' | '2fa';

export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  scope: TokenScope;
  /** Token id, used to revoke a single token on logout. */
  jti?: string;
  /** Set by jsonwebtoken when signing. */
  iat?: number;
  exp?: number;
}
