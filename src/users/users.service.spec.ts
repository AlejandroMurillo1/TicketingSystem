import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  Logger,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { Role } from '../roles/entities/role.entity';

const role = (id: number, name: string): Role => ({ id, name });

const userMock = (overrides: Partial<User> = {}): User =>
  ({
    id: 'u-1',
    email: 'jane@test.com',
    fullName: 'Jane',
    password: 'hash',
    isActive: true,
    isTwoFactorEnabled: false,
    twoFactorSecret: null,
    roles: [role(3, 'customer')],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as User;

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: Record<string, jest.Mock>;
  let roleRepository: Record<string, jest.Mock>;
  let queryBuilder: Record<string, jest.Mock>;

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    queryBuilder = {
      addSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
      getManyAndCount: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOneBy: jest.fn(),
            create: jest.fn((data) => ({ ...data })),
            save: jest.fn(async (data) => ({ id: 'u-new', ...data })),
            update: jest.fn(),
            createQueryBuilder: jest.fn(() => queryBuilder),
          },
        },
        {
          provide: getRepositoryToken(Role),
          useValue: { findBy: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(UsersService);
    userRepository = module.get(getRepositoryToken(User));
    roleRepository = module.get(getRepositoryToken(Role));
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByEmail', () => {
    it('lowercases the email before querying', async () => {
      userRepository.findOneBy.mockResolvedValue(userMock());
      await service.findByEmail('JANE@Test.com');
      expect(userRepository.findOneBy).toHaveBeenCalledWith({ email: 'jane@test.com' });
    });

    it('wraps unexpected database errors', async () => {
      userRepository.findOneBy.mockRejectedValue(new Error('db down'));
      await expect(service.findByEmail('a@b.com')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('findByEmailWithSecrets', () => {
    it('selects the password and the 2FA secret', async () => {
      queryBuilder.getOne.mockResolvedValue(userMock());
      await service.findByEmailWithSecrets('jane@test.com');
      expect(queryBuilder.addSelect).toHaveBeenCalledWith(['user.password', 'user.twoFactorSecret']);
    });
  });

  describe('findByIdWithSecrets', () => {
    it('throws NotFound when the user does not exist', async () => {
      queryBuilder.getOne.mockResolvedValue(null);
      await expect(service.findByIdWithSecrets('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('register', () => {
    it('always creates a customer and hashes the password', async () => {
      userRepository.findOneBy.mockResolvedValue(null);
      roleRepository.findBy.mockResolvedValue([role(3, 'customer')]);

      const created = await service.register({
        email: 'new@test.com',
        password: 'Secret123',
        fullName: 'New',
      });

      const saved = userRepository.save.mock.calls[0][0];
      expect(saved.roles).toEqual([role(3, 'customer')]);
      expect(await bcrypt.compare('Secret123', saved.password)).toBe(true);
      expect(created.password).toBeUndefined();
    });
  });

  describe('create', () => {
    it('rejects a duplicated email', async () => {
      userRepository.findOneBy.mockResolvedValue(userMock());
      await expect(
        service.create({ email: 'jane@test.com', password: 'Secret123', fullName: 'Jane' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(userRepository.save).not.toHaveBeenCalled();
    });

    it('assigns the requested roles', async () => {
      userRepository.findOneBy.mockResolvedValue(null);
      roleRepository.findBy.mockResolvedValue([role(2, 'counter')]);

      await service.create({
        email: 'staff@test.com',
        password: 'Secret123',
        fullName: 'Staff',
        roles: ['Counter'],
      });

      expect(userRepository.save.mock.calls[0][0].roles).toEqual([role(2, 'counter')]);
    });

    it('fails with BadRequest when a role does not exist', async () => {
      userRepository.findOneBy.mockResolvedValue(null);
      roleRepository.findBy.mockResolvedValue([role(2, 'counter')]);

      await expect(
        service.create({
          email: 'staff@test.com',
          password: 'Secret123',
          fullName: 'Staff',
          roles: ['counter', 'ghost'],
        }),
      ).rejects.toThrow('Role(s) not found: ghost');
    });

    it('maps a unique violation from Postgres to Conflict', async () => {
      userRepository.findOneBy.mockResolvedValue(null);
      roleRepository.findBy.mockResolvedValue([role(3, 'customer')]);
      userRepository.save.mockRejectedValue({ code: '23505', detail: 'duplicate' });

      await expect(
        service.create({ email: 'race@test.com', password: 'Secret123', fullName: 'Race' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('findAll', () => {
    it('applies defaults and returns the page with the total', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[userMock()], 1]);

      const result = await service.findAll({});

      expect(queryBuilder.take).toHaveBeenCalledWith(10);
      expect(queryBuilder.skip).toHaveBeenCalledWith(0);
      expect(queryBuilder.innerJoin).not.toHaveBeenCalled();
      expect(result).toEqual({ data: [userMock({ createdAt: expect.any(Date), updatedAt: expect.any(Date) })], total: 1, limit: 10, offset: 0 });
    });

    it('filters by role through a separate join', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
      await service.findAll({ role: 'counter', limit: 5, offset: 5 });
      expect(queryBuilder.innerJoin).toHaveBeenCalledWith(
        'user.roles',
        'filterRole',
        'filterRole.name = :roleName',
        { roleName: 'counter' },
      );
    });
  });

  describe('getProfile', () => {
    it('returns the user', async () => {
      userRepository.findOneBy.mockResolvedValue(userMock());
      await expect(service.getProfile('u-1')).resolves.toMatchObject({ id: 'u-1' });
    });

    it('keeps the NotFound status instead of turning it into a 500', async () => {
      userRepository.findOneBy.mockResolvedValue(null);
      await expect(service.getProfile('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('updates the name without touching the password', async () => {
      queryBuilder.getOne.mockResolvedValue(userMock());
      const updated = await service.updateProfile('u-1', { fullName: 'Jane Smith' });
      expect(updated.fullName).toBe('Jane Smith');
      expect(updated.password).toBeUndefined();
    });

    it('rejects an email used by someone else', async () => {
      queryBuilder.getOne.mockResolvedValue(userMock());
      userRepository.findOneBy.mockResolvedValue(userMock({ id: 'u-2', email: 'taken@test.com' }));
      await expect(service.updateProfile('u-1', { email: 'taken@test.com' })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('changes the password when the current one matches', async () => {
      const hash = await bcrypt.hash('Old12345', 4);
      queryBuilder.getOne.mockResolvedValue(userMock({ password: hash }));

      await service.updateProfile('u-1', { currentPassword: 'Old12345', newPassword: 'New12345' });

      const saved = userRepository.save.mock.calls[0][0];
      expect(await bcrypt.compare('New12345', saved.password)).toBe(true);
    });

    it('refuses the password change when the current one is wrong', async () => {
      const hash = await bcrypt.hash('Old12345', 4);
      queryBuilder.getOne.mockResolvedValue(userMock({ password: hash }));

      await expect(
        service.updateProfile('u-1', { currentPassword: 'Wrong123', newPassword: 'New12345' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(userRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('assignRoles', () => {
    it('replaces the roles of the user', async () => {
      userRepository.findOneBy.mockResolvedValue(userMock());
      roleRepository.findBy.mockResolvedValue([role(1, 'admin'), role(2, 'counter')]);

      const updated = await service.assignRoles('u-1', ['admin', 'counter', 'admin']);

      expect(roleRepository.findBy).toHaveBeenCalledTimes(1);
      expect(updated.roles.map((r) => r.name)).toEqual(['admin', 'counter']);
    });

    it('throws NotFound for an unknown user', async () => {
      userRepository.findOneBy.mockResolvedValue(null);
      await expect(service.assignRoles('missing', ['admin'])).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequest for an unknown role', async () => {
      userRepository.findOneBy.mockResolvedValue(userMock());
      roleRepository.findBy.mockResolvedValue([]);
      await expect(service.assignRoles('u-1', ['ghost'])).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('setActive', () => {
    it('deactivates the user', async () => {
      userRepository.findOneBy.mockResolvedValue(userMock());
      const updated = await service.setActive('u-1', false);
      expect(updated.isActive).toBe(false);
    });

    it('throws NotFound for an unknown user', async () => {
      userRepository.findOneBy.mockResolvedValue(null);
      await expect(service.setActive('missing', false)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('two-factor persistence', () => {
    it('stores the secret', async () => {
      await service.setTwoFactorSecret('u-1', 'SECRET');
      expect(userRepository.update).toHaveBeenCalledWith({ id: 'u-1' }, { twoFactorSecret: 'SECRET' });
    });

    it('clears the secret when 2FA is disabled', async () => {
      await service.setTwoFactorEnabled('u-1', false);
      expect(userRepository.update).toHaveBeenCalledWith(
        { id: 'u-1' },
        { isTwoFactorEnabled: false, twoFactorSecret: null },
      );
    });

    it('keeps the secret when 2FA is enabled', async () => {
      await service.setTwoFactorEnabled('u-1', true);
      expect(userRepository.update).toHaveBeenCalledWith({ id: 'u-1' }, { isTwoFactorEnabled: true });
    });
  });

  describe('comparePassword', () => {
    it('returns false when there is no hash', async () => {
      await expect(service.comparePassword('x')).resolves.toBe(false);
    });
  });
});
