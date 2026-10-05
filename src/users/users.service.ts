import {
    Injectable,
    Logger,
    InternalServerErrorException,
    ConflictException,
    BadRequestException,
    NotFoundException
} from '@nestjs/common';
import {User} from "./entities/user.entity";
import {InjectRepository} from "@nestjs/typeorm";
import {In, Repository} from "typeorm";
import {Role} from "../roles/entities/role.entity";
import {RegisterUser} from "./dtos/register-user.dto";
import bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
    private readonly logger = new Logger('UsersService');

    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,

        @InjectRepository(Role)
        private readonly roleRepository: Repository<Role>,
    ) {}

    async findByEmail(email:string) {
        try{
           return await this.userRepository.findOneBy({email})
        }catch (error){
            this.handleException(error);
        }
    }

    async create(registerUserDTO: RegisterUser) {
        const { password, roles: roleIds, ...userData } = registerUserDTO;

        const existing = await this.findByEmail(registerUserDTO.email);
        if (existing) {
            throw new ConflictException(`User with email ${registerUserDTO.email} already exists`);
        }

        // Si no mandan roles, asignar un rol por defecto (ej. "cliente")
        const roles = roleIds?.length
            ? await this.roleRepository.findBy({ id: In(roleIds) })
            : await this.roleRepository.find({ where: { name: 'customer' } });

        if (roleIds?.length && roles.length !== roleIds.length) {
            throw new BadRequestException('One or more role IDs do not exist');
        }

        const created = this.userRepository.create({
            ...userData,
            roles,
            password: await this.hashPassword(password),
        });

        await this.userRepository.save(created);
        return created;
    }

    async getProfile(id: string){
        try{
            const user = await this.userRepository.findOneBy({id});

            if(user == null)
                throw new NotFoundException(`User with id ${id} not found`);

            delete user.password;
            return user;
        }catch (error){
            this.handleException(error);
        }
    }

    async updateUser(){}
    async addRoleToUser(){}

    private async hashPassword(password: string) {
        return bcrypt.hash(password, 10);
    }

    private handleException(error: any){
        this.logger.error(error);
        if (error.code === '23505') {
            throw new ConflictException(error.detail);
        }
        throw new InternalServerErrorException('Unexpected error, check server logs');
    }
}
