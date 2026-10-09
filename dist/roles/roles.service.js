"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RolesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const role_entity_1 = require("./entities/role.entity");
let RolesService = class RolesService {
    roleRepository;
    dataSource;
    logger = new common_1.Logger('RolesService');
    constructor(roleRepository, dataSource) {
        this.roleRepository = roleRepository;
        this.dataSource = dataSource;
    }
    async createRole(createRoleDto) {
        try {
            const existing = await this.roleRepository.findOneBy({ name: createRoleDto.name });
            if (existing) {
                throw new common_1.ConflictException(`Role "${createRoleDto.name}" already exists`);
            }
            const role = this.roleRepository.create(createRoleDto);
            return await this.roleRepository.save(role);
        }
        catch (error) {
            this.handleException(error);
        }
    }
    async findAll(paginationDto) {
        try {
            const { limit, offset } = paginationDto;
            return await this.roleRepository.find({
                take: limit,
                skip: offset,
            });
        }
        catch (error) {
            this.handleException(error);
        }
    }
    async findById(id) {
        try {
            const role = await this.roleRepository.findOneBy({ id });
            if (role == null)
                throw new common_1.NotFoundException(`Role with id: "${id}" not found`);
            return role;
        }
        catch (error) {
            this.handleException(error);
        }
    }
    async findByName(name) {
        try {
            const role = await this.roleRepository.findOneBy({ name });
            if (role == null)
                throw new common_1.NotFoundException(`Role "${name}" not found`);
            return role;
        }
        catch (error) {
            this.handleException(error);
        }
    }
    async updateRole(id, updateRoleDto) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const role = await queryRunner.manager.findOneBy(role_entity_1.Role, { id });
            if (!role) {
                throw new common_1.NotFoundException(`Role with id: "${id}" not found`);
            }
            if (updateRoleDto.name && updateRoleDto.name !== role.name) {
                const duplicate = await queryRunner.manager.findOneBy(role_entity_1.Role, { name: updateRoleDto.name });
                if (duplicate) {
                    throw new common_1.ConflictException(`Role "${updateRoleDto.name}" already exists`);
                }
            }
            queryRunner.manager.merge(role_entity_1.Role, role, updateRoleDto);
            const updated = await queryRunner.manager.save(role);
            await queryRunner.commitTransaction();
            return updated;
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            this.handleException(error);
        }
        finally {
            await queryRunner.release();
        }
    }
    async removeRole(id) {
        const role = await this.roleRepository.findOne({
            where: { id },
            relations: { users: true },
        });
        if (!role) {
            throw new common_1.NotFoundException(`Role with id: "${id}" not found`);
        }
        if (role.users && role.users.length > 0) {
            throw new common_1.ConflictException(`Cannot delete role "${role.name}": it is assigned to ${role.users.length} user(s)`);
        }
        await this.roleRepository.remove(role);
    }
    async bulkCreateRole(createRoleList) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const names = createRoleList.map((r) => r.name);
            const duplicatesInPayload = names.filter((name, i) => names.indexOf(name) !== i);
            if (duplicatesInPayload.length > 0) {
                throw new common_1.ConflictException(`Duplicate role names in request: ${[...new Set(duplicatesInPayload)].join(', ')}`);
            }
            const existing = await queryRunner.manager.find(role_entity_1.Role, {
                where: names.map((name) => ({ name })),
            });
            if (existing.length > 0) {
                throw new common_1.ConflictException(`Role(s) already exist: ${existing.map((r) => r.name).join(', ')}`);
            }
            const roles = queryRunner.manager.create(role_entity_1.Role, createRoleList);
            const created = await queryRunner.manager.save(role_entity_1.Role, roles);
            await queryRunner.commitTransaction();
            return created;
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            this.handleException(error);
        }
        finally {
            await queryRunner.release();
        }
    }
    handleException(error) {
        this.logger.error(error);
        if (error instanceof common_1.HttpException) {
            throw error;
        }
        if (error.code === '23505') {
            throw new common_1.ConflictException(error.detail);
        }
        throw new common_1.InternalServerErrorException('Unexpected error, check server logs');
    }
};
exports.RolesService = RolesService;
exports.RolesService = RolesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(role_entity_1.Role)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.DataSource])
], RolesService);
//# sourceMappingURL=roles.service.js.map