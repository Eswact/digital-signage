import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Jeton varsa kullanıcıyı çözer, yoksa/geçersizse null bırakır (reddetmez). */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<T>(_err: unknown, user: T | false): T | null {
    return user || null;
  }
}
