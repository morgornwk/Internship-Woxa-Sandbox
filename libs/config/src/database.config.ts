import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const getDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const databaseUrl = configService.get<string>('DATABASE_URL');
  const synchronize =
    configService.get<string>('TYPEORM_SYNCHRONIZE') === 'true';

  return {
    type: 'postgres',
    url: databaseUrl,
    autoLoadEntities: true, // true or false
    // We rely on migrations; schema sync can fail if existing data violates newly-added constraints.
    // Set TYPEORM_SYNCHRONIZE=true only for local/dev ephemeral databases.
    synchronize,
    logging: false, // Set to true if you need SQL query log
  };
};
