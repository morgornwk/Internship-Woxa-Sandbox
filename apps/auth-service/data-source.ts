import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'apps/auth-service/.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: false });

export const AuthDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  // กำหนด timezone เป็น Asia/Bangkok เพื่อให้ฟังก์ชันของ DB เช่น now() ใช้เวลาไทย
  extra: { options: '-c timezone=Asia/Bangkok' },
  entities: [
    path.resolve(process.cwd(), 'apps/auth-service/src/**/*.entity{.ts,.js}'),
  ],
  migrations: [
    path.resolve(process.cwd(), 'apps/auth-service/migrations/*{.ts,.js}'),
  ],
  synchronize: false,
  logging: false,
});
