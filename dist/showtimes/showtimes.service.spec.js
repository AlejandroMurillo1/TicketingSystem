"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const typeorm_1 = require("@nestjs/typeorm");
const common_1 = require("@nestjs/common");
const typeorm_2 = require("typeorm");
const showtimes_service_1 = require("./showtimes.service");
const showtime_entity_1 = require("./entities/showtime.entity");
const createRepoMock = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    remove: jest.fn(),
});
const createQRMock = () => ({
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    manager: {
        findOneBy: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
    },
});
const buildMovie = (overrides = {}) => ({ id: 'movie-uuid-001', title: 'Inception', ...overrides });
const buildRoom = (overrides = {}) => ({ id: 'room-uuid-001', name: 'Sala A', ...overrides });
const buildShowtime = (overrides = {}) => ({
    id: 'showtime-uuid-001',
    movie: buildMovie(),
    room: buildRoom(),
    startTime: new Date('2026-11-01T20:00:00Z'),
    price: 15000,
    createdAt: new Date(),
    ...overrides,
});
const buildDto = (overrides = {}) => ({
    movieId: 'movie-uuid-001',
    roomId: 'room-uuid-001',
    startTime: '2026-11-01T20:00:00Z',
    price: 15000,
    ...overrides,
});
const buildDbError = (code, detail = 'db detail') => Object.assign(new Error('db error'), { code, detail });
describe('ShowtimesService', () => {
    let service;
    let showtimeRepo;
    let qr;
    let dataSource;
    beforeEach(async () => {
        showtimeRepo = createRepoMock();
        qr = createQRMock();
        dataSource = { createQueryRunner: jest.fn().mockReturnValue(qr) };
        jest.spyOn(common_1.Logger.prototype, 'error').mockImplementation(() => undefined);
        const module = await testing_1.Test.createTestingModule({
            providers: [
                showtimes_service_1.ShowtimesService,
                { provide: (0, typeorm_1.getRepositoryToken)(showtime_entity_1.Showtime), useValue: showtimeRepo },
                { provide: typeorm_2.DataSource, useValue: dataSource },
            ],
        }).compile();
        service = module.get(showtimes_service_1.ShowtimesService);
    });
    afterEach(() => jest.restoreAllMocks());
    it('debe estar definido', () => {
        expect(service).toBeDefined();
    });
    describe('create', () => {
        it('debe crear la función y hacer commit cuando pelicula, sala y horario son válidos', async () => {
            const dto = buildDto();
            const movie = buildMovie();
            const room = buildRoom();
            const showtime = buildShowtime();
            qr.manager.findOneBy
                .mockResolvedValueOnce(movie)
                .mockResolvedValueOnce(room)
                .mockResolvedValueOnce(null);
            qr.manager.create.mockReturnValue(showtime);
            qr.manager.save.mockResolvedValue(showtime);
            showtimeRepo.findOne.mockResolvedValue(showtime);
            const result = await service.create(dto);
            expect(qr.commitTransaction).toHaveBeenCalled();
            expect(qr.rollbackTransaction).not.toHaveBeenCalled();
            expect(qr.release).toHaveBeenCalled();
            expect(result).toEqual(showtime);
        });
        it('debe hacer rollback y lanzar NotFoundException si la pelicula no existe', async () => {
            qr.manager.findOneBy.mockResolvedValueOnce(null);
            const act = service.create(buildDto());
            await expect(act).rejects.toThrow(common_1.NotFoundException);
            await expect(act).rejects.toThrow('Movie');
            expect(qr.rollbackTransaction).toHaveBeenCalled();
            expect(qr.release).toHaveBeenCalled();
        });
        it('debe hacer rollback y lanzar NotFoundException si la sala no existe', async () => {
            qr.manager.findOneBy
                .mockResolvedValueOnce(buildMovie())
                .mockResolvedValueOnce(null);
            const act = service.create(buildDto());
            await expect(act).rejects.toThrow(common_1.NotFoundException);
            await expect(act).rejects.toThrow('Room');
            expect(qr.rollbackTransaction).toHaveBeenCalled();
        });
        it('debe hacer rollback y lanzar ConflictException si ya existe una función en esa sala y horario', async () => {
            qr.manager.findOneBy
                .mockResolvedValueOnce(buildMovie())
                .mockResolvedValueOnce(buildRoom())
                .mockResolvedValueOnce(buildShowtime());
            const act = service.create(buildDto());
            await expect(act).rejects.toThrow(common_1.ConflictException);
            await expect(act).rejects.toThrow('already has a showtime');
            expect(qr.rollbackTransaction).toHaveBeenCalled();
        });
        it('debe hacer rollback y lanzar InternalServerErrorException ante error inesperado', async () => {
            qr.manager.findOneBy.mockRejectedValue(new Error('db down'));
            const act = service.create(buildDto());
            await expect(act).rejects.toThrow(common_1.InternalServerErrorException);
            expect(qr.rollbackTransaction).toHaveBeenCalled();
        });
    });
    describe('findAll', () => {
        it('debe retornar todas las funciones ordenadas por startTime ASC sin filtros', async () => {
            const showtimes = [buildShowtime(), buildShowtime({ id: 'id-2' })];
            showtimeRepo.find.mockResolvedValue(showtimes);
            const result = await service.findAll({});
            expect(showtimeRepo.find).toHaveBeenCalledWith(expect.objectContaining({ order: { startTime: 'ASC' } }));
            expect(result).toEqual(showtimes);
        });
        it('debe aplicar filtro por movieId y roomId', async () => {
            showtimeRepo.find.mockResolvedValue([buildShowtime()]);
            await service.findAll({ movieId: 'movie-uuid-001', roomId: 'room-uuid-001' });
            expect(showtimeRepo.find).toHaveBeenCalledWith(expect.objectContaining({
                where: expect.objectContaining({
                    movie: { id: 'movie-uuid-001' },
                    room: { id: 'room-uuid-001' },
                }),
            }));
        });
        it('debe aplicar filtro por rango de fechas (fromDate y toDate)', async () => {
            showtimeRepo.find.mockResolvedValue([]);
            await service.findAll({ fromDate: '2026-11-01', toDate: '2026-11-30' });
            const call = showtimeRepo.find.mock.calls[0][0];
            expect(call.where.startTime).toEqual((0, typeorm_2.Between)(new Date('2026-11-01'), new Date('2026-11-30')));
        });
        it('debe aplicar MoreThanOrEqual cuando solo se provee fromDate', async () => {
            showtimeRepo.find.mockResolvedValue([]);
            await service.findAll({ fromDate: '2026-11-01' });
            const call = showtimeRepo.find.mock.calls[0][0];
            expect(call.where.startTime).toEqual((0, typeorm_2.MoreThanOrEqual)(new Date('2026-11-01')));
        });
        it('debe lanzar InternalServerErrorException ante un error inesperado', async () => {
            showtimeRepo.find.mockRejectedValue(new Error('db down'));
            const act = service.findAll({});
            await expect(act).rejects.toThrow(common_1.InternalServerErrorException);
        });
    });
    describe('findById', () => {
        it('debe retornar la función con sus relaciones si existe', async () => {
            const showtime = buildShowtime();
            showtimeRepo.findOne.mockResolvedValue(showtime);
            const result = await service.findById(showtime.id);
            expect(showtimeRepo.findOne).toHaveBeenCalledWith({
                where: { id: showtime.id },
                relations: { movie: true, room: { seats: true } },
            });
            expect(result).toEqual(showtime);
        });
        it('debe lanzar NotFoundException si la función no existe', async () => {
            showtimeRepo.findOne.mockResolvedValue(null);
            const act = service.findById('id-inexistente');
            await expect(act).rejects.toThrow(common_1.NotFoundException);
            await expect(act).rejects.toThrow('id-inexistente');
        });
        it('debe lanzar InternalServerErrorException ante un error inesperado', async () => {
            showtimeRepo.findOne.mockRejectedValue(new Error('db down'));
            const act = service.findById('cualquier-id');
            await expect(act).rejects.toThrow(common_1.InternalServerErrorException);
        });
    });
    describe('remove', () => {
        it('debe eliminar la función si existe', async () => {
            const showtime = buildShowtime();
            showtimeRepo.findOneBy.mockResolvedValue(showtime);
            showtimeRepo.remove.mockResolvedValue(showtime);
            const result = await service.remove(showtime.id);
            expect(showtimeRepo.remove).toHaveBeenCalledWith(showtime);
            expect(result).toBeUndefined();
        });
        it('debe lanzar NotFoundException si la función no existe', async () => {
            showtimeRepo.findOneBy.mockResolvedValue(null);
            const act = service.remove('id-inexistente');
            await expect(act).rejects.toThrow(common_1.NotFoundException);
            expect(showtimeRepo.remove).not.toHaveBeenCalled();
        });
        it('debe traducir la violación de FK (23503) a ConflictException', async () => {
            showtimeRepo.findOneBy.mockResolvedValue(buildShowtime());
            showtimeRepo.remove.mockRejectedValue(buildDbError('23503'));
            const act = service.remove('cualquier-id');
            await expect(act).rejects.toThrow(common_1.ConflictException);
            await expect(act).rejects.toThrow('referenced by reservations');
        });
        it('debe lanzar InternalServerErrorException ante un error inesperado', async () => {
            showtimeRepo.findOneBy.mockResolvedValue(buildShowtime());
            showtimeRepo.remove.mockRejectedValue(new Error('db down'));
            const act = service.remove('cualquier-id');
            await expect(act).rejects.toThrow(common_1.InternalServerErrorException);
        });
    });
});
//# sourceMappingURL=showtimes.service.spec.js.map