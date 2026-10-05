import {
    ConflictException,
    HttpException,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException
} from '@nestjs/common';
import {InjectRepository} from "@nestjs/typeorm";
import {DataSource, Repository} from "typeorm";
import {Role} from "./entities/role.entity";
import {CreateRole} from "./dtos/create-role.dto";
import {FindAllRoles} from "./dtos/role-pagination.dto";
import {UpdateRole} from "./dtos/update-role.dto";

@Injectable()
export class RolesService {
    private readonly logger = new Logger('RolesService');

    constructor(
        @InjectRepository(Role)
        private readonly roleRepository: Repository<Role>,
        private readonly dataSource: DataSource
    ){}

    async createRole(createRoleDto: CreateRole): Promise<Role | undefined> {
        try {
            const existing = await this.roleRepository.findOneBy({ name: createRoleDto.name });
            if (existing) {
                throw new ConflictException(`Role "${createRoleDto.name}" already exists`);
            }

            const role = this.roleRepository.create(createRoleDto);
            return await this.roleRepository.save(role);
        } catch (error) {
            this.handleException(error);
        }
    }

    async findAll(paginationDto: FindAllRoles): Promise<Role[] | undefined> {
        try {
            const {limit, offset} = paginationDto;
            return await this.roleRepository.find({
                take: limit,
                skip: offset,
            })
        }catch (error) {
            this.handleException(error);
        }
    }

    async findById(id: number): Promise<Role | undefined> {
        try {
            const role = await this.roleRepository.findOneBy({id});
            if(role == null)
                throw new NotFoundException(`Role with id: "${id}" not found`);

            return role;
        }catch(error) {
            this.handleException(error);
        }
    }

    async findByName(name: string): Promise<Role | undefined> {
        try{
            const role = await this.roleRepository.findOneBy({name})
            if(role == null)
                throw new NotFoundException(`Role "${name}" not found`);

            return role;
        }catch(error){
            this.handleException(error);
        }
    }

    async updateRole(id: number, updateRoleDto: UpdateRole): Promise<Role | undefined> {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const role = await queryRunner.manager.findOneBy(Role, { id });
            if (!role) {
                throw new NotFoundException(`Role with id: "${id}" not found`);
            }

            if (updateRoleDto.name && updateRoleDto.name !== role.name) {
                const duplicate = await queryRunner.manager.findOneBy(Role, { name: updateRoleDto.name });
                if (duplicate) {
                    throw new ConflictException(`Role "${updateRoleDto.name}" already exists`);
                }
            }

            queryRunner.manager.merge(Role, role, updateRoleDto);
            const updated = await queryRunner.manager.save(role);

            await queryRunner.commitTransaction();
            return updated;
        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.handleException(error);
        } finally {
            await queryRunner.release();
        }
    }

    async removeRole(id: number): Promise<void> {
        const role = await this.roleRepository.findOne({
            where: { id },
            relations: { users: true },
        });

        if (!role) {
            throw new NotFoundException(`Role with id: "${id}" not found`);
        }

        if (role.users && role.users.length > 0) {
            throw new ConflictException(
                `Cannot delete role "${role.name}": it is assigned to ${role.users.length} user(s)`
            );
        }

        await this.roleRepository.remove(role);
    }

    async bulkCreateRole(createRoleList: CreateRole[]): Promise<Role[] | undefined> {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const names = createRoleList.map((r) => r.name);
            const duplicatesInPayload = names.filter((name, i) => names.indexOf(name) !== i);
            if (duplicatesInPayload.length > 0) {
                throw new ConflictException(
                    `Duplicate role names in request: ${[...new Set(duplicatesInPayload)].join(', ')}`
                );
            }

            const existing = await queryRunner.manager.find(Role, {
                where: names.map((name) => ({ name })),
            });
            if (existing.length > 0) {
                throw new ConflictException(
                    `Role(s) already exist: ${existing.map((r) => r.name).join(', ')}`
                );
            }

            const roles = queryRunner.manager.create(Role, createRoleList);
            const created = await queryRunner.manager.save(Role, roles);

            await queryRunner.commitTransaction();
            return created;
        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.handleException(error);
        } finally {
            await queryRunner.release();
        }
    }

    private handleException(error: any){
        this.logger.error(error);

        if (error instanceof HttpException) {
            throw error;
        }
        if (error.code === '23505') {
            throw new ConflictException(error.detail);
        }
        throw new InternalServerErrorException('Unexpected error, check server logs');
    }


}
