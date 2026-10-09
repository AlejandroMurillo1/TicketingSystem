"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const seat_holds_service_1 = require("./seat-holds.service");
const typeorm_1 = require("@nestjs/typeorm");
const seat_hold_entity_1 = require("./entities/seat-hold.entity");
const typeorm_2 = require("typeorm");
const common_1 = require("@nestjs/common");
describe('SeatHoldsService', () => {
    let service;
    let dataSourceMock;
    let qrMock;
    let repoMock;
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
        const module = await testing_1.Test.createTestingModule({
            providers: [
                seat_holds_service_1.SeatHoldsService,
                { provide: typeorm_2.DataSource, useValue: dataSourceMock },
                { provide: (0, typeorm_1.getRepositoryToken)(seat_hold_entity_1.SeatHold), useValue: repoMock },
            ],
        }).compile();
        service = module.get(seat_holds_service_1.SeatHoldsService);
    });
    it('debe estar definido', () => {
        expect(service).toBeDefined();
    });
    describe('holdSeats', () => {
        it('debe crear un bloqueo si los asientos están disponibles', async () => {
            qrMock.manager.findOneBy.mockResolvedValue({ id: 'user-id' });
            qrMock.manager.findOne.mockResolvedValue({ id: 'showtime-id', room: { id: 'room-id' } });
            qrMock.manager.find.mockResolvedValueOnce([{ id: 'seat-1' }]);
            qrMock.manager.find.mockResolvedValueOnce([]);
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
            qrMock.manager.findOneBy.mockResolvedValue({ id: 'user-id' });
            qrMock.manager.findOne.mockResolvedValue({ id: 'showtime-id', room: { id: 'room-id' } });
            qrMock.manager.find.mockResolvedValueOnce([{ id: 'seat-1' }]);
            const futureDate = new Date();
            futureDate.setMinutes(futureDate.getMinutes() + 10);
            qrMock.manager.find.mockResolvedValueOnce([
                { status: seat_hold_entity_1.SeatHoldStatus.ACTIVE, expiresAt: futureDate }
            ]);
            await expect(service.holdSeats({ userId: 'user-id', showtimeId: 'showtime-id', seatIds: ['seat-1'] })).rejects.toThrow(common_1.ConflictException);
            expect(qrMock.rollbackTransaction).toHaveBeenCalled();
        });
    });
    describe('releaseExpiredHolds', () => {
        it('debe ejecutar update y hacer log si afecta registros', async () => {
            repoMock.update.mockResolvedValue({ affected: 2 });
            jest.spyOn(service['logger'], 'log').mockImplementation();
            jest.spyOn(service['logger'], 'debug').mockImplementation();
            await service.releaseExpiredHolds();
            expect(repoMock.update).toHaveBeenCalled();
            expect(service['logger'].log).toHaveBeenCalledWith('Liberados 2 asientos expirados.');
        });
    });
});
//# sourceMappingURL=seat-holds.service.spec.js.map