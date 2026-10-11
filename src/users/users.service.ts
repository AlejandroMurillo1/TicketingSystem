import {
    BadRequestException,
    ConflictException,
    HttpException,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import {InjectRepository} from "@nestjs/typeorm";
import {In, Repository} from "typeorm";
import bcrypt from 'bcrypt';
import {User} from "./entities/user.entity";
import {Role} from "../roles/entities/role.entity";
import {RegisterUser} from "./dtos/register-user.dto";
import {CreateUser} from "./dtos/create-user.dto";
import {UpdateProfile} from "./dtos/update-profile.dto";
import {FindAllUsers} from "./dtos/user-pagination.dto";
import {PaginatedUsers} from "./interfaces/paginated-users.interface";
import {ValidRoles} from "../common/enums/valid-roles.enum";

@Injectable()
export class UsersService {
    private readonly logger = new Logger('UsersService');
    private static readonly DEFAULT_LIMIT = 10;
    private static readonly SALT_ROUNDS = 10;

    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,

        @InjectRepository(Role)
        private readonly roleRepository: Repository<Role>,
    ) {}

    async findByEmail(email: string): Promise<User | null> {
        try {
            return await this.userRepository.findOneBy({ email: email.toLowerCase() });
        } catch (error) {
            this.handleException(error);
        }
    }

    async findById(id: string): Promise<User | null> {
        try {
            return await this.userRepository.findOneBy({ id });
        } catch (error) {
            this.handleException(error);
        }
    }

    /** Same as findByEmail but also loads the password hash and the TOTP secret. */
    async findByEmailWithSecrets(email: string): Promise<User | null> {
        try {
            return await this.userRepository
                .createQueryBuilder('user')
                .addSelect(['user.password', 'user.twoFactorSecret'])
                .leftJoinAndSelect('user.roles', 'role')
                .where('user.email = :email', { email: email.toLowerCase() })
                .getOne();
        } catch (error) {
            this.handleException(error);
        }
    }

    async findByIdWithSecrets(id: string): Promise<User> {
        try {
            const user = await this.userRepository
                .createQueryBuilder('user')
                .addSelect(['user.password', 'user.twoFactorSecret'])
                .leftJoinAndSelect('user.roles', 'role')
                .where('user.id = :id', { id })
                .getOne();

            if (!user) throw new NotFoundException(`User with id ${id} not found`);
            return user;
        } catch (error) {
            this.handleException(error);
        }
    }

    /** Public sign-up: always creates a customer, whatever the payload says. */
    async register(registerUserDto: RegisterUser): Promise<User> {
        const { email, password, fullName } = registerUserDto;
        return this.create({ email, password, fullName, roles: [ValidRoles.CUSTOMER] });
    }

    /** Admin creation: can pick roles, e.g. to onboard counter staff. */
    async create(createUserDto: CreateUser): Promise<User> {
        try {
            const { password, roles: roleNames, ...userData } = createUserDto;

            const existing = await this.findByEmail(userData.email);
            if (existing) {
                throw new ConflictException(`User with email ${userData.email} already exists`);
            }

            const roles = await this.resolveRoles(roleNames?.length ? roleNames : [ValidRoles.CUSTOMER]);

            const created = this.userRepository.create({
                ...userData,
                email: userData.email.toLowerCase(),
                roles,
                password: await this.hashPassword(password),
            });

            const saved = await this.userRepository.save(created);
            return this.sanitize(saved);
        } catch (error) {
            this.handleException(error);
        }
    }

    async findAll(paginationDto: FindAllUsers): Promise<PaginatedUsers> {
        try {
            const limit = paginationDto.limit ?? UsersService.DEFAULT_LIMIT;
            const offset = paginationDto.offset ?? 0;

            const query = this.userRepository
                .createQueryBuilder('user')
                .leftJoinAndSelect('user.roles', 'role')
                .orderBy('user.createdAt', 'DESC')
                .take(limit)
                .skip(offset);

            if (paginationDto.role) {
                // Filter on a separate join so the selected roles array stays complete.
                query.innerJoin('user.roles', 'filterRole', 'filterRole.name = :roleName', {
                    roleName: paginationDto.role,
                });
            }

            const [data, total] = await query.getManyAndCount();
            return { data, total, limit, offset };
        } catch (error) {
            this.handleException(error);
        }
    }

    async getProfile(id: string): Promise<User> {
        try {
            const user = await this.userRepository.findOneBy({ id });

            if (user == null)
                throw new NotFoundException(`User with id ${id} not found`);

            return user;
        } catch (error) {
            this.handleException(error);
        }
    }

    async updateProfile(id: string, updateProfileDto: UpdateProfile): Promise<User> {
        try {
            const user = await this.findByIdWithSecrets(id);
            const { fullName, email, newPassword, currentPassword } = updateProfileDto;

            if (email && email !== user.email) {
                const taken = await this.findByEmail(email);
                if (taken) throw new ConflictException(`User with email ${email} already exists`);
                user.email = email;
            }

            if (fullName !== undefined) user.fullName = fullName;

            if (newPassword !== undefined) {
                const matches = await this.comparePassword(currentPassword ?? '', user.password);
                if (!matches) throw new UnauthorizedException('Current password is incorrect');
                user.password = await this.hashPassword(newPassword);
            }

            const saved = await this.userRepository.save(user);
            return this.sanitize(saved);
        } catch (error) {
            this.handleException(error);
        }
    }

    /** RF2: replaces the roles of a user (e.g. promote a customer to counter). */
    async assignRoles(id: string, roleNames: string[]): Promise<User> {
        try {
            const user = await this.userRepository.findOneBy({ id });
            if (!user) throw new NotFoundException(`User with id ${id} not found`);

            user.roles = await this.resolveRoles(roleNames);
            return await this.userRepository.save(user);
        } catch (error) {
            this.handleException(error);
        }
    }

    async setActive(id: string, isActive: boolean): Promise<User> {
        try {
            const user = await this.userRepository.findOneBy({ id });
            if (!user) throw new NotFoundException(`User with id ${id} not found`);

            user.isActive = isActive;
            return await this.userRepository.save(user);
        } catch (error) {
            this.handleException(error);
        }
    }

    async setTwoFactorSecret(id: string, secret: string): Promise<void> {
        try {
            await this.userRepository.update({ id }, { twoFactorSecret: secret });
        } catch (error) {
            this.handleException(error);
        }
    }

    async setTwoFactorEnabled(id: string, enabled: boolean): Promise<void> {
        try {
            const changes: Partial<User> = { isTwoFactorEnabled: enabled };
            if (!enabled) changes.twoFactorSecret = null;
            await this.userRepository.update({ id }, changes);
        } catch (error) {
            this.handleException(error);
        }
    }

    async comparePassword(plain: string, hash?: string): Promise<boolean> {
        if (!hash) return false;
        return bcrypt.compare(plain, hash);
    }

    private async resolveRoles(roleNames: string[]): Promise<Role[]> {
        const uniqueNames = [...new Set(roleNames.map((r) => r.trim().toLowerCase()))];
        const roles = await this.roleRepository.findBy({ name: In(uniqueNames) });

        if (roles.length !== uniqueNames.length) {
            const found = roles.map((r) => r.name);
            const missing = uniqueNames.filter((n) => !found.includes(n));
            throw new BadRequestException(`Role(s) not found: ${missing.join(', ')}`);
        }
        return roles;
    }

    private async hashPassword(password: string) {
        return bcrypt.hash(password, UsersService.SALT_ROUNDS);
    }

    private sanitize(user: User): User {
        delete user.password;
        delete user.twoFactorSecret;
        return user;
    }

    private handleException(error: any): never {
        if (error instanceof HttpException) {
            throw error;
        }
        this.logger.error(error);
        if (error.code === '23505') {
            throw new ConflictException(error.detail);
        }
        throw new InternalServerErrorException('Unexpected error, check server logs');
    }
}
