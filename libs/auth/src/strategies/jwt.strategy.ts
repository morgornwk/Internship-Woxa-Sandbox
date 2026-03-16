import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserRole } from '@common/enums';
import type { AuthUser } from '../types/auth-user.type';
import { validate as uuidValidate } from 'uuid';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  sid?: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly configService: ConfigService) {
    const secret = configService.get<string>('JWT_ACCESS_SECRET');
    if (!secret) {
      throw new Error('Authentication configuration is missing');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: JwtPayload): AuthUser {
    if (!payload.sub || !payload.email) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // ตรวจสอบว่า sub เป็น UUID หรือไม่ เพื่อป้องกันการโจมตีแบบ token forgery
    if (!uuidValidate(String(payload.sub))) {
      throw new UnauthorizedException('Invalid token subject');
    }

    const allowedRoles = new Set<UserRole>([
      UserRole.OWNER,
      UserRole.ADMIN,
      UserRole.STUDENT,
    ]);

    const payloadRole = payload.role as UserRole;
    const role = allowedRoles.has(payloadRole) ? payloadRole : UserRole.STUDENT;

    return {
      userId: String(payload.sub),
      email: payload.email,
      role,
    };
  }
}
