import { ConfigService } from '@nestjs/config';
import { JwtModuleOptions } from '@nestjs/jwt';

type JwtExpiresInUnit = 'ms' | 's' | 'm' | 'h' | 'd' | 'w' | 'y';
type JwtExpiresInString = `${number}${JwtExpiresInUnit}`;

function isMsString(value: string): value is JwtExpiresInString {
  return /^\d+(ms|s|m|h|d|w|y)$/.test(value.trim());
}

function getExpiresIn(
  configService: ConfigService,
  key: string,
  fallback: JwtExpiresInString,
): number | JwtExpiresInString {
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

export const getJwtConfig = (
  configService: ConfigService,
): JwtModuleOptions => {
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
