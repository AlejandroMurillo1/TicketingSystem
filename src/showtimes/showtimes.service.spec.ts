import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ConflictException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Between, DataSource, MoreThanOrEqual } from 'typeorm';
import { ShowtimesService } from './showtimes.service';
import { Showtime } from './entities/showtime.entity';
import { Movie } from '../movies/entities/movie.entity';
import { Room } from '../rooms/entities/room.entity';

// ─── Mock factories ───────────────────────────────────────────
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

// ─── Test data ────────────────────────────────────────────────────
const buildMovie = (overrides: Partial<Movie> = {}): Movie =>
  ({ id: 'movie-uuid-001', title: 'Inception', ...overrides } as Movie);

const buildRoom = (overrides: Partial<Room> = {}): Room =>
  ({ id: 'room-uuid-001', name: 'Sala A', ...overrides } as Room);

const buildShowtime = (overrides: Partial<Showtime> = {}): Showtime =>
  ({
    id: 'showtime-uuid-001',
    movie: buildMovie(),
    room: buildRoom(),
    startTime: new Date('2026-11-01T20:00:00Z'),
    price: 15000,
    createdAt: new Date(),
    ...overrides,
  } as Showtime);

const buildDto = (overrides = {}) => ({
  movieId: 'movie-uuid-001',
  roomId: 'room-uuid-001',
  startTime: '2026-11-01T20:00:00Z',
  price: 15000,
  ...overrides,
});

const buildDbError = (code: string, detail = 'db detail') =>
  Object.assign(new Error('db error'), { code, detail });

