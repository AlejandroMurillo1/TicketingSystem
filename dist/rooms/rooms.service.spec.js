"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const typeorm_1 = require("@nestjs/typeorm");
const common_1 = require("@nestjs/common");
const typeorm_2 = require("typeorm");
const rooms_service_1 = require("./rooms.service");
const room_entity_1 = require("./entities/room.entity");
const seat_entity_1 = require("./entities/seat.entity");
const createRepositoryMock = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    remove: jest.fn(),
});
const createQueryRunnerMock = () => ({
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    manager: {
        findOneBy: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        merge: jest.fn(),
        delete: jest.fn(),
    },
});
const buildRoom = (overrides = {}) => ({
    id: 'room-uuid-001',
    name: 'Sala A',
    rows: 5,
    columns: 4,
    capacity: 20,
    seats: [],
    ...overrides,
});
const buildCreateDto = (overrides = {}) => ({
    name: 'Sala A',
    rows: 5,
    columns: 4,
    ...overrides,
});
const buildDbError = (code, detail = 'db detail') => Object.assign(new Error('db error'), { code, detail });
describe('RoomsService', () => {
    let service;
    let roomRepository;
    let seatRepository;
    let queryRunner;
    let dataSource;
    beforeEach(async () => {
        roomRepository = createRepositoryMock();
        seatRepository = createRepositoryMock();
        queryRunner = createQueryRunnerMock();
        dataSource = { createQueryRunner: jest.fn().mockReturnValue(queryRunner) };
        jest.spyOn(common_1.Logger.prototype, 'error').mockImplementation(() => undefined);
        const module = await testing_1.Test.createTestingModule({
            providers: [
                rooms_service_1.RoomsService,
                { provide: (0, typeorm_1.getRepositoryToken)(room_entity_1.Room), useValue: roomRepository },
                { provide: (0, typeorm_1.getRepositoryToken)(seat_entity_1.Seat), useValue: seatRepository },
                { provide: typeorm_2.DataSource, useValue: dataSource },
            ],
        }).compile();
        service = module.get(rooms_service_1.RoomsService);
    });
    afterEach(() => jest.restoreAllMocks());
    it('debe estar definido', () => {
        expect(service).toBeDefined();
    });
    describe('generateSeats', () => {
        it('debe generar rows × columns asientos todos de tipo NORMAL cuando no hay especiales', () => {
            const room = buildRoom();
            const seats = service.generateSeats(room, 3, 2, undefined);
            expect(seats).toHaveLength(6);
            seats.forEach(s => expect(s.type).toBe(seat_entity_1.SeatType.NORMAL));
        });
        it('debe marcar como VIP los asientos indicados en specialSeats', () => {
            const room = buildRoom();
            const specials = [{ row: 1, column: 1, type: seat_entity_1.SeatType.VIP }];
            const seats = service.generateSeats(room, 2, 2, specials);
            const vipSeat = seats.find(s => s.row === 1 && s.column === 1);
            const normalSeat = seats.find(s => s.row === 1 && s.column === 2);
            expect(vipSeat.type).toBe(seat_entity_1.SeatType.VIP);
            expect(normalSeat.type).toBe(seat_entity_1.SeatType.NORMAL);
        });
        it('debe asignar la room correctamente a cada asiento generado', () => {
            const room = buildRoom({ id: 'test-room-id' });
            const seats = service.generateSeats(room, 2, 2, undefined);
            seats.forEach(s => expect(s.room).toBe(room));
        });
        it('debe generar los asientos con coordenadas 1-indexed', () => {
            const room = buildRoom();
            const seats = service.generateSeats(room, 2, 3, undefined);
            const rows = [...new Set(seats.map(s => s.row))].sort((a, b) => a - b);
            const cols = [...new Set(seats.map(s => s.column))].sort((a, b) => a - b);
            expect(rows).toEqual([1, 2]);
            expect(cols).toEqual([1, 2, 3]);
        });
    });
    describe('create', () => {
        it('debe crear la sala, generar los asientos y hacer commit', async () => {
            const dto = buildCreateDto();
            const savedRoom = buildRoom();
            queryRunner.manager.findOneBy.mockResolvedValue(null);
            queryRunner.manager.create.mockReturnValue(savedRoom);
            queryRunner.manager.save
                .mockResolvedValueOnce(savedRoom)
                .mockResolvedValueOnce([]);
            roomRepository.findOne.mockResolvedValue({ ...savedRoom, seats: [] });
            const result = await service.create(dto);
            expect(queryRunner.manager.findOneBy).toHaveBeenCalledWith(room_entity_1.Room, { name: 'Sala A' });
            expect(queryRunner.manager.save).toHaveBeenCalledTimes(2);
            expect(queryRunner.commitTransaction).toHaveBeenCalled();
            expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
            expect(queryRunner.release).toHaveBeenCalled();
            expect(result).toBeDefined();
        });
        it('debe calcular capacity = rows × columns', async () => {
            const dto = buildCreateDto({ rows: 4, columns: 6 });
            queryRunner.manager.findOneBy.mockResolvedValue(null);
            queryRunner.manager.create.mockImplementation((_entity, data) => ({ ...data }));
            queryRunner.manager.save.mockResolvedValue({ ...buildRoom(), rows: 4, columns: 6, capacity: 24 });
            roomRepository.findOne.mockResolvedValue(buildRoom({ rows: 4, columns: 6, capacity: 24 }));
            const result = await service.create(dto);
            const createCall = queryRunner.manager.create.mock.calls[0];
            expect(createCall[1]).toMatchObject({ capacity: 24 });
        });
        it('debe hacer rollback y lanzar ConflictException si la sala ya existe', async () => {
            queryRunner.manager.findOneBy.mockResolvedValue(buildRoom());
            const act = service.create(buildCreateDto());
            await expect(act).rejects.toThrow(common_1.ConflictException);
            await expect(act).rejects.toThrow('already exists');
            expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
            expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
            expect(queryRunner.release).toHaveBeenCalled();
        });
        it('debe normalizar el nombre (trim) antes de buscar duplicados', async () => {
            const dto = buildCreateDto({ name: '  Sala A  ' });
            queryRunner.manager.findOneBy.mockResolvedValue(null);
            queryRunner.manager.create.mockReturnValue(buildRoom());
            queryRunner.manager.save.mockResolvedValue(buildRoom());
            roomRepository.findOne.mockResolvedValue(buildRoom());
            await service.create(dto);
            expect(queryRunner.manager.findOneBy).toHaveBeenCalledWith(room_entity_1.Room, { name: 'Sala A' });
        });
        it('debe hacer rollback y lanzar InternalServerErrorException ante error inesperado', async () => {
            queryRunner.manager.findOneBy.mockRejectedValue(new Error('db down'));
            const act = service.create(buildCreateDto());
            await expect(act).rejects.toThrow(common_1.InternalServerErrorException);
            expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
            expect(queryRunner.release).toHaveBeenCalled();
        });
    });
    describe('findAll', () => {
        it('debe retornar todas las salas con sus asientos', async () => {
            const rooms = [buildRoom(), buildRoom({ id: 'room-uuid-002', name: 'Sala B' })];
            roomRepository.find.mockResolvedValue(rooms);
            const result = await service.findAll();
            expect(roomRepository.find).toHaveBeenCalledWith({ relations: { seats: true } });
            expect(result).toEqual(rooms);
        });
        it('debe retornar un arreglo vacío cuando no hay salas', async () => {
            roomRepository.find.mockResolvedValue([]);
            const result = await service.findAll();
            expect(result).toEqual([]);
        });
        it('debe lanzar InternalServerErrorException ante un error inesperado', async () => {
            roomRepository.find.mockRejectedValue(new Error('db down'));
            const act = service.findAll();
            await expect(act).rejects.toThrow(common_1.InternalServerErrorException);
        });
    });
    describe('findById', () => {
        it('debe retornar la sala con sus asientos si existe', async () => {
            const room = buildRoom();
            roomRepository.findOne.mockResolvedValue(room);
            const result = await service.findById(room.id);
            expect(roomRepository.findOne).toHaveBeenCalledWith({
                where: { id: room.id },
                relations: { seats: true },
            });
            expect(result).toEqual(room);
        });
        it('debe lanzar NotFoundException si la sala no existe', async () => {
            roomRepository.findOne.mockResolvedValue(null);
            const act = service.findById('id-inexistente');
            await expect(act).rejects.toThrow(common_1.NotFoundException);
            await expect(act).rejects.toThrow('id-inexistente');
        });
        it('debe lanzar InternalServerErrorException ante un error inesperado', async () => {
            roomRepository.findOne.mockRejectedValue(new Error('db down'));
            const act = service.findById('cualquier-id');
            await expect(act).rejects.toThrow(common_1.InternalServerErrorException);
        });
    });
    describe('remove', () => {
        it('debe eliminar la sala si existe', async () => {
            const room = buildRoom();
            roomRepository.findOneBy.mockResolvedValue(room);
            roomRepository.remove.mockResolvedValue(room);
            const result = await service.remove(room.id);
            expect(roomRepository.findOneBy).toHaveBeenCalledWith({ id: room.id });
            expect(roomRepository.remove).toHaveBeenCalledWith(room);
            expect(result).toBeUndefined();
        });
        it('debe lanzar NotFoundException si la sala no existe', async () => {
            roomRepository.findOneBy.mockResolvedValue(null);
            const act = service.remove('id-inexistente');
            await expect(act).rejects.toThrow(common_1.NotFoundException);
            expect(roomRepository.remove).not.toHaveBeenCalled();
        });
        it('debe traducir la violación de FK (23503) a ConflictException', async () => {
            roomRepository.findOneBy.mockResolvedValue(buildRoom());
            roomRepository.remove.mockRejectedValue(buildDbError('23503'));
            const act = service.remove('cualquier-id');
            await expect(act).rejects.toThrow(common_1.ConflictException);
            await expect(act).rejects.toThrow('referenced by other records');
        });
        it('debe lanzar InternalServerErrorException ante un error inesperado', async () => {
            roomRepository.findOneBy.mockResolvedValue(buildRoom());
            roomRepository.remove.mockRejectedValue(new Error('db down'));
            const act = service.remove('cualquier-id');
            await expect(act).rejects.toThrow(common_1.InternalServerErrorException);
        });
    });
    describe('update', () => {
        it('debe actualizar nombre y hacer commit sin regenerar asientos', async () => {
            const room = buildRoom();
            queryRunner.manager.findOneBy
                .mockResolvedValueOnce(room)
                .mockResolvedValueOnce(null);
            queryRunner.manager.save.mockResolvedValue(room);
            roomRepository.findOne.mockResolvedValue(room);
            const result = await service.update(room.id, { name: 'Sala B' });
            expect(queryRunner.commitTransaction).toHaveBeenCalled();
            expect(queryRunner.manager.delete).not.toHaveBeenCalled();
            expect(result).toEqual(room);
        });
        it('debe regenerar asientos si cambia el layout (rows o columns)', async () => {
            const room = buildRoom({ rows: 5, columns: 4 });
            queryRunner.manager.findOneBy.mockResolvedValueOnce(room);
            queryRunner.manager.merge.mockImplementation(() => undefined);
            queryRunner.manager.save.mockResolvedValue({ ...room, rows: 6, columns: 4, capacity: 24 });
            queryRunner.manager.delete.mockResolvedValue(undefined);
            queryRunner.manager.save.mockResolvedValue(room);
            roomRepository.findOne.mockResolvedValue(room);
            await service.update(room.id, { rows: 6 });
            expect(queryRunner.manager.delete).toHaveBeenCalledWith(seat_entity_1.Seat, { room: { id: room.id } });
            expect(queryRunner.commitTransaction).toHaveBeenCalled();
        });
        it('debe hacer rollback y lanzar NotFoundException si la sala no existe', async () => {
            queryRunner.manager.findOneBy.mockResolvedValue(null);
            const act = service.update('id-inexistente', { name: 'X' });
            await expect(act).rejects.toThrow(common_1.NotFoundException);
            expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
            expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
            expect(queryRunner.release).toHaveBeenCalled();
        });
        it('debe hacer rollback y lanzar ConflictException si el nuevo nombre ya existe', async () => {
            const room = buildRoom({ name: 'Sala A' });
            const duplicate = buildRoom({ id: 'other-id', name: 'Sala B' });
            queryRunner.manager.findOneBy
                .mockResolvedValueOnce(room)
                .mockResolvedValueOnce(duplicate);
            const act = service.update(room.id, { name: 'Sala B' });
            await expect(act).rejects.toThrow(common_1.ConflictException);
            expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
            expect(queryRunner.release).toHaveBeenCalled();
        });
        it('debe hacer rollback y lanzar InternalServerErrorException ante un error inesperado', async () => {
            queryRunner.manager.findOneBy.mockRejectedValue(new Error('db down'));
            const act = service.update('cualquier-id', { name: 'X' });
            await expect(act).rejects.toThrow(common_1.InternalServerErrorException);
            expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
            expect(queryRunner.release).toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=rooms.service.spec.js.map