import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiKeyThrottlerGuard, LIMITS } from '../common/throttle';
import { IngestService } from './ingest.service';
import { QueueService } from './queue.service';
import { ApiKey } from './api-key.entity';
import { ApiKeyGuard, CurrentApiKey } from './api-key.guard';
import { AddOrderDto, ReplaceOrdersDto, UpdateOrderDto } from './dto/ingest.dto';
import {
  QueueItemDto,
  ReplaceQueueDto,
  SetCurrentDto,
  UpdateQueueItemDto,
} from './dto/queue.dto';

/**
 * Dış sistemlerin (POS, sıramatik vb.) X-API-Key ile veri gönderdiği uçlar.
 * Anahtar hedef ekranı belirler; istekte ekran id'si yer almaz.
 * `orders` uçları order-board, `queue` uçları queue-number ekranında çalışır.
 */
@UseGuards(ApiKeyThrottlerGuard, ApiKeyGuard)
@Throttle(LIMITS.ingest)
@Controller('ingest')
export class IngestController {
  constructor(
    private readonly ingest: IngestService,
    private readonly queue: QueueService,
  ) {}

  @Get('state')
  state(@CurrentApiKey() key: ApiKey) {
    return this.ingest.getState(key.screenId);
  }

  // --- order-board ---

  @Post('orders')
  add(@CurrentApiKey() key: ApiKey, @Body() dto: AddOrderDto) {
    return this.ingest.addOrder(key.screenId, dto);
  }

  @Patch('orders/:orderId')
  update(
    @CurrentApiKey() key: ApiKey,
    @Param('orderId') orderId: string,
    @Body() dto: UpdateOrderDto,
  ) {
    return this.ingest.updateOrder(key.screenId, orderId, dto);
  }

  @Delete('orders/:orderId')
  remove(@CurrentApiKey() key: ApiKey, @Param('orderId') orderId: string) {
    return this.ingest.removeOrder(key.screenId, orderId);
  }

  @Put('orders')
  replace(@CurrentApiKey() key: ApiKey, @Body() dto: ReplaceOrdersDto) {
    return this.ingest.replaceOrders(key.screenId, dto);
  }

  // --- queue-number ---

  @Post('queue/next')
  queueNext(@CurrentApiKey() key: ApiKey) {
    return this.queue.next(key.screenId);
  }

  @Post('queue/prev')
  queuePrev(@CurrentApiKey() key: ApiKey) {
    return this.queue.prev(key.screenId);
  }

  @Put('queue/current')
  queueSetCurrent(@CurrentApiKey() key: ApiKey, @Body() dto: SetCurrentDto) {
    return this.queue.setCurrent(key.screenId, dto);
  }

  @Post('queue/items')
  queueAdd(@CurrentApiKey() key: ApiKey, @Body() dto: QueueItemDto) {
    return this.queue.addItem(key.screenId, dto);
  }

  @Put('queue/items')
  queueReplace(@CurrentApiKey() key: ApiKey, @Body() dto: ReplaceQueueDto) {
    return this.queue.replaceItems(key.screenId, dto);
  }

  @Patch('queue/items/:itemId')
  queueUpdate(
    @CurrentApiKey() key: ApiKey,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateQueueItemDto,
  ) {
    return this.queue.updateItem(key.screenId, itemId, dto);
  }

  @Delete('queue/items/:itemId')
  queueRemove(@CurrentApiKey() key: ApiKey, @Param('itemId') itemId: string) {
    return this.queue.removeItem(key.screenId, itemId);
  }

  @Post('queue/items/:itemId/call')
  queueCall(@CurrentApiKey() key: ApiKey, @Param('itemId') itemId: string) {
    return this.queue.call(key.screenId, itemId);
  }
}
