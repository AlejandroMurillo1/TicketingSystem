import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
    BadRequestException,
    ConflictException,
    InternalServerErrorException,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { DataSource, ILike, In } from 'typeorm';
import { MoviesService } from './movies.service';
import { Movie } from './entities/movie.entity';
import { CreateMovie } from './dtos/create-movie.dto';

// Fábricas de mocks: se crean nuevos en cada test para evitar
// que las implementaciones "once" de un test se filtren al siguiente.

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

// ──────────────────────────────────────────────────────────────
// Datos de prueba
// ──────────────────────────────────────────────────────────────
const buildMovie = (overrides: Partial<Movie> = {}): Movie => ({
    id: '3f1c2b8e-0000-4000-8000-000000000001',
    title: 'Inception',
    synopsis: 'Un ladrón roba secretos a través de los sueños.',
    durationMinutes: 148,
    genre: 'Sci-Fi',
    rating: '+12',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
});

const buildCreateDto = (overrides: Partial<CreateMovie> = {}): CreateMovie => ({
    title: 'Inception',
    synopsis: 'Un ladrón roba secretos a través de los sueños.',
    durationMinutes: 148,
    genre: 'Sci-Fi',
    rating: '+12',
    ...overrides,
});

// Simula un error de Postgres (los errores del driver traen `code` y `detail`).
const buildDbError = (code: string, detail = 'db detail') =>
    Object.assign(new Error('db error'), { code, detail });

