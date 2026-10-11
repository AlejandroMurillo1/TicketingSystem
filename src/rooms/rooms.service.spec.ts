import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ConflictException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RoomsService } from './rooms.service';
import { Room } from './entities/room.entity';
import { Seat, SeatType } from './entities/seat.entity';
import { CreateRoomDto } from './dtos/create-room.dto';

// ─── Mock factories ───────────────────────────────────────────
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

// ─── Test data factories ───────────────────────────────────────
const buildRoom = (overrides: Partial<Room> = {}): Room =>
  ({
    id: 'room-uuid-001',
    name: 'Sala A',
    rows: 5,
    columns: 4,
    capacity: 20,
    seats: [],
    ...overrides,
  } as Room);

const buildCreateDto = (overrides: Partial<CreateRoomDto> = {}): CreateRoomDto => ({
  name: 'Sala A',
  rows: 5,
  columns: 4,
  ...overrides,
});

const buildDbError = (code: string, detail = 'db detail') =>
  Object.assign(new Error('db error'), { code, detail });

// ─── Suite ────────────────────────────────────────────────────
describe('RoomsService', () => {
  let service: RoomsService;
  let roomRepository: ReturnType<typeof createRepositoryMock>;
  let seatRepository: ReturnType<typeof createRepositoryMock>;
  let queryRunner: ReturnType<typeof createQueryRunnerMock>;
  let dataSource: { createQueryRunner: jest.Mock };

  beforeEach(async () => {
    roomRepository = createRepositoryMock();
    seatRepository = createRepositoryMock();
    queryRunner = createQueryRunnerMock();
    dataSource = { createQueryRunner: jest.fn().mockReturnValue(queryRunner) };

    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomsService,
        { provide: getRepositoryToken(Room), useValue: roomRepository },
        { provide: getRepositoryToken(Seat), useValue: seatRepository },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<RoomsService>(RoomsService);
  });

  afterEach(() => jest.restoreAllMocks());

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  // ══════════════════════════════════════════════════════════════
  // generateSeats (helper interno)
  // ══════════════════════════════════════════════════════════════
  describe('generateSeats', () => {
    it('debe generar rows × columns asientos todos de tipo NORMAL cuando no hay especiales', () => {
      // Arrange
      const room = buildRoom();

      // Act
      const seats = service.generateSeats(room, 3, 2, undefined);

      // Assert
      expect(seats).toHaveLength(6); // 3 filas × 2 columnas
      seats.forEach(s => expect(s.type).toBe(SeatType.NORMAL));
    });

    it('debe marcar como VIP los asientos indicados en specialSeats', () => {
      // Arrange
      const room = buildRoom();
      const specials = [{ row: 1, column: 1, type: SeatType.VIP }];

      // Act
      const seats = service.generateSeats(room, 2, 2, specials);

      // Assert
      const vipSeat = seats.find(s => s.row === 1 && s.column === 1);
      const normalSeat = seats.find(s => s.row === 1 && s.column === 2);
      expect(vipSeat!.type).toBe(SeatType.VIP);
      expect(normalSeat!.type).toBe(SeatType.NORMAL);
    });

    it('debe asignar la room correctamente a cada asiento generado', () => {
      // Arrange
      const room = buildRoom({ id: 'test-room-id' });

      // Act
      const seats = service.generateSeats(room, 2, 2, undefined);

      // Assert
      seats.forEach(s => expect(s.room).toBe(room));
    });

    it('debe generar los asientos con coordenadas 1-indexed', () => {
      // Arrange
      const room = buildRoom();

      // Act
      const seats = service.generateSeats(room, 2, 3, undefined);

      // Assert
      const rows = [...new Set(seats.map(s => s.row))].sort((a, b) => a - b);
      const cols = [...new Set(seats.map(s => s.column))].sort((a, b) => a - b);
      expect(rows).toEqual([1, 2]);
      expect(cols).toEqual([1, 2, 3]);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // create
  // ══════════════════════════════════════════════════════════════
  describe('create', () => {
    it('debe crear la sala, generar los asientos y hacer commit', async () => {
      // Arrange
      const dto = buildCreateDto();
      const savedRoom = buildRoom();
      queryRunner.manager.findOneBy.mockResolvedValue(null); // no existe duplicado
      queryRunner.manager.create.mockReturnValue(savedRoom);
      queryRunner.manager.save
        .mockResolvedValueOnce(savedRoom)  // save Room
        .mockResolvedValueOnce([]);         // save Seats
      roomRepository.findOne.mockResolvedValue({ ...savedRoom, seats: [] });

      // Act
      const result = await service.create(dto);

      // Assert
      expect(queryRunner.manager.findOneBy).toHaveBeenCalledWith(Room, { name: 'Sala A' });
      expect(queryRunner.manager.save).toHaveBeenCalledTimes(2);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('debe calcular capacity = rows × columns', async () => {
      // Arrange
      const dto = buildCreateDto({ rows: 4, columns: 6 });
      queryRunner.manager.findOneBy.mockResolvedValue(null);
      queryRunner.manager.create.mockImplementation((_entity, data) => ({ ...data }));
      queryRunner.manager.save.mockResolvedValue({ ...buildRoom(), rows: 4, columns: 6, capacity: 24 });
      roomRepository.findOne.mockResolvedValue(buildRoom({ rows: 4, columns: 6, capacity: 24 }));

      // Act
      const result = await service.create(dto);

      // Assert
      const createCall = queryRunner.manager.create.mock.calls[0];
      expect(createCall[1]).toMatchObject({ capacity: 24 });
    });

    it('debe hacer rollback y lanzar ConflictException si la sala ya existe', async () => {
      // Arrange
      queryRunner.manager.findOneBy.mockResolvedValue(buildRoom());

      // Act
      const act = service.create(buildCreateDto());

      // Assert
      await expect(act).rejects.toThrow(ConflictException);
      await expect(act).rejects.toThrow('already exists');
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('debe normalizar el nombre (trim) antes de buscar duplicados', async () => {
      // Arrange
      const dto = buildCreateDto({ name: '  Sala A  ' });
      queryRunner.manager.findOneBy.mockResolvedValue(null);
      queryRunner.manager.create.mockReturnValue(buildRoom());
      queryRunner.manager.save.mockResolvedValue(buildRoom());
      roomRepository.findOne.mockResolvedValue(buildRoom());

      // Act
      await service.create(dto);

      // Assert
      expect(queryRunner.manager.findOneBy).toHaveBeenCalledWith(Room, { name: 'Sala A' });
    });

    it('debe hacer rollback y lanzar InternalServerErrorException ante error inesperado', async () => {
      // Arrange
      queryRunner.manager.findOneBy.mockRejectedValue(new Error('db down'));

      // Act
      const act = service.create(buildCreateDto());

      // Assert
      await expect(act).rejects.toThrow(InternalServerErrorException);
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════════
  // findAll
  // ══════════════════════════════════════════════════════════════
  describe('findAll', () => {
    it('debe retornar todas las salas con sus asientos', async () => {
      // Arrange
      const rooms = [buildRoom(), buildRoom({ id: 'room-uuid-002', name: 'Sala B' })];
      roomRepository.find.mockResolvedValue(rooms);

      // Act
      const result = await service.findAll();

      // Assert
      expect(roomRepository.find).toHaveBeenCalledWith({ relations: { seats: true } });
      expect(result).toEqual(rooms);
    });

    it('debe retornar un arreglo vacío cuando no hay salas', async () => {
      // Arrange
      roomRepository.find.mockResolvedValue([]);

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toEqual([]);
    });

    it('debe lanzar InternalServerErrorException ante un error inesperado', async () => {
      // Arrange
      roomRepository.find.mockRejectedValue(new Error('db down'));

      // Act
      const act = service.findAll();

      // Assert
      await expect(act).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // findById
  // ══════════════════════════════════════════════════════════════
  describe('findById', () => {
    it('debe retornar la sala con sus asientos si existe', async () => {
      // Arrange
      const room = buildRoom();
      roomRepository.findOne.mockResolvedValue(room);

      // Act
      const result = await service.findById(room.id);

      // Assert
      expect(roomRepository.findOne).toHaveBeenCalledWith({
        where: { id: room.id },
        relations: { seats: true },
      });
      expect(result).toEqual(room);
    });

    it('debe lanzar NotFoundException si la sala no existe', async () => {
      // Arrange
      roomRepository.findOne.mockResolvedValue(null);

      // Act
      const act = service.findById('id-inexistente');

      // Assert
      await expect(act).rejects.toThrow(NotFoundException);
      await expect(act).rejects.toThrow('id-inexistente');
    });

    it('debe lanzar InternalServerErrorException ante un error inesperado', async () => {
      // Arrange
      roomRepository.findOne.mockRejectedValue(new Error('db down'));

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
    it('debe eliminar la sala si existe', async () => {
      // Arrange
      const room = buildRoom();
      roomRepository.findOneBy.mockResolvedValue(room);
      roomRepository.remove.mockResolvedValue(room);

      // Act
      const result = await service.remove(room.id);

      // Assert
      expect(roomRepository.findOneBy).toHaveBeenCalledWith({ id: room.id });
      expect(roomRepository.remove).toHaveBeenCalledWith(room);
      expect(result).toBeUndefined();
    });

    it('debe lanzar NotFoundException si la sala no existe', async () => {
      // Arrange
      roomRepository.findOneBy.mockResolvedValue(null);

      // Act
      const act = service.remove('id-inexistente');

      // Assert
      await expect(act).rejects.toThrow(NotFoundException);
      expect(roomRepository.remove).not.toHaveBeenCalled();
    });

    it('debe traducir la violación de FK (23503) a ConflictException', async () => {
      // Arrange
      roomRepository.findOneBy.mockResolvedValue(buildRoom());
      roomRepository.remove.mockRejectedValue(buildDbError('23503'));

      // Act
      const act = service.remove('cualquier-id');

      // Assert
      await expect(act).rejects.toThrow(ConflictException);
      await expect(act).rejects.toThrow('referenced by other records');
    });

    it('debe lanzar InternalServerErrorException ante un error inesperado', async () => {
      // Arrange
      roomRepository.findOneBy.mockResolvedValue(buildRoom());
      roomRepository.remove.mockRejectedValue(new Error('db down'));

      // Act
      const act = service.remove('cualquier-id');

      // Assert
      await expect(act).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // update
  // ══════════════════════════════════════════════════════════════
  describe('update', () => {
    it('debe actualizar nombre y hacer commit sin regenerar asientos', async () => {
      // Arrange
      const room = buildRoom();
      queryRunner.manager.findOneBy
        .mockResolvedValueOnce(room)    // buscar por id
        .mockResolvedValueOnce(null);   // chequeo de nombre duplicado
      queryRunner.manager.save.mockResolvedValue(room);
      roomRepository.findOne.mockResolvedValue(room);

      // Act
      const result = await service.update(room.id, { name: 'Sala B' });

      // Assert
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queryRunner.manager.delete).not.toHaveBeenCalled();
      expect(result).toEqual(room);
    });

    it('debe regenerar asientos si cambia el layout (rows o columns)', async () => {
      // Arrange
      const room = buildRoom({ rows: 5, columns: 4 });
      queryRunner.manager.findOneBy.mockResolvedValueOnce(room);
      queryRunner.manager.merge.mockImplementation(() => undefined);
      queryRunner.manager.save.mockResolvedValue({ ...room, rows: 6, columns: 4, capacity: 24 });
      queryRunner.manager.delete.mockResolvedValue(undefined);
      queryRunner.manager.save.mockResolvedValue(room);
      roomRepository.findOne.mockResolvedValue(room);

      // Act
      await service.update(room.id, { rows: 6 });

      // Assert
      expect(queryRunner.manager.delete).toHaveBeenCalledWith(Seat, { room: { id: room.id } });
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('debe hacer rollback y lanzar NotFoundException si la sala no existe', async () => {
      // Arrange
      queryRunner.manager.findOneBy.mockResolvedValue(null);

      // Act
      const act = service.update('id-inexistente', { name: 'X' });

      // Assert
      await expect(act).rejects.toThrow(NotFoundException);
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('debe hacer rollback y lanzar ConflictException si el nuevo nombre ya existe', async () => {
      // Arrange
      const room = buildRoom({ name: 'Sala A' });
      const duplicate = buildRoom({ id: 'other-id', name: 'Sala B' });
      queryRunner.manager.findOneBy
        .mockResolvedValueOnce(room)
        .mockResolvedValueOnce(duplicate);

      // Act
      const act = service.update(room.id, { name: 'Sala B' });

      // Assert
      await expect(act).rejects.toThrow(ConflictException);
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('debe hacer rollback y lanzar InternalServerErrorException ante un error inesperado', async () => {
      // Arrange
      queryRunner.manager.findOneBy.mockRejectedValue(new Error('db down'));

      // Act
      const act = service.update('cualquier-id', { name: 'X' });

      // Assert
      await expect(act).rejects.toThrow(InternalServerErrorException);
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });
  });
});
