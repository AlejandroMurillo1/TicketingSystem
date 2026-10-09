"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const typeorm_1 = require("@nestjs/typeorm");
const common_1 = require("@nestjs/common");
const typeorm_2 = require("typeorm");
const movies_service_1 = require("./movies.service");
const movie_entity_1 = require("./entities/movie.entity");
const createRepositoryMock = () => ({
    findOneBy: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
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
        find: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        merge: jest.fn(),
    },
});
const buildMovie = (overrides = {}) => ({
    id: '3f1c2b8e-0000-4000-8000-000000000001',
    title: 'Inception',
    synopsis: 'Un ladrón roba secretos a través de los sueños.',
    durationMinutes: 148,
    genre: 'Sci-Fi',
    rating: '+12',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
});
const buildCreateDto = (overrides = {}) => ({
    title: 'Inception',
    synopsis: 'Un ladrón roba secretos a través de los sueños.',
    durationMinutes: 148,
    genre: 'Sci-Fi',
    rating: '+12',
    ...overrides,
});
const buildDbError = (code, detail = 'db detail') => Object.assign(new Error('db error'), { code, detail });
describe('MoviesService', () => {
    let service;
    let movieRepository;
    let queryRunner;
    let dataSource;
    beforeEach(async () => {
        movieRepository = createRepositoryMock();
        queryRunner = createQueryRunnerMock();
        dataSource = { createQueryRunner: jest.fn().mockReturnValue(queryRunner) };
        jest.spyOn(common_1.Logger.prototype, 'error').mockImplementation(() => undefined);
        const module = await testing_1.Test.createTestingModule({
            providers: [
                movies_service_1.MoviesService,
                { provide: (0, typeorm_1.getRepositoryToken)(movie_entity_1.Movie), useValue: movieRepository },
                { provide: typeorm_2.DataSource, useValue: dataSource },
            ],
        }).compile();
        service = module.get(movies_service_1.MoviesService);
    });
    afterEach(() => {
        jest.restoreAllMocks();
    });
    it('debe estar definido', () => {
        expect(service).toBeDefined();
    });
    describe('create', () => {
        it('debe crear la película cuando el título no existe', async () => {
            const dto = buildCreateDto();
            const entity = buildMovie();
            movieRepository.findOneBy.mockResolvedValue(null);
            movieRepository.create.mockReturnValue(entity);
            movieRepository.save.mockResolvedValue(entity);
            const result = await service.create(dto);
            expect(movieRepository.findOneBy).toHaveBeenCalledWith({ title: 'Inception' });
            expect(movieRepository.create).toHaveBeenCalledWith({ ...dto, title: 'Inception' });
            expect(movieRepository.save).toHaveBeenCalledWith(entity);
            expect(result).toEqual(entity);
        });
        it('debe guardar el título sin espacios sobrantes', async () => {
            const dto = buildCreateDto({ title: '   Inception   ' });
            const entity = buildMovie();
            movieRepository.findOneBy.mockResolvedValue(null);
            movieRepository.create.mockReturnValue(entity);
            movieRepository.save.mockResolvedValue(entity);
            await service.create(dto);
            expect(movieRepository.findOneBy).toHaveBeenCalledWith({ title: 'Inception' });
            expect(movieRepository.create).toHaveBeenCalledWith({ ...dto, title: 'Inception' });
        });
        it('debe lanzar ConflictException si el título ya existe y no guardar nada', async () => {
            movieRepository.findOneBy.mockResolvedValue(buildMovie());
            const act = service.create(buildCreateDto());
            await expect(act).rejects.toThrow(common_1.ConflictException);
            await expect(act).rejects.toThrow('already exists');
            expect(movieRepository.create).not.toHaveBeenCalled();
            expect(movieRepository.save).not.toHaveBeenCalled();
        });
        it('debe traducir la violación de unicidad de Postgres (23505) a ConflictException', async () => {
            const detail = 'Key (title)=(Inception) already exists.';
            movieRepository.findOneBy.mockResolvedValue(null);
            movieRepository.create.mockReturnValue(buildMovie());
            movieRepository.save.mockRejectedValue(buildDbError('23505', detail));
            const act = service.create(buildCreateDto());
            await expect(act).rejects.toThrow(common_1.ConflictException);
            await expect(act).rejects.toThrow(detail);
        });
        it('debe lanzar InternalServerErrorException ante un error inesperado', async () => {
            movieRepository.findOneBy.mockResolvedValue(null);
            movieRepository.create.mockReturnValue(buildMovie());
            movieRepository.save.mockRejectedValue(new Error('db down'));
            const act = service.create(buildCreateDto());
            await expect(act).rejects.toThrow(common_1.InternalServerErrorException);
        });
    });
    describe('bulkCreate', () => {
        it('debe crear todas las películas dentro de una transacción y hacer commit', async () => {
            const dtos = [
                buildCreateDto({ title: 'Inception' }),
                buildCreateDto({ title: 'Interstellar' }),
            ];
            const entities = dtos.map((d, i) => buildMovie({ id: `id-${i}`, title: d.title }));
            queryRunner.manager.find.mockResolvedValue([]);
            queryRunner.manager.create.mockReturnValue(entities);
            queryRunner.manager.save.mockResolvedValue(entities);
            const result = await service.bulkCreate(dtos);
            expect(queryRunner.connect).toHaveBeenCalled();
            expect(queryRunner.startTransaction).toHaveBeenCalled();
            expect(queryRunner.manager.find).toHaveBeenCalledWith(movie_entity_1.Movie, {
                where: { title: (0, typeorm_2.In)(['Inception', 'Interstellar']) },
            });
            expect(queryRunner.manager.save).toHaveBeenCalledWith(movie_entity_1.Movie, entities);
            expect(queryRunner.commitTransaction).toHaveBeenCalled();
            expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
            expect(queryRunner.release).toHaveBeenCalled();
            expect(result).toEqual(entities);
        });
        it('debe normalizar los títulos (trim) antes de guardar', async () => {
            const dtos = [buildCreateDto({ title: '  Inception  ' })];
            queryRunner.manager.find.mockResolvedValue([]);
            queryRunner.manager.create.mockReturnValue([buildMovie()]);
            queryRunner.manager.save.mockResolvedValue([buildMovie()]);
            await service.bulkCreate(dtos);
            expect(queryRunner.manager.create).toHaveBeenCalledWith(movie_entity_1.Movie, [
                { ...dtos[0], title: 'Inception' },
            ]);
        });
        it('debe lanzar BadRequestException si el lote está vacío, sin abrir transacción', async () => {
            const emptyBatch = [];
            const act = service.bulkCreate(emptyBatch);
            await expect(act).rejects.toThrow(common_1.BadRequestException);
            expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
        });
        it('debe lanzar BadRequestException si el lote es nulo', async () => {
            const nullBatch = null;
            const act = service.bulkCreate(nullBatch);
            await expect(act).rejects.toThrow(common_1.BadRequestException);
            expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
        });
        it('debe hacer rollback si hay títulos duplicados dentro del mismo lote (incluso con espacios)', async () => {
            const dtos = [
                buildCreateDto({ title: 'Avatar' }),
                buildCreateDto({ title: 'Avatar ' }),
            ];
            const act = service.bulkCreate(dtos);
            await expect(act).rejects.toThrow(common_1.ConflictException);
            await expect(act).rejects.toThrow('Duplicate movie titles in request: Avatar');
            expect(queryRunner.manager.find).not.toHaveBeenCalled();
            expect(queryRunner.manager.save).not.toHaveBeenCalled();
            expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
            expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
            expect(queryRunner.release).toHaveBeenCalled();
        });
        it('debe hacer rollback si alguna película ya existe en base de datos', async () => {
            const dtos = [
                buildCreateDto({ title: 'Inception' }),
                buildCreateDto({ title: 'Interstellar' }),
            ];
            queryRunner.manager.find.mockResolvedValue([buildMovie({ title: 'Inception' })]);
            const act = service.bulkCreate(dtos);
            await expect(act).rejects.toThrow(common_1.ConflictException);
            await expect(act).rejects.toThrow('Movie(s) already exist: Inception');
            expect(queryRunner.manager.save).not.toHaveBeenCalled();
            expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
            expect(queryRunner.release).toHaveBeenCalled();
        });
        it('debe hacer rollback y liberar el queryRunner ante un error inesperado en el save', async () => {
            queryRunner.manager.find.mockResolvedValue([]);
            queryRunner.manager.create.mockReturnValue([buildMovie()]);
            queryRunner.manager.save.mockRejectedValue(new Error('db down'));
            const act = service.bulkCreate([buildCreateDto()]);
            await expect(act).rejects.toThrow(common_1.InternalServerErrorException);
            expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
            expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
            expect(queryRunner.release).toHaveBeenCalled();
        });
    });
    describe('findAll', () => {
        it('debe aplicar paginación por defecto (limit 10, offset 0) y orden por fecha de creación', async () => {
            const movies = [buildMovie({ id: '1' }), buildMovie({ id: '2', title: 'Interstellar' })];
            movieRepository.findAndCount.mockResolvedValue([movies, 2]);
            const result = await service.findAll({});
            expect(movieRepository.findAndCount).toHaveBeenCalledWith({
                where: {},
                take: 10,
                skip: 0,
                order: { createdAt: 'DESC' },
            });
            expect(result).toEqual({ data: movies, total: 2, limit: 10, offset: 0 });
        });
        it('debe respetar el limit y offset recibidos', async () => {
            movieRepository.findAndCount.mockResolvedValue([[buildMovie()], 25]);
            const result = await service.findAll({ limit: 5, offset: 10 });
            expect(movieRepository.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ take: 5, skip: 10 }));
            expect(result.total).toBe(25);
            expect(result.limit).toBe(5);
            expect(result.offset).toBe(10);
        });
        it('debe filtrar por título (búsqueda parcial, sin espacios sobrantes)', async () => {
            movieRepository.findAndCount.mockResolvedValue([[buildMovie()], 1]);
            await service.findAll({ title: '  ince ' });
            expect(movieRepository.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ where: { title: (0, typeorm_2.ILike)('%ince%') } }));
        });
        it('debe filtrar por género', async () => {
            movieRepository.findAndCount.mockResolvedValue([[buildMovie()], 1]);
            await service.findAll({ genre: ' sci-fi ' });
            expect(movieRepository.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ where: { genre: (0, typeorm_2.ILike)('sci-fi') } }));
        });
        it('debe combinar los filtros de título y género', async () => {
            movieRepository.findAndCount.mockResolvedValue([[buildMovie()], 1]);
            await service.findAll({ title: 'ince', genre: 'Sci-Fi' });
            expect(movieRepository.findAndCount).toHaveBeenCalledWith(expect.objectContaining({
                where: { title: (0, typeorm_2.ILike)('%ince%'), genre: (0, typeorm_2.ILike)('Sci-Fi') },
            }));
        });
        it('debe retornar una lista vacía cuando no hay resultados', async () => {
            movieRepository.findAndCount.mockResolvedValue([[], 0]);
            const result = await service.findAll({});
            expect(result.data).toEqual([]);
            expect(result.total).toBe(0);
        });
        it('debe lanzar InternalServerErrorException ante un error inesperado', async () => {
            movieRepository.findAndCount.mockRejectedValue(new Error('db down'));
            const act = service.findAll({});
            await expect(act).rejects.toThrow(common_1.InternalServerErrorException);
        });
    });
    describe('findById', () => {
        it('debe retornar la película si existe', async () => {
            const movie = buildMovie();
            movieRepository.findOneBy.mockResolvedValue(movie);
            const result = await service.findById(movie.id);
            expect(movieRepository.findOneBy).toHaveBeenCalledWith({ id: movie.id });
            expect(result).toEqual(movie);
        });
        it('debe lanzar NotFoundException si no existe (y no convertirla en 500)', async () => {
            movieRepository.findOneBy.mockResolvedValue(null);
            const act = service.findById('id-inexistente');
            await expect(act).rejects.toThrow(common_1.NotFoundException);
            await expect(act).rejects.toThrow('id-inexistente');
        });
        it('debe lanzar InternalServerErrorException ante un error inesperado', async () => {
            movieRepository.findOneBy.mockRejectedValue(new Error('db down'));
            const act = service.findById('cualquier-id');
            await expect(act).rejects.toThrow(common_1.InternalServerErrorException);
        });
    });
    describe('findByTitle', () => {
        it('debe retornar la película si existe, buscando con el título sin espacios sobrantes', async () => {
            const movie = buildMovie();
            movieRepository.findOneBy.mockResolvedValue(movie);
            const result = await service.findByTitle('  Inception ');
            expect(movieRepository.findOneBy).toHaveBeenCalledWith({ title: 'Inception' });
            expect(result).toEqual(movie);
        });
        it('debe retornar null (sin lanzar excepción) si no existe', async () => {
            movieRepository.findOneBy.mockResolvedValue(null);
            const result = await service.findByTitle('Inexistente');
            expect(result).toBeNull();
        });
        it('debe lanzar InternalServerErrorException ante un error inesperado', async () => {
            movieRepository.findOneBy.mockRejectedValue(new Error('db down'));
            const act = service.findByTitle('Inception');
            await expect(act).rejects.toThrow(common_1.InternalServerErrorException);
        });
    });
    describe('update', () => {
        it('debe actualizar el título dentro de una transacción y hacer commit', async () => {
            const existing = buildMovie({ title: 'Inception' });
            const updated = buildMovie({ title: 'Interstellar' });
            queryRunner.manager.findOneBy
                .mockResolvedValueOnce(existing)
                .mockResolvedValueOnce(null);
            queryRunner.manager.save.mockResolvedValue(updated);
            const result = await service.update(existing.id, { title: '  Interstellar ' });
            expect(queryRunner.manager.findOneBy).toHaveBeenNthCalledWith(1, movie_entity_1.Movie, { id: existing.id });
            expect(queryRunner.manager.findOneBy).toHaveBeenNthCalledWith(2, movie_entity_1.Movie, { title: 'Interstellar' });
            expect(queryRunner.manager.merge).toHaveBeenCalledWith(movie_entity_1.Movie, existing, { title: 'Interstellar' });
            expect(queryRunner.manager.save).toHaveBeenCalledWith(existing);
            expect(queryRunner.commitTransaction).toHaveBeenCalled();
            expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
            expect(queryRunner.release).toHaveBeenCalled();
            expect(result).toEqual(updated);
        });
        it('no debe verificar duplicados si el título no viene en el payload', async () => {
            const existing = buildMovie();
            queryRunner.manager.findOneBy.mockResolvedValueOnce(existing);
            queryRunner.manager.save.mockResolvedValue(existing);
            await service.update(existing.id, { synopsis: 'Nueva sinopsis' });
            expect(queryRunner.manager.findOneBy).toHaveBeenCalledTimes(1);
            expect(queryRunner.manager.merge).toHaveBeenCalledWith(movie_entity_1.Movie, existing, {
                synopsis: 'Nueva sinopsis',
            });
            expect(queryRunner.commitTransaction).toHaveBeenCalled();
        });
        it('no debe verificar duplicados si el título (normalizado) no cambió', async () => {
            const existing = buildMovie({ title: 'Inception' });
            queryRunner.manager.findOneBy.mockResolvedValueOnce(existing);
            queryRunner.manager.save.mockResolvedValue(existing);
            await service.update(existing.id, { title: ' Inception ' });
            expect(queryRunner.manager.findOneBy).toHaveBeenCalledTimes(1);
            expect(queryRunner.commitTransaction).toHaveBeenCalled();
        });
        it('debe hacer rollback y lanzar NotFoundException si la película no existe', async () => {
            queryRunner.manager.findOneBy.mockResolvedValueOnce(null);
            const act = service.update('id-inexistente', { title: 'X' });
            await expect(act).rejects.toThrow(common_1.NotFoundException);
            expect(queryRunner.manager.save).not.toHaveBeenCalled();
            expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
            expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
            expect(queryRunner.release).toHaveBeenCalled();
        });
        it('debe hacer rollback y lanzar ConflictException si el nuevo título ya lo usa otra película', async () => {
            const existing = buildMovie({ title: 'Inception' });
            const duplicate = buildMovie({ id: 'otro-id', title: 'Interstellar' });
            queryRunner.manager.findOneBy
                .mockResolvedValueOnce(existing)
                .mockResolvedValueOnce(duplicate);
            const act = service.update(existing.id, { title: 'Interstellar' });
            await expect(act).rejects.toThrow(common_1.ConflictException);
            await expect(act).rejects.toThrow('already exists');
            expect(queryRunner.manager.save).not.toHaveBeenCalled();
            expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
            expect(queryRunner.release).toHaveBeenCalled();
        });
        it('debe traducir la violación de unicidad de Postgres (23505) durante el save a ConflictException', async () => {
            const existing = buildMovie();
            queryRunner.manager.findOneBy.mockResolvedValueOnce(existing);
            queryRunner.manager.save.mockRejectedValue(buildDbError('23505', 'título duplicado'));
            const act = service.update(existing.id, { synopsis: 'x' });
            await expect(act).rejects.toThrow(common_1.ConflictException);
            expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
        });
        it('debe hacer rollback y liberar el queryRunner ante un error inesperado', async () => {
            queryRunner.manager.findOneBy.mockRejectedValueOnce(new Error('conexión perdida'));
            const act = service.update('cualquier-id', { title: 'X' });
            await expect(act).rejects.toThrow(common_1.InternalServerErrorException);
            expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
            expect(queryRunner.release).toHaveBeenCalled();
        });
    });
    describe('remove', () => {
        it('debe eliminar la película si existe', async () => {
            const movie = buildMovie();
            movieRepository.findOneBy.mockResolvedValue(movie);
            movieRepository.remove.mockResolvedValue(movie);
            const result = await service.remove(movie.id);
            expect(movieRepository.findOneBy).toHaveBeenCalledWith({ id: movie.id });
            expect(movieRepository.remove).toHaveBeenCalledWith(movie);
            expect(result).toBeUndefined();
        });
        it('debe lanzar NotFoundException si la película no existe y no intentar borrar', async () => {
            movieRepository.findOneBy.mockResolvedValue(null);
            const act = service.remove('id-inexistente');
            await expect(act).rejects.toThrow(common_1.NotFoundException);
            expect(movieRepository.remove).not.toHaveBeenCalled();
        });
        it('debe traducir la violación de llave foránea (23503) a ConflictException', async () => {
            movieRepository.findOneBy.mockResolvedValue(buildMovie());
            movieRepository.remove.mockRejectedValue(buildDbError('23503'));
            const act = service.remove('cualquier-id');
            await expect(act).rejects.toThrow(common_1.ConflictException);
            await expect(act).rejects.toThrow('referenced by other records');
        });
        it('debe lanzar InternalServerErrorException ante un error inesperado', async () => {
            movieRepository.findOneBy.mockResolvedValue(buildMovie());
            movieRepository.remove.mockRejectedValue(new Error('db down'));
            const act = service.remove('cualquier-id');
            await expect(act).rejects.toThrow(common_1.InternalServerErrorException);
        });
    });
});
//# sourceMappingURL=movies.service.spec.js.map