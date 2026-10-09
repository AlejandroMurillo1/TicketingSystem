"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const typeorm_1 = require("@nestjs/typeorm");
const common_1 = require("@nestjs/common");
const typeorm_2 = require("typeorm");
const roles_service_1 = require("./roles.service");
const role_entity_1 = require("./entities/role.entity");
const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
        findOneBy: jest.fn(),
        find: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        merge: jest.fn(),
    },
};
describe('RolesService', () => {
    let service;
    let roleRepository;
    let dataSource;
    const roleMock = (overrides = {}) => ({
        id: 1,
        name: 'admin',
        users: [],
        ...overrides,
    });
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                roles_service_1.RolesService,
                {
                    provide: (0, typeorm_1.getRepositoryToken)(role_entity_1.Role),
                    useValue: {
                        findOneBy: jest.fn(),
                        find: jest.fn(),
                        findOne: jest.fn(),
                        create: jest.fn(),
                        save: jest.fn(),
                        remove: jest.fn(),
                    },
                },
                {
                    provide: typeorm_2.DataSource,
                    useValue: {
                        createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
                    },
                },
            ],
        }).compile();
        service = module.get(roles_service_1.RolesService);
        roleRepository = module.get((0, typeorm_1.getRepositoryToken)(role_entity_1.Role));
        dataSource = module.get(typeorm_2.DataSource);
        jest.clearAllMocks();
    });
    it('debe estar definido', () => {
        expect(service).toBeDefined();
    });
    describe('createRole', () => {
        it('crea el rol cuando el nombre no existe', async () => {
            roleRepository.findOneBy.mockResolvedValue(null);
            const created = roleMock();
            roleRepository.create.mockReturnValue(created);
            roleRepository.save.mockResolvedValue(created);
            const result = await service.createRole({ name: 'admin' });
            expect(roleRepository.findOneBy).toHaveBeenCalledWith({ name: 'admin' });
            expect(roleRepository.save).toHaveBeenCalledWith(created);
            expect(result).toEqual(created);
        });
        it('lanza ConflictException si el nombre ya existe', async () => {
            roleRepository.findOneBy.mockResolvedValue(roleMock());
            await expect(service.createRole({ name: 'admin' })).rejects.toThrow(common_1.ConflictException);
            expect(roleRepository.save).not.toHaveBeenCalled();
        });
    });
    describe('findAll', () => {
        it('retorna los roles aplicando limit y offset', async () => {
            const roles = [roleMock({ id: 1 }), roleMock({ id: 2, name: 'cliente' })];
            roleRepository.find.mockResolvedValue(roles);
            const result = await service.findAll({ limit: 10, offset: 0 });
            expect(roleRepository.find).toHaveBeenCalledWith({ take: 10, skip: 0 });
            expect(result).toEqual(roles);
        });
    });
    describe('findById', () => {
        it('retorna el rol si existe', async () => {
            const role = roleMock();
            roleRepository.findOneBy.mockResolvedValue(role);
            const result = await service.findById(1);
            expect(result).toEqual(role);
        });
        it('lanza NotFoundException si no existe (y no la convierte en 500)', async () => {
            roleRepository.findOneBy.mockResolvedValue(null);
            await expect(service.findById(999)).rejects.toThrow(common_1.NotFoundException);
        });
    });
    describe('findByName', () => {
        it('retorna el rol si existe', async () => {
            const role = roleMock({ name: 'counter' });
            roleRepository.findOneBy.mockResolvedValue(role);
            const result = await service.findByName('counter');
            expect(result).toEqual(role);
        });
        it('lanza NotFoundException si no existe', async () => {
            roleRepository.findOneBy.mockResolvedValue(null);
            await expect(service.findByName('inexistente')).rejects.toThrow(common_1.NotFoundException);
        });
    });
    describe('updateRole', () => {
        it('actualiza el rol dentro de una transacción y hace commit', async () => {
            const existing = roleMock({ id: 1, name: 'counter' });
            const updated = roleMock({ id: 1, name: 'counter-editado' });
            mockQueryRunner.manager.findOneBy.mockResolvedValueOnce(existing);
            mockQueryRunner.manager.findOneBy.mockResolvedValueOnce(null);
            mockQueryRunner.manager.merge.mockReturnValue(updated);
            mockQueryRunner.manager.save.mockResolvedValue(updated);
            const result = await service.updateRole(1, { name: 'counter-editado' });
            expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
            expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
            expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();
            expect(mockQueryRunner.release).toHaveBeenCalled();
            expect(result).toEqual(updated);
        });
        it('hace rollback y lanza NotFoundException si el rol no existe', async () => {
            mockQueryRunner.manager.findOneBy.mockResolvedValueOnce(null);
            await expect(service.updateRole(999, { name: 'x' })).rejects.toThrow(common_1.NotFoundException);
            expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
            expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
            expect(mockQueryRunner.release).toHaveBeenCalled();
        });
        it('hace rollback y lanza ConflictException si el nuevo nombre ya existe en otro rol', async () => {
            const existing = roleMock({ id: 1, name: 'counter' });
            const duplicate = roleMock({ id: 2, name: 'admin' });
            mockQueryRunner.manager.findOneBy.mockResolvedValueOnce(existing);
            mockQueryRunner.manager.findOneBy.mockResolvedValueOnce(duplicate);
            await expect(service.updateRole(1, { name: 'admin' })).rejects.toThrow(common_1.ConflictException);
            expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
            expect(mockQueryRunner.manager.save).not.toHaveBeenCalled();
        });
        it('libera el queryRunner incluso si ocurre un error inesperado', async () => {
            mockQueryRunner.manager.findOneBy.mockRejectedValueOnce(new Error('conexión perdida'));
            await expect(service.updateRole(1, { name: 'x' })).rejects.toThrow('Unexpected error, check server logs');
            expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
            expect(mockQueryRunner.release).toHaveBeenCalled();
        });
    });
    describe('removeRole', () => {
        it('elimina el rol si no tiene usuarios asignados', async () => {
            const role = roleMock({ users: [] });
            roleRepository.findOne.mockResolvedValue(role);
            await service.removeRole(1);
            expect(roleRepository.findOne).toHaveBeenCalledWith({
                where: { id: 1 },
                relations: { users: true },
            });
            expect(roleRepository.remove).toHaveBeenCalledWith(role);
        });
        it('lanza NotFoundException si el rol no existe', async () => {
            roleRepository.findOne.mockResolvedValue(null);
            await expect(service.removeRole(999)).rejects.toThrow(common_1.NotFoundException);
            expect(roleRepository.remove).not.toHaveBeenCalled();
        });
        it('lanza ConflictException si el rol tiene usuarios asignados', async () => {
            const role = roleMock({ users: [{ id: 'u1' }] });
            roleRepository.findOne.mockResolvedValue(role);
            await expect(service.removeRole(1)).rejects.toThrow(common_1.ConflictException);
            expect(roleRepository.remove).not.toHaveBeenCalled();
        });
    });
    describe('bulkCreateRole', () => {
        it('crea todos los roles dentro de una transacción', async () => {
            const payload = [{ name: 'admin' }, { name: 'counter' }];
            const created = payload.map((r, i) => roleMock({ id: i + 1, ...r }));
            mockQueryRunner.manager.find.mockResolvedValue([]);
            mockQueryRunner.manager.create.mockReturnValue(created);
            mockQueryRunner.manager.save.mockResolvedValue(created);
            const result = await service.bulkCreateRole(payload);
            expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
            expect(result).toEqual(created);
        });
        it('hace rollback si hay nombres duplicados dentro del mismo payload', async () => {
            const payload = [{ name: 'admin' }, { name: 'admin' }];
            await expect(service.bulkCreateRole(payload)).rejects.toThrow(common_1.ConflictException);
            expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
            expect(mockQueryRunner.manager.save).not.toHaveBeenCalled();
        });
        it('hace rollback si alguno de los roles ya existe en base de datos', async () => {
            const payload = [{ name: 'admin' }, { name: 'counter' }];
            mockQueryRunner.manager.find.mockResolvedValue([roleMock({ name: 'admin' })]);
            await expect(service.bulkCreateRole(payload)).rejects.toThrow(common_1.ConflictException);
            expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
            expect(mockQueryRunner.manager.save).not.toHaveBeenCalled();
        });
        it('hace rollback ante un error inesperado durante el save', async () => {
            const payload = [{ name: 'admin' }];
            mockQueryRunner.manager.find.mockResolvedValue([]);
            mockQueryRunner.manager.create.mockReturnValue(payload);
            mockQueryRunner.manager.save.mockRejectedValue(new Error('db down'));
            await expect(service.bulkCreateRole(payload)).rejects.toThrow('Unexpected error, check server logs');
            expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
            expect(mockQueryRunner.release).toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=roles.service.spec.js.map