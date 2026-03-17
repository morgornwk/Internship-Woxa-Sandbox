import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({
  path: path.resolve(process.cwd(), 'apps/course-service/.env'),
});
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: false });

export const CourseDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  // กำหนด timezone เป็น Asia/Bangkok เพื่อให้ฟังก์ชันของ DB เช่น now() ใช้เวลาไทย
  extra: { options: '-c timezone=Asia/Bangkok' },
  entities: ['apps/course-service/src/**/*.entity{.ts,.js}'],
  migrations: [
    'apps/course-service/src/migrations/*{.ts,.js}',
    'apps/course-service/migrations/*{.ts,.js}',
  ],
  synchronize: false,
  logging: false,
});
