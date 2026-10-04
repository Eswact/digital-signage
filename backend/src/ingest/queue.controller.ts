import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { OrgAuth } from '../auth/org-role.guard';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { ScreensService } from '../screens/screens.service';
import { QueueService } from './queue.service';
import {
  QueueItemDto,
  SetCurrentDto,
  UpdateQueueItemDto,
} from './dto/queue.dto';

/**
 * Panel (JWT) için sıra numarası işlemleri — ingest `queue` uçlarıyla aynı
 * servis. Panel numarayı sunucuda değiştirir; böylece POS ile yarışmaz.
 */
@OrgAuth()
@Controller('screens/:screenId/queue')
export class QueueController {
  constructor(
    private readonly screens: ScreensService,
    private readonly queue: QueueService,
  ) {}

  @Post('next')
  async next(@CurrentUser() user: AuthUser, @Param('screenId') screenId: string) {
    await this.screens.findForViewer(user, screenId);
    return this.queue.next(screenId);
  }

  @Post('prev')
  async prev(@CurrentUser() user: AuthUser, @Param('screenId') screenId: string) {
    await this.screens.findForViewer(user, screenId);
    return this.queue.prev(screenId);
  }

  @Put('current')
  async setCurrent(
    @CurrentUser() user: AuthUser,
    @Param('screenId') screenId: string,
    @Body() dto: SetCurrentDto,
  ) {
    await this.screens.findForViewer(user, screenId);
    return this.queue.setCurrent(screenId, dto);
  }

  @Post('items')
  async add(
    @CurrentUser() user: AuthUser,
    @Param('screenId') screenId: string,
    @Body() dto: QueueItemDto,
  ) {
    await this.screens.findForViewer(user, screenId);
    return this.queue.addItem(screenId, dto);
  }

  @Patch('items/:itemId')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('screenId') screenId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateQueueItemDto,
  ) {
    await this.screens.findForViewer(user, screenId);
    return this.queue.updateItem(screenId, itemId, dto);
  }

  @Delete('items/:itemId')
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('screenId') screenId: string,
    @Param('itemId') itemId: string,
  ) {
    await this.screens.findForViewer(user, screenId);
    return this.queue.removeItem(screenId, itemId);
  }

  @Post('items/:itemId/call')
  async call(
    @CurrentUser() user: AuthUser,
    @Param('screenId') screenId: string,
    @Param('itemId') itemId: string,
  ) {
    await this.screens.findForViewer(user, screenId);
    return this.queue.call(screenId, itemId);
  }
}
