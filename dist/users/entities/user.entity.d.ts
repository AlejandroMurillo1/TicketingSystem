import { Role } from '../../roles/entities/role.entity';
export declare class User {
    id: string;
    email: string;
    roles: Role[];
    password?: string;
}
