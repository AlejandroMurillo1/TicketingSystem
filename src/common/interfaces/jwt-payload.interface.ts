export type TokenScope = 'access' | '2fa';

export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  scope: TokenScope;
}
