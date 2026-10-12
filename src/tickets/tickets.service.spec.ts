import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TicketsService } from './tickets.service';
import { Ticket, TicketStatus } from './entities/ticket.entity';
import { ReservationStatus } from '../reservations/entities/reservation.entity';

const ticketMock = (overrides: Partial<Ticket> = {}): Ticket =>
  ({
    id: 't-1',
    code: 'code-1',
    status: TicketStatus.VALID,
    usedAt: null,
    seat: { id: 's-1', row: 3, column: 7 },
    reservation: {
      id: 'r-1',
      status: ReservationStatus.CONFIRMED,
      showtime: {
        id: 'show-1',
        startTime: new Date('2026-10-12T20:00:00Z'),
        movie: { title: 'Inception' },
        room: { name: 'Sala Principal' },
      },
    },
    ...overrides,
  }) as unknown as Ticket;

describe('TicketsService', () => {
  let service: TicketsService;
  let ticketRepo: Record<string, jest.Mock>;
  const manager = { findOne: jest.fn(), findOneOrFail: jest.fn(), save: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        { provide: getRepositoryToken(Ticket), useValue: { find: jest.fn(), findOne: jest.fn() } },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn((work: (m: typeof manager) => unknown) => work(manager)),
            manager,
          },
        },
      ],
    }).compile();

    service = module.get(TicketsService);
    ticketRepo = module.get(getRepositoryToken(Ticket));
  });

  describe('findAllByReservation', () => {
    const owner = { id: 'u-1', email: 'jane@test.com', roles: ['customer'] };

    it('returns the tickets to the owner of the reservation', async () => {
      manager.findOne.mockResolvedValue({ id: 'r-1', user: { id: 'u-1' } });
      ticketRepo.find.mockResolvedValue([ticketMock()]);
      await expect(service.findAllByReservation('r-1', owner)).resolves.toHaveLength(1);
    });

    it('lets an admin read any reservation', async () => {
      manager.findOne.mockResolvedValue({ id: 'r-1', user: { id: 'someone-else' } });
      ticketRepo.find.mockResolvedValue([]);
      await expect(
        service.findAllByReservation('r-1', { id: 'a-1', email: 'admin@test.com', roles: ['admin'] }),
      ).resolves.toEqual([]);
    });

    it('forbids another customer', async () => {
      manager.findOne.mockResolvedValue({ id: 'r-1', user: { id: 'someone-else' } });
      await expect(service.findAllByReservation('r-1', owner)).rejects.toBeInstanceOf(ForbiddenException);
      expect(ticketRepo.find).not.toHaveBeenCalled();
    });

    it('throws NotFound for an unknown reservation', async () => {
      manager.findOne.mockResolvedValue(null);
      await expect(service.findAllByReservation('nope', owner)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getTicketDetails', () => {
    it('throws NotFound for an unknown code', async () => {
      ticketRepo.findOne.mockResolvedValue(null);
      await expect(service.getTicketDetails('nope')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('validateTicket', () => {
    const arrange = (ticket: Ticket | null) => {
      manager.findOne.mockResolvedValue(ticket ? { id: ticket.id } : null);
      manager.findOneOrFail.mockResolvedValue(ticket);
    };

    it('marks a valid ticket as used and grants access', async () => {
      const ticket = ticketMock();
      arrange(ticket);

      const result = await service.validateTicket('code-1');

      expect(manager.findOne).toHaveBeenCalledWith(Ticket, {
        where: { code: 'code-1' },
        lock: { mode: 'pessimistic_write' },
      });
      expect(manager.save).toHaveBeenCalledWith(Ticket, expect.objectContaining({ status: TicketStatus.USED }));
      expect(result).toMatchObject({
        access: 'GRANTED',
        seat: { row: 3, column: 7 },
        showtime: { id: 'show-1', movie: 'Inception', room: 'Sala Principal' },
      });
      expect(result.usedAt).toBeInstanceOf(Date);
    });

    it('throws NotFound for an unknown code', async () => {
      arrange(null);
      await expect(service.validateTicket('nope')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a reused ticket and reports the first entry time', async () => {
      arrange(ticketMock({ status: TicketStatus.USED, usedAt: new Date('2026-10-12T19:45:00Z') }));

      await expect(service.validateTicket('code-1')).rejects.toThrow(
        new ConflictException('Ticket already used at 2026-10-12T19:45:00.000Z'),
      );
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('rejects a cancelled ticket', async () => {
      arrange(ticketMock({ status: TicketStatus.CANCELLED }));
      await expect(service.validateTicket('code-1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a ticket whose reservation is not confirmed', async () => {
      const ticket = ticketMock();
      ticket.reservation.status = ReservationStatus.CANCELLED;
      arrange(ticket);
      await expect(service.validateTicket('code-1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a ticket for another showtime', async () => {
      arrange(ticketMock());
      await expect(service.validateTicket('code-1', 'show-2')).rejects.toThrow(
        'Ticket belongs to a different showtime',
      );
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('accepts the ticket when the expected showtime matches', async () => {
      arrange(ticketMock());
      await expect(service.validateTicket('code-1', 'show-1')).resolves.toMatchObject({ access: 'GRANTED' });
    });
  });
});
