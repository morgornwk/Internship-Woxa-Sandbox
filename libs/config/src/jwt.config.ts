import { ConfigService } from '@nestjs/config';
import { JwtModuleOptions } from '@nestjs/jwt';
import type { StringValue } from 'ms';

function isMsString(value: string): value is StringValue {
  // Accept common ms formats used by jsonwebtoken / @nestjs/jwt
  // Examples: "15m", "7d", "30s", "1h", "1000ms"
  return /^\d+(ms|s|m|h|d|w|y)$/.test(value.trim());
}

function getExpiresIn(
  configService: ConfigService,
  key: string,
  fallback: StringValue,
): number | StringValue {
  const raw = configService.get<string>(key);
  if (!raw) return fallback;

  const trimmed = raw.trim();
  if (trimmed === '') return fallback;

  // Allow numeric seconds (e.g. "900")
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }

  if (isMsString(trimmed)) {
    return trimmed;
  }

  return fallback;
}

export const getJwtConfig = (configService: ConfigService): JwtModuleOptions => {
  const secret = configService.get<string>('JWT_ACCESS_SECRET');
  if (!secret) {
    throw new Error('Authentication configuration is missing');
  }

  return {
    secret,
    signOptions: {
      expiresIn: getExpiresIn(configService, 'JWT_ACCESS_EXPIRES_IN', '15m'),
    },
  };
};

export const JWT_ACCESS_EXPIRES_IN = '15m';
export const JWT_REFRESH_EXPIRES_IN = '7d';
