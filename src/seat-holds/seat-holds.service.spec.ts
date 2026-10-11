import { Test, TestingModule } from '@nestjs/testing';
import { SeatHoldsService } from './seat-holds.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SeatHold, SeatHoldStatus } from './entities/seat-hold.entity';
import { DataSource } from 'typeorm';
import { ConflictException } from '@nestjs/common';

describe('SeatHoldsService', () => {
  let service: SeatHoldsService;
  let dataSourceMock: any;
  let qrMock: any;
  let repoMock: any;

  beforeEach(async () => {
    qrMock = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        findOneBy: jest.fn(),
        findOne: jest.fn(),
        find: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
      },
    };

    dataSourceMock = {
      createQueryRunner: jest.fn().mockReturnValue(qrMock),
    };

    repoMock = {
      find: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeatHoldsService,
        { provide: DataSource, useValue: dataSourceMock },
        { provide: getRepositoryToken(SeatHold), useValue: repoMock },
      ],
    }).compile();

    service = module.get<SeatHoldsService>(SeatHoldsService);
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('holdSeats', () => {
    it('debe crear un bloqueo si los asientos están disponibles', async () => {
      qrMock.manager.findOneBy.mockResolvedValue({ id: 'user-id' }); // user
      qrMock.manager.findOne.mockResolvedValue({ id: 'showtime-id', room: { id: 'room-id' } }); // showtime
      qrMock.manager.find.mockResolvedValueOnce([{ id: 'seat-1' }]); // asientos (lock mode)
      qrMock.manager.find.mockResolvedValueOnce([]); // existingHolds
      qrMock.manager.create.mockReturnValue({ id: 'hold-1' });
      qrMock.manager.save.mockResolvedValue([{ id: 'hold-1' }]);
      repoMock.find.mockResolvedValue([{ id: 'hold-1', seat: { id: 'seat-1' } }]);

      const result = await service.holdSeats({
        userId: 'user-id',
        showtimeId: 'showtime-id',
        seatIds: ['seat-1'],
      });

      expect(qrMock.commitTransaction).toHaveBeenCalled();
      expect(result.length).toBe(1);
    });

    it('debe lanzar ConflictException si el asiento ya está bloqueado y activo', async () => {
      qrMock.manager.findOneBy.mockResolvedValue({ id: 'user-id' }); // user
      qrMock.manager.findOne.mockResolvedValue({ id: 'showtime-id', room: { id: 'room-id' } }); // showtime
      qrMock.manager.find.mockResolvedValueOnce([{ id: 'seat-1' }]); // asientos
      
      const futureDate = new Date();
      futureDate.setMinutes(futureDate.getMinutes() + 10);
      qrMock.manager.find.mockResolvedValueOnce([
        { status: SeatHoldStatus.ACTIVE, expiresAt: futureDate }
      ]); // existingHolds activo

      await expect(
        service.holdSeats({ userId: 'user-id', showtimeId: 'showtime-id', seatIds: ['seat-1'] })
      ).rejects.toThrow(ConflictException);

      expect(qrMock.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('releaseExpiredHolds', () => {
    it('debe ejecutar update y hacer log si afecta registros', async () => {
      repoMock.update.mockResolvedValue({ affected: 2 });
      
      // Spy para atrapar el logger y evitar saturar consola
      jest.spyOn(service['logger'], 'log').mockImplementation();
      jest.spyOn(service['logger'], 'debug').mockImplementation();

      await service.releaseExpiredHolds();

      expect(repoMock.update).toHaveBeenCalled();
      expect(service['logger'].log).toHaveBeenCalledWith('Liberados 2 asientos expirados.');
    });
  });
});
