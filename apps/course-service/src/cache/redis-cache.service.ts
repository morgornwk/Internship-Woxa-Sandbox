import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private client: Redis | null = null;
  private initializingClient: Promise<Redis | null> | null = null;
  private readonly pendingWraps = new Map<string, Promise<unknown>>();
  private hasLoggedUnavailable = false;
  private hasLoggedMissingConfig = false;

  private static readonly DELETE_BY_PREFIX_BATCH_SIZE = 200;
  private static readonly RECONNECT_COOLDOWN_MS = 30_000;
  private lastFailedConnectAt = 0;

  constructor(private readonly configService: ConfigService) {}

  async onModuleDestroy(): Promise<void> {
    if (!this.client) {
      return;
    }

    const client = this.client;
    this.client = null;

    await client.quit().catch((error) => {
      this.logger.error(`Redis client quit error: ${error.message}`);
      client.disconnect();
    });
  }

  async get<T>(key: string): Promise<T | null> {
    const client = await this.getClient();
    if (!client) {
      return null;
    }

    try {
      const value = await client.get(key);
      if (value == null) {
        this.logDebug(`MISS ${key}`);
        return null;
      }

      this.logDebug(`HIT ${key}`);
      return JSON.parse(value) as T;
    } catch (error) {
      this.logUnavailableOnce(error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const client = await this.getClient();
    if (!client) {
      return;
    }

    const ttl = Math.max(1, ttlSeconds);

    try {
      await client.set(key, JSON.stringify(value), 'EX', ttl);
      this.logDebug(`STORE ${key} ttl=${ttl}s`);
    } catch (error) {
      this.logUnavailableOnce(error);
    }
  }

  async del(keys: string | string[]): Promise<void> {
    const client = await this.getClient();
    if (!client) {
      return;
    }

    const keyList = Array.isArray(keys) ? keys : [keys];
    if (!keyList.length) {
      return;
    }

    try {
      await client.del(...keyList);
    } catch (error) {
      this.logUnavailableOnce(error);
    }
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    const client = await this.getClient();
    if (!client) {
      return;
    }

    try {
      let cursor = '0';
      const pattern = `${prefix}*`;

      do {
        const [nextCursor, keys] = await client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          RedisCacheService.DELETE_BY_PREFIX_BATCH_SIZE,
        );
        cursor = nextCursor;

        if (keys.length > 0) {
          await client.unlink(...keys);
        }
      } while (cursor !== '0');
    } catch (error) {
      this.logUnavailableOnce(error);
    }
  }

  async wrap<T>(
    key: string,
    ttlSeconds: number,
    factory: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const pending = this.pendingWraps.get(key) as Promise<T> | undefined;
    if (pending) {
      return pending;
    }

    const pendingValue = (async () => {
      const value = await factory();
      await this.set(key, value, ttlSeconds);
      return value;
    })();

    this.pendingWraps.set(key, pendingValue);

    try {
      return await pendingValue;
    } finally {
      this.pendingWraps.delete(key);
    }
  }

  private async getClient(): Promise<Redis | null> {
    if (this.client) {
      if (this.client.status === 'ready') {
        return this.client;
      }

      if (this.isReconnectInProgress(this.client)) {
        return null;
      }

      this.client.disconnect();
      this.client = null;
    }

    if (this.lastFailedConnectAt > 0) {
      const elapsed = Date.now() - this.lastFailedConnectAt;
      if (elapsed < RedisCacheService.RECONNECT_COOLDOWN_MS) {
        return null;
      }
    }

    if (this.initializingClient) {
      return this.initializingClient;
    }

    this.initializingClient = this.initializeClient();

    try {
      return await this.initializingClient;
    } finally {
      this.initializingClient = null;
    }
  }

  private async initializeClient(): Promise<Redis | null> {
    const redisEnabled = this.configService
      .get<string>('REDIS_ENABLED')
      ?.trim()
      .toLowerCase();
    if (redisEnabled === 'false') {
      return null;
    }

    const redisUrl = this.configService.get<string>('REDIS_URL')?.trim();

    if (!redisUrl) {
      this.logMissingConfigOnce();
      return null;
    }

    const client = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 1000,
      retryStrategy: () => null,
    });

    client.on('error', (error) => {
      this.markClientUnavailable(client);
      this.logUnavailableOnce(error);
    });

    client.on('close', () => {
      this.markClientUnavailable(client);
    });

    client.on('end', () => {
      this.markClientUnavailable(client);
    });

    try {
      await client.connect();
      this.client = client;
      this.lastFailedConnectAt = 0;
      this.hasLoggedUnavailable = false;
      this.hasLoggedMissingConfig = false;
      this.logger.log('Redis cache connected');
      return client;
    } catch (error) {
      this.markClientUnavailable(client);
      client.disconnect();
      this.logUnavailableOnce(error);
      return null;
    }
  }

  private isReconnectInProgress(client: Redis): boolean {
    return ['connect', 'connecting', 'reconnecting'].includes(client.status);
  }

  private markClientUnavailable(client: Redis): void {
    if (this.client === client) {
      this.client = null;
    }

    this.lastFailedConnectAt = Date.now();
  }

  private logUnavailableOnce(error: unknown): void {
    if (this.hasLoggedUnavailable) {
      return;
    }

    this.hasLoggedUnavailable = true;
    const message = error instanceof Error ? error.message : 'unknown error';
    this.logger.warn(
      `Redis cache unavailable, falling back to database reads: ${message}`,
    );
  }

  private logMissingConfigOnce(reason?: string): void {
    if (this.hasLoggedMissingConfig) {
      return;
    }

    this.hasLoggedMissingConfig = true;
    const suffix = reason ? `: ${reason}` : '';
    this.logger.warn(
      `Redis cache disabled because REDIS_URL is not configured${suffix}`,
    );
  }

  private logDebug(message: string): void {
    if (
      this.configService.get<string>('CACHE_DEBUG')?.trim().toLowerCase() !==
      'true'
    ) {
      return;
    }

    this.logger.debug(message);
  }
}
