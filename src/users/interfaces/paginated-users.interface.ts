import { User } from '../entities/user.entity';

export interface PaginatedUsers {
  data: User[];
  total: number;
  limit: number;
  offset: number;
}
