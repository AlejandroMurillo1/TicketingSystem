import { User } from "./entities/user.entity";
import { Repository } from "typeorm";
import { Role } from "../roles/entities/role.entity";
import { RegisterUser } from "./dtos/register-user.dto";
export declare class UsersService {
    private readonly userRepository;
    private readonly roleRepository;
    private readonly logger;
    constructor(userRepository: Repository<User>, roleRepository: Repository<Role>);
    findByEmail(email: string): Promise<User | null | undefined>;
    create(registerUserDTO: RegisterUser): Promise<User>;
    getProfile(id: string): Promise<User | undefined>;
    updateUser(): Promise<void>;
    addRoleToUser(): Promise<void>;
    private hashPassword;
    private handleException;
}