// ─── Suite ───────────────────────────────────────────────────────────
describe('ShowtimesService', () => {
  let service: ShowtimesService;
  let showtimeRepo: ReturnType<typeof createRepoMock>;
  let qr: ReturnType<typeof createQRMock>;
  let dataSource: { createQueryRunner: jest.Mock };

  beforeEach(async () => {
    showtimeRepo = createRepoMock();
    qr = createQRMock();
    dataSource = { createQueryRunner: jest.fn().mockReturnValue(qr) };

    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShowtimesService,
        { provide: getRepositoryToken(Showtime), useValue: showtimeRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<ShowtimesService>(ShowtimesService);
  });

  afterEach(() => jest.restoreAllMocks());

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  // ══════════════════════════════════════════════════════════════
  // create
  // ══════════════════════════════════════════════════════════════
  describe('create', () => {
    it('debe crear la función y hacer commit cuando pelicula, sala y horario son válidos', async () => {
      // Arrange
      const dto = buildDto();
      const movie = buildMovie();
      const room = buildRoom();
      const showtime = buildShowtime();

      qr.manager.findOneBy
        .mockResolvedValueOnce(movie)     // buscar película
        .mockResolvedValueOnce(room)      // buscar sala
        .mockResolvedValueOnce(null);     // sin conflicto de horario
      qr.manager.create.mockReturnValue(showtime);
      qr.manager.save.mockResolvedValue(showtime);
      showtimeRepo.findOne.mockResolvedValue(showtime);

      // Act
      const result = await service.create(dto);

      // Assert
      expect(qr.commitTransaction).toHaveBeenCalled();
      expect(qr.rollbackTransaction).not.toHaveBeenCalled();
      expect(qr.release).toHaveBeenCalled();
      expect(result).toEqual(showtime);
    });

    it('debe hacer rollback y lanzar NotFoundException si la pelicula no existe', async () => {
      // Arrange
      qr.manager.findOneBy.mockResolvedValueOnce(null);

      // Act
      const act = service.create(buildDto());

      // Assert
      await expect(act).rejects.toThrow(NotFoundException);
      await expect(act).rejects.toThrow('Movie');
      expect(qr.rollbackTransaction).toHaveBeenCalled();
      expect(qr.release).toHaveBeenCalled();
    });

    it('debe hacer rollback y lanzar NotFoundException si la sala no existe', async () => {
      // Arrange
      qr.manager.findOneBy
        .mockResolvedValueOnce(buildMovie()) // pelicula existe
        .mockResolvedValueOnce(null);         // sala no existe

      // Act
      const act = service.create(buildDto());

      // Assert
      await expect(act).rejects.toThrow(NotFoundException);
      await expect(act).rejects.toThrow('Room');
      expect(qr.rollbackTransaction).toHaveBeenCalled();
    });

    it('debe hacer rollback y lanzar ConflictException si ya existe una función en esa sala y horario', async () => {
      // Arrange
      qr.manager.findOneBy
        .mockResolvedValueOnce(buildMovie())
        .mockResolvedValueOnce(buildRoom())
        .mockResolvedValueOnce(buildShowtime()); // conflicto de horario

      // Act
      const act = service.create(buildDto());

      // Assert
      await expect(act).rejects.toThrow(ConflictException);
      await expect(act).rejects.toThrow('already has a showtime');
      expect(qr.rollbackTransaction).toHaveBeenCalled();
    });

    it('debe hacer rollback y lanzar InternalServerErrorException ante error inesperado', async () => {
      // Arrange
      qr.manager.findOneBy.mockRejectedValue(new Error('db down'));

      // Act
      const act = service.create(buildDto());

      // Assert
      await expect(act).rejects.toThrow(InternalServerErrorException);
      expect(qr.rollbackTransaction).toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════════
  // findAll
  // ══════════════════════════════════════════════════════════════
  describe('findAll', () => {
    it('debe retornar todas las funciones ordenadas por startTime ASC sin filtros', async () => {
      // Arrange
      const showtimes = [buildShowtime(), buildShowtime({ id: 'id-2' })];
      showtimeRepo.find.mockResolvedValue(showtimes);

      // Act
      const result = await service.findAll({});

      // Assert
      expect(showtimeRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ order: { startTime: 'ASC' } }),
      );
      expect(result).toEqual(showtimes);
    });

    it('debe aplicar filtro por movieId y roomId', async () => {
      // Arrange
      showtimeRepo.find.mockResolvedValue([buildShowtime()]);

      // Act
      await service.findAll({ movieId: 'movie-uuid-001', roomId: 'room-uuid-001' });

      // Assert
      expect(showtimeRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            movie: { id: 'movie-uuid-001' },
            room: { id: 'room-uuid-001' },
          }),
        }),
      );
    });

    it('debe aplicar filtro por rango de fechas (fromDate y toDate)', async () => {
      // Arrange
      showtimeRepo.find.mockResolvedValue([]);

      // Act
      await service.findAll({ fromDate: '2026-11-01', toDate: '2026-11-30' });

      // Assert
      const call = showtimeRepo.find.mock.calls[0][0];
      expect(call.where.startTime).toEqual(
        Between(new Date('2026-11-01'), new Date('2026-11-30')),
      );
    });

    it('debe aplicar MoreThanOrEqual cuando solo se provee fromDate', async () => {
      // Arrange
      showtimeRepo.find.mockResolvedValue([]);

      // Act
      await service.findAll({ fromDate: '2026-11-01' });

      // Assert
      const call = showtimeRepo.find.mock.calls[0][0];
      expect(call.where.startTime).toEqual(MoreThanOrEqual(new Date('2026-11-01')));
    });

    it('debe lanzar InternalServerErrorException ante un error inesperado', async () => {
      // Arrange
      showtimeRepo.find.mockRejectedValue(new Error('db down'));

      // Act
      const act = service.findAll({});

      // Assert
      await expect(act).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // findById
  // ══════════════════════════════════════════════════════════════
  describe('findById', () => {
    it('debe retornar la función con sus relaciones si existe', async () => {
      // Arrange
      const showtime = buildShowtime();
      showtimeRepo.findOne.mockResolvedValue(showtime);

      // Act
      const result = await service.findById(showtime.id);

      // Assert
      expect(showtimeRepo.findOne).toHaveBeenCalledWith({
        where: { id: showtime.id },
        relations: { movie: true, room: { seats: true } },
      });
      expect(result).toEqual(showtime);
    });

    it('debe lanzar NotFoundException si la función no existe', async () => {
      // Arrange
      showtimeRepo.findOne.mockResolvedValue(null);

      // Act
      const act = service.findById('id-inexistente');

      // Assert
      await expect(act).rejects.toThrow(NotFoundException);
      await expect(act).rejects.toThrow('id-inexistente');
    });

    it('debe lanzar InternalServerErrorException ante un error inesperado', async () => {
      // Arrange
      showtimeRepo.findOne.mockRejectedValue(new Error('db down'));

      // Act
      const act = service.findById('cualquier-id');

      // Assert
      await expect(act).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // remove
  // ══════════════════════════════════════════════════════════════
  describe('remove', () => {
    it('debe eliminar la función si existe', async () => {
      // Arrange
      const showtime = buildShowtime();
      showtimeRepo.findOneBy.mockResolvedValue(showtime);
      showtimeRepo.remove.mockResolvedValue(showtime);

      // Act
      const result = await service.remove(showtime.id);

      // Assert
      expect(showtimeRepo.remove).toHaveBeenCalledWith(showtime);
      expect(result).toBeUndefined();
    });

    it('debe lanzar NotFoundException si la función no existe', async () => {
      // Arrange
      showtimeRepo.findOneBy.mockResolvedValue(null);

      // Act
      const act = service.remove('id-inexistente');

      // Assert
      await expect(act).rejects.toThrow(NotFoundException);
      expect(showtimeRepo.remove).not.toHaveBeenCalled();
    });

    it('debe traducir la violación de FK (23503) a ConflictException', async () => {
      // Arrange
      showtimeRepo.findOneBy.mockResolvedValue(buildShowtime());
      showtimeRepo.remove.mockRejectedValue(buildDbError('23503'));

      // Act
      const act = service.remove('cualquier-id');

      // Assert
      await expect(act).rejects.toThrow(ConflictException);
      await expect(act).rejects.toThrow('referenced by reservations');
    });

    it('debe lanzar InternalServerErrorException ante un error inesperado', async () => {
      // Arrange
      showtimeRepo.findOneBy.mockResolvedValue(buildShowtime());
      showtimeRepo.remove.mockRejectedValue(new Error('db down'));

      // Act
      const act = service.remove('cualquier-id');

      // Assert
      await expect(act).rejects.toThrow(InternalServerErrorException);
    });
  });
});
