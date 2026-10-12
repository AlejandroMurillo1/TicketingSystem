export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: string[];
  /** Id and expiry (seconds since epoch) of the access token used for this request. */
  tokenId?: string;
  tokenExpiresAt?: number;
}
