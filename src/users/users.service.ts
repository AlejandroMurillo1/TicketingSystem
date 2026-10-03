import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import {User} from "./entities/user.entity";
import {InjectRepository} from "@nestjs/typeorm";
import {Repository} from "typeorm";
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

    async create(registerUserDTO: RegisterUser) {
        const {password, ...user} = registerUserDTO;

        try{
            const created = this.userRepository.create({
                ...user,
                password: this.encryptPassword(password)
            })

            await this.userRepository.save(created);
            delete created.password;

            return created;
        }catch (error){
            this.handleException(error)
        }
    }

    private encryptPassword(password:string) {
        return bcrypt.hashSync(password, 10);
    }

    private handleException(error: any){
        this.logger.error(error);
        if(error.code === '23505'){
            throw new InternalServerErrorException(error.detail);
        }

    }
}
