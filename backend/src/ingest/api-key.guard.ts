import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { ApiKey } from './api-key.entity';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeys: ApiKeysService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const header = req.headers['x-api-key'];
    const raw = Array.isArray(header) ? header[0] : header;
    if (!raw) {
      throw new UnauthorizedException('X-API-Key header is required');
    }
    const key = await this.apiKeys.verify(raw);
    if (!key) {
      throw new UnauthorizedException('Invalid API key');
    }
    req.apiKey = key;
    return true;
  }
}

/** Ingest uçlarında aktif API anahtarını (ve bağlı screenId'yi) verir. */
export const CurrentApiKey = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ApiKey => {
    return ctx.switchToHttp().getRequest().apiKey;
  },
);
