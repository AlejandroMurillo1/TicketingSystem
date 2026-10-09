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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const user_entity_1 = require("./entities/user.entity");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const role_entity_1 = require("../roles/entities/role.entity");
const bcrypt_1 = __importDefault(require("bcrypt"));
let UsersService = class UsersService {
    userRepository;
    roleRepository;
    logger = new common_1.Logger('UsersService');
    constructor(userRepository, roleRepository) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
    }
    async findByEmail(email) {
        try {
            return await this.userRepository.findOneBy({ email });
        }
        catch (error) {
            this.handleException(error);
        }
    }
    async create(registerUserDTO) {
        const { password, roles: roleIds, ...userData } = registerUserDTO;
        const existing = await this.findByEmail(registerUserDTO.email);
        if (existing) {
            throw new common_1.ConflictException(`User with email ${registerUserDTO.email} already exists`);
        }
        const roles = roleIds?.length
            ? await this.roleRepository.findBy({ id: (0, typeorm_2.In)(roleIds) })
            : await this.roleRepository.find({ where: { name: 'customer' } });
        if (roleIds?.length && roles.length !== roleIds.length) {
            throw new common_1.BadRequestException('One or more role IDs do not exist');
        }
        const created = this.userRepository.create({
            ...userData,
            roles,
            password: await this.hashPassword(password),
        });
        await this.userRepository.save(created);
        return created;
    }
    async getProfile(id) {
        try {
            const user = await this.userRepository.findOneBy({ id });
            if (user == null)
                throw new common_1.NotFoundException(`User with id ${id} not found`);
            delete user.password;
            return user;
        }
        catch (error) {
            this.handleException(error);
        }
    }
    async updateUser() { }
    async addRoleToUser() { }
    async hashPassword(password) {
        return bcrypt_1.default.hash(password, 10);
    }
    handleException(error) {
        this.logger.error(error);
        if (error.code === '23505') {
            throw new common_1.ConflictException(error.detail);
        }
        throw new common_1.InternalServerErrorException('Unexpected error, check server logs');
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(role_entity_1.Role)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], UsersService);
//# sourceMappingURL=users.service.js.map