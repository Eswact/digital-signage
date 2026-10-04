import { Controller, Get, MessageEvent, Sse } from '@nestjs/common';
import { Observable, merge, interval, map } from 'rxjs';
import { EventBusService, orgChannel } from '../events/event-bus.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrgAuth } from '../auth/org-role.guard';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { UseGuards } from '@nestjs/common';

/**
 * Server-sent events for the panel: "something changed" hints scoped to the
 * viewer's organization (the superadmin sees every organization). The panel
 * refetches the affected queries — no data travels on this stream.
 */
@Controller('live')
export class LiveController {
  constructor(private readonly bus: EventBusService) {}

  @OrgAuth()
  @Sse()
  stream(@CurrentUser() user: AuthUser): Observable<MessageEvent> {
    const channel = user.orgId ? orgChannel(user.orgId) : null;
    const events = new Observable<MessageEvent>((subscriber) => {
      const handler = (ch: string, raw: string) => {
        if (user.role === 'superadmin' ? ch.startsWith('org:') : ch === channel) {
          subscriber.next({ type: 'change', data: raw });
        }
      };
      this.bus.onMessage(handler);
      return () => this.bus.offMessage(handler);
    });
    // A comment-like heartbeat keeps proxies from closing an idle stream.
    const heartbeat = interval(25_000).pipe(map((): MessageEvent => ({ type: 'ping', data: '{}' })));
    return merge(events, heartbeat);
  }

  /** Cheap probe the panel uses to decide whether SSE is available. */
  @UseGuards(JwtAuthGuard)
  @Get('status')
  status() {
    return { ok: true };
  }
}
