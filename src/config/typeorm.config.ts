import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

/**
 * DATABASE_URL wins when present (managed Postgres on Render, Railway, Neon...).
 * Otherwise the discrete DB_* variables are used, which is what docker-compose sets.
 */
export const buildTypeOrmOptions = (config: ConfigService): TypeOrmModuleOptions => {
  const url = config.get<string>('DATABASE_URL');
  const ssl = config.get<string>('DB_SSL') === 'true' ? { rejectUnauthorized: false } : false;
  const synchronize = config.get<string>('DB_SYNCHRONIZE', 'true') === 'true';

  const connection = url
    ? { url }
    : {
        host: config.get<string>('DB_HOST', 'localhost'),
        port: Number(config.get<string>('DB_PORT', '5432')),
        username: config.get<string>('DB_USERNAME', 'postgres'),
        password: config.get<string>('DB_PASSWORD', 'postgres'),
        database: config.get<string>('DB_DATABASE', 'cinema_db'),
      };

  return {
    type: 'postgres',
    ...connection,
    ssl,
    autoLoadEntities: true,
    synchronize,
  };
};