describe('MoviesService', () => {
    let service: MoviesService;
    let movieRepository: ReturnType<typeof createRepositoryMock>;
    let queryRunner: ReturnType<typeof createQueryRunnerMock>;
    let dataSource: { createQueryRunner: jest.Mock };

    beforeEach(async () => {
        movieRepository = createRepositoryMock();
        queryRunner = createQueryRunnerMock();
        dataSource = { createQueryRunner: jest.fn().mockReturnValue(queryRunner) };

        // Silencia los logs de error esperados para mantener limpia la salida de las pruebas.
        jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                MoviesService,
                { provide: getRepositoryToken(Movie), useValue: movieRepository },
                { provide: DataSource, useValue: dataSource },
            ],
        }).compile();

        service = module.get<MoviesService>(MoviesService);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('debe estar definido', () => {
        // Assert
        expect(service).toBeDefined();
    });

    // ════════════════════════════════════════════════════════════
    // create
    // ════════════════════════════════════════════════════════════
    describe('create', () => {
        it('debe crear la película cuando el título no existe', async () => {
            // Arrange
            const dto = buildCreateDto();
            const entity = buildMovie();
            movieRepository.findOneBy.mockResolvedValue(null);
            movieRepository.create.mockReturnValue(entity);
            movieRepository.save.mockResolvedValue(entity);

            // Act
            const result = await service.create(dto);

            // Assert
            expect(movieRepository.findOneBy).toHaveBeenCalledWith({ title: 'Inception' });
            expect(movieRepository.create).toHaveBeenCalledWith({ ...dto, title: 'Inception' });
            expect(movieRepository.save).toHaveBeenCalledWith(entity);
            expect(result).toEqual(entity);
        });

        it('debe guardar el título sin espacios sobrantes', async () => {
            // Arrange
            const dto = buildCreateDto({ title: '   Inception   ' });
            const entity = buildMovie();
            movieRepository.findOneBy.mockResolvedValue(null);
            movieRepository.create.mockReturnValue(entity);
            movieRepository.save.mockResolvedValue(entity);

            // Act
            await service.create(dto);

            // Assert
            expect(movieRepository.findOneBy).toHaveBeenCalledWith({ title: 'Inception' });
            expect(movieRepository.create).toHaveBeenCalledWith({ ...dto, title: 'Inception' });
        });

        it('debe lanzar ConflictException si el título ya existe y no guardar nada', async () => {
            // Arrange
            movieRepository.findOneBy.mockResolvedValue(buildMovie());

            // Act
            const act = service.create(buildCreateDto());

            // Assert
            await expect(act).rejects.toThrow(ConflictException);
            await expect(act).rejects.toThrow('already exists');
            expect(movieRepository.create).not.toHaveBeenCalled();
            expect(movieRepository.save).not.toHaveBeenCalled();
        });

        it('debe traducir la violación de unicidad de Postgres (23505) a ConflictException', async () => {
            // Arrange: simula la carrera entre dos requests (el chequeo previo no vio el duplicado)
            const detail = 'Key (title)=(Inception) already exists.';
            movieRepository.findOneBy.mockResolvedValue(null);
            movieRepository.create.mockReturnValue(buildMovie());
            movieRepository.save.mockRejectedValue(buildDbError('23505', detail));

            // Act
            const act = service.create(buildCreateDto());

            // Assert
            await expect(act).rejects.toThrow(ConflictException);
            await expect(act).rejects.toThrow(detail);
        });

        it('debe lanzar InternalServerErrorException ante un error inesperado', async () => {
            // Arrange
            movieRepository.findOneBy.mockResolvedValue(null);
            movieRepository.create.mockReturnValue(buildMovie());
            movieRepository.save.mockRejectedValue(new Error('db down'));

            // Act
            const act = service.create(buildCreateDto());

            // Assert
            await expect(act).rejects.toThrow(InternalServerErrorException);
        });
    });

    // ════════════════════════════════════════════════════════════
    // bulkCreate
    // ════════════════════════════════════════════════════════════
    describe('bulkCreate', () => {
        it('debe crear todas las películas dentro de una transacción y hacer commit', async () => {
            // Arrange
            const dtos = [
                buildCreateDto({ title: 'Inception' }),
                buildCreateDto({ title: 'Interstellar' }),
            ];
            const entities = dtos.map((d, i) => buildMovie({ id: `id-${i}`, title: d.title }));
            queryRunner.manager.find.mockResolvedValue([]);
            queryRunner.manager.create.mockReturnValue(entities);
            queryRunner.manager.save.mockResolvedValue(entities);

            // Act
            const result = await service.bulkCreate(dtos);

            // Assert
            expect(queryRunner.connect).toHaveBeenCalled();
            expect(queryRunner.startTransaction).toHaveBeenCalled();
            expect(queryRunner.manager.find).toHaveBeenCalledWith(Movie, {
                where: { title: In(['Inception', 'Interstellar']) },
            });
            expect(queryRunner.manager.save).toHaveBeenCalledWith(Movie, entities);
            expect(queryRunner.commitTransaction).toHaveBeenCalled();
            expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
            expect(queryRunner.release).toHaveBeenCalled();
            expect(result).toEqual(entities);
        });

        it('debe normalizar los títulos (trim) antes de guardar', async () => {
            // Arrange
            const dtos = [buildCreateDto({ title: '  Inception  ' })];
            queryRunner.manager.find.mockResolvedValue([]);
            queryRunner.manager.create.mockReturnValue([buildMovie()]);
            queryRunner.manager.save.mockResolvedValue([buildMovie()]);

            // Act
            await service.bulkCreate(dtos);

            // Assert
            expect(queryRunner.manager.create).toHaveBeenCalledWith(Movie, [
                { ...dtos[0], title: 'Inception' },
            ]);
        });

        it('debe lanzar BadRequestException si el lote está vacío, sin abrir transacción', async () => {
            // Arrange
            const emptyBatch: CreateMovie[] = [];

            // Act
            const act = service.bulkCreate(emptyBatch);

            // Assert
            await expect(act).rejects.toThrow(BadRequestException);
            expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
        });

        it('debe lanzar BadRequestException si el lote es nulo', async () => {
            // Arrange
            const nullBatch = null as unknown as CreateMovie[];

            // Act
            const act = service.bulkCreate(nullBatch);

            // Assert
            await expect(act).rejects.toThrow(BadRequestException);
            expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
        });

        it('debe hacer rollback si hay títulos duplicados dentro del mismo lote (incluso con espacios)', async () => {
            // Arrange
            const dtos = [
                buildCreateDto({ title: 'Avatar' }),
                buildCreateDto({ title: 'Avatar ' }),
            ];

            // Act
            const act = service.bulkCreate(dtos);

            // Assert
            await expect(act).rejects.toThrow(ConflictException);
            await expect(act).rejects.toThrow('Duplicate movie titles in request: Avatar');
            expect(queryRunner.manager.find).not.toHaveBeenCalled();
            expect(queryRunner.manager.save).not.toHaveBeenCalled();
            expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
            expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
            expect(queryRunner.release).toHaveBeenCalled();
        });

        it('debe hacer rollback si alguna película ya existe en base de datos', async () => {
            // Arrange
            const dtos = [
                buildCreateDto({ title: 'Inception' }),
                buildCreateDto({ title: 'Interstellar' }),
            ];
            queryRunner.manager.find.mockResolvedValue([buildMovie({ title: 'Inception' })]);

            // Act
            const act = service.bulkCreate(dtos);

            // Assert
            await expect(act).rejects.toThrow(ConflictException);
            await expect(act).rejects.toThrow('Movie(s) already exist: Inception');
            expect(queryRunner.manager.save).not.toHaveBeenCalled();
            expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
            expect(queryRunner.release).toHaveBeenCalled();
        });

        it('debe hacer rollback y liberar el queryRunner ante un error inesperado en el save', async () => {
            // Arrange
            queryRunner.manager.find.mockResolvedValue([]);
            queryRunner.manager.create.mockReturnValue([buildMovie()]);
            queryRunner.manager.save.mockRejectedValue(new Error('db down'));

            // Act
            const act = service.bulkCreate([buildCreateDto()]);

            // Assert
            await expect(act).rejects.toThrow(InternalServerErrorException);
            expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
            expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
            expect(queryRunner.release).toHaveBeenCalled();
        });
    });

    // ════════════════════════════════════════════════════════════
    // findAll
    // ════════════════════════════════════════════════════════════
    describe('findAll', () => {
        it('debe aplicar paginación por defecto (limit 10, offset 0) y orden por fecha de creación', async () => {
            // Arrange
            const movies = [buildMovie({ id: '1' }), buildMovie({ id: '2', title: 'Interstellar' })];
            movieRepository.findAndCount.mockResolvedValue([movies, 2]);

            // Act
            const result = await service.findAll({});

            // Assert
            expect(movieRepository.findAndCount).toHaveBeenCalledWith({
                where: {},
                take: 10,
                skip: 0,
                order: { createdAt: 'DESC' },
            });
            expect(result).toEqual({ data: movies, total: 2, limit: 10, offset: 0 });
        });

        it('debe respetar el limit y offset recibidos', async () => {
            // Arrange
            movieRepository.findAndCount.mockResolvedValue([[buildMovie()], 25]);

            // Act
            const result = await service.findAll({ limit: 5, offset: 10 });

            // Assert
            expect(movieRepository.findAndCount).toHaveBeenCalledWith(
                expect.objectContaining({ take: 5, skip: 10 }),
            );
            expect(result.total).toBe(25);
            expect(result.limit).toBe(5);
            expect(result.offset).toBe(10);
        });

        it('debe filtrar por título (búsqueda parcial, sin espacios sobrantes)', async () => {
            // Arrange
            movieRepository.findAndCount.mockResolvedValue([[buildMovie()], 1]);

            // Act
            await service.findAll({ title: '  ince ' });

            // Assert
            expect(movieRepository.findAndCount).toHaveBeenCalledWith(
                expect.objectContaining({ where: { title: ILike('%ince%') } }),
            );
        });

        it('debe filtrar por género', async () => {
            // Arrange
            movieRepository.findAndCount.mockResolvedValue([[buildMovie()], 1]);

            // Act
            await service.findAll({ genre: ' sci-fi ' });

            // Assert
            expect(movieRepository.findAndCount).toHaveBeenCalledWith(
                expect.objectContaining({ where: { genre: ILike('sci-fi') } }),
            );
        });

        it('debe combinar los filtros de título y género', async () => {
            // Arrange
            movieRepository.findAndCount.mockResolvedValue([[buildMovie()], 1]);

            // Act
            await service.findAll({ title: 'ince', genre: 'Sci-Fi' });

            // Assert
            expect(movieRepository.findAndCount).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { title: ILike('%ince%'), genre: ILike('Sci-Fi') },
                }),
            );
        });

        it('debe retornar una lista vacía cuando no hay resultados', async () => {
            // Arrange
            movieRepository.findAndCount.mockResolvedValue([[], 0]);

            // Act
            const result = await service.findAll({});

            // Assert
            expect(result.data).toEqual([]);
            expect(result.total).toBe(0);
        });

        it('debe lanzar InternalServerErrorException ante un error inesperado', async () => {
            // Arrange
            movieRepository.findAndCount.mockRejectedValue(new Error('db down'));

            // Act
            const act = service.findAll({});

            // Assert
            await expect(act).rejects.toThrow(InternalServerErrorException);
        });
    });

    // ════════════════════════════════════════════════════════════
    // findById
    // ════════════════════════════════════════════════════════════
    describe('findById', () => {
        it('debe retornar la película si existe', async () => {
            // Arrange
            const movie = buildMovie();
            movieRepository.findOneBy.mockResolvedValue(movie);

            // Act
            const result = await service.findById(movie.id);

            // Assert
            expect(movieRepository.findOneBy).toHaveBeenCalledWith({ id: movie.id });
            expect(result).toEqual(movie);
        });

        it('debe lanzar NotFoundException si no existe (y no convertirla en 500)', async () => {
            // Arrange
            movieRepository.findOneBy.mockResolvedValue(null);

            // Act
            const act = service.findById('id-inexistente');

            // Assert
            await expect(act).rejects.toThrow(NotFoundException);
            await expect(act).rejects.toThrow('id-inexistente');
        });

        it('debe lanzar InternalServerErrorException ante un error inesperado', async () => {
            // Arrange
            movieRepository.findOneBy.mockRejectedValue(new Error('db down'));

            // Act
            const act = service.findById('cualquier-id');

            // Assert
            await expect(act).rejects.toThrow(InternalServerErrorException);
        });
    });

    // ════════════════════════════════════════════════════════════
    // findByTitle
    // ════════════════════════════════════════════════════════════
    describe('findByTitle', () => {
        it('debe retornar la película si existe, buscando con el título sin espacios sobrantes', async () => {
            // Arrange
            const movie = buildMovie();
            movieRepository.findOneBy.mockResolvedValue(movie);

            // Act
            const result = await service.findByTitle('  Inception ');

            // Assert
            expect(movieRepository.findOneBy).toHaveBeenCalledWith({ title: 'Inception' });
            expect(result).toEqual(movie);
        });

        it('debe retornar null (sin lanzar excepción) si no existe', async () => {
            // Arrange
            movieRepository.findOneBy.mockResolvedValue(null);

            // Act
            const result = await service.findByTitle('Inexistente');

            // Assert
            expect(result).toBeNull();
        });

        it('debe lanzar InternalServerErrorException ante un error inesperado', async () => {
            // Arrange
            movieRepository.findOneBy.mockRejectedValue(new Error('db down'));

            // Act
            const act = service.findByTitle('Inception');

            // Assert
            await expect(act).rejects.toThrow(InternalServerErrorException);
        });
    });

    // ════════════════════════════════════════════════════════════
    // update (transaccional)
    // ════════════════════════════════════════════════════════════
    describe('update', () => {
        it('debe actualizar el título dentro de una transacción y hacer commit', async () => {
            // Arrange
            const existing = buildMovie({ title: 'Inception' });
            const updated = buildMovie({ title: 'Interstellar' });
            queryRunner.manager.findOneBy
                .mockResolvedValueOnce(existing) // búsqueda por id
                .mockResolvedValueOnce(null); // chequeo de título duplicado
            queryRunner.manager.save.mockResolvedValue(updated);

            // Act
            const result = await service.update(existing.id, { title: '  Interstellar ' });

            // Assert
            expect(queryRunner.manager.findOneBy).toHaveBeenNthCalledWith(1, Movie, { id: existing.id });
            expect(queryRunner.manager.findOneBy).toHaveBeenNthCalledWith(2, Movie, { title: 'Interstellar' });
            expect(queryRunner.manager.merge).toHaveBeenCalledWith(Movie, existing, { title: 'Interstellar' });
            expect(queryRunner.manager.save).toHaveBeenCalledWith(existing);
            expect(queryRunner.commitTransaction).toHaveBeenCalled();
            expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
            expect(queryRunner.release).toHaveBeenCalled();
            expect(result).toEqual(updated);
        });

        it('no debe verificar duplicados si el título no viene en el payload', async () => {
            // Arrange
            const existing = buildMovie();
            queryRunner.manager.findOneBy.mockResolvedValueOnce(existing);
            queryRunner.manager.save.mockResolvedValue(existing);

            // Act
            await service.update(existing.id, { synopsis: 'Nueva sinopsis' });

            // Assert
            expect(queryRunner.manager.findOneBy).toHaveBeenCalledTimes(1);
            expect(queryRunner.manager.merge).toHaveBeenCalledWith(Movie, existing, {
                synopsis: 'Nueva sinopsis',
            });
            expect(queryRunner.commitTransaction).toHaveBeenCalled();
        });

        it('no debe verificar duplicados si el título (normalizado) no cambió', async () => {
            // Arrange
            const existing = buildMovie({ title: 'Inception' });
            queryRunner.manager.findOneBy.mockResolvedValueOnce(existing);
            queryRunner.manager.save.mockResolvedValue(existing);

            // Act
            await service.update(existing.id, { title: ' Inception ' });

            // Assert
            expect(queryRunner.manager.findOneBy).toHaveBeenCalledTimes(1);
            expect(queryRunner.commitTransaction).toHaveBeenCalled();
        });

        it('debe hacer rollback y lanzar NotFoundException si la película no existe', async () => {
            // Arrange
            queryRunner.manager.findOneBy.mockResolvedValueOnce(null);

            // Act
            const act = service.update('id-inexistente', { title: 'X' });

            // Assert
            await expect(act).rejects.toThrow(NotFoundException);
            expect(queryRunner.manager.save).not.toHaveBeenCalled();
            expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
            expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
            expect(queryRunner.release).toHaveBeenCalled();
        });

        it('debe hacer rollback y lanzar ConflictException si el nuevo título ya lo usa otra película', async () => {
            // Arrange
            const existing = buildMovie({ title: 'Inception' });
            const duplicate = buildMovie({ id: 'otro-id', title: 'Interstellar' });
            queryRunner.manager.findOneBy
                .mockResolvedValueOnce(existing)
                .mockResolvedValueOnce(duplicate);

            // Act
            const act = service.update(existing.id, { title: 'Interstellar' });

            // Assert
            await expect(act).rejects.toThrow(ConflictException);
            await expect(act).rejects.toThrow('already exists');
            expect(queryRunner.manager.save).not.toHaveBeenCalled();
            expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
            expect(queryRunner.release).toHaveBeenCalled();
        });

        it('debe traducir la violación de unicidad de Postgres (23505) durante el save a ConflictException', async () => {
            // Arrange
            const existing = buildMovie();
            queryRunner.manager.findOneBy.mockResolvedValueOnce(existing);
            queryRunner.manager.save.mockRejectedValue(buildDbError('23505', 'título duplicado'));

            // Act
            const act = service.update(existing.id, { synopsis: 'x' });

            // Assert
            await expect(act).rejects.toThrow(ConflictException);
            expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
        });

        it('debe hacer rollback y liberar el queryRunner ante un error inesperado', async () => {
            // Arrange
            queryRunner.manager.findOneBy.mockRejectedValueOnce(new Error('conexión perdida'));

            // Act
            const act = service.update('cualquier-id', { title: 'X' });

            // Assert
            await expect(act).rejects.toThrow(InternalServerErrorException);
            expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
            expect(queryRunner.release).toHaveBeenCalled();
        });
    });

    // ════════════════════════════════════════════════════════════
    // remove
    // ════════════════════════════════════════════════════════════
    describe('remove', () => {
        it('debe eliminar la película si existe', async () => {
            // Arrange
            const movie = buildMovie();
            movieRepository.findOneBy.mockResolvedValue(movie);
            movieRepository.remove.mockResolvedValue(movie);

            // Act
            const result = await service.remove(movie.id);

            // Assert
            expect(movieRepository.findOneBy).toHaveBeenCalledWith({ id: movie.id });
            expect(movieRepository.remove).toHaveBeenCalledWith(movie);
            expect(result).toBeUndefined();
        });

        it('debe lanzar NotFoundException si la película no existe y no intentar borrar', async () => {
            // Arrange
            movieRepository.findOneBy.mockResolvedValue(null);

            // Act
            const act = service.remove('id-inexistente');

            // Assert
            await expect(act).rejects.toThrow(NotFoundException);
            expect(movieRepository.remove).not.toHaveBeenCalled();
        });

        it('debe traducir la violación de llave foránea (23503) a ConflictException', async () => {
            // Arrange: la película ya tiene funciones asociadas
            movieRepository.findOneBy.mockResolvedValue(buildMovie());
            movieRepository.remove.mockRejectedValue(buildDbError('23503'));

            // Act
            const act = service.remove('cualquier-id');

            // Assert
            await expect(act).rejects.toThrow(ConflictException);
            await expect(act).rejects.toThrow('referenced by other records');
        });

        it('debe lanzar InternalServerErrorException ante un error inesperado', async () => {
            // Arrange
            movieRepository.findOneBy.mockResolvedValue(buildMovie());
            movieRepository.remove.mockRejectedValue(new Error('db down'));

            // Act
            const act = service.remove('cualquier-id');

            // Assert
            await expect(act).rejects.toThrow(InternalServerErrorException);
        });
    });
});