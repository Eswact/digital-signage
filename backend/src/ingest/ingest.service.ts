import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { ScreensService } from '../screens/screens.service';
import { AddOrderDto, ReplaceOrdersDto, UpdateOrderDto } from './dto/ingest.dto';
import { queueOf } from './queue.service';
import { assertTemplate } from './template-guard';

export interface OrderColumn {
  id: string;
  title: string;
  accent?: string;
}
export interface OrderItem {
  id: string;
  code: string;
  label?: string;
  columnId: string;
}
export interface OrderBoardData {
  title?: string;
  showLabel?: boolean;
  columns: OrderColumn[];
  orders: OrderItem[];
}

/** data üzerinde (yerinde) order-board görünümü — eksik diziler tamamlanır. */
function boardOf(data: Record<string, unknown>): OrderBoardData {
  const board = data as unknown as OrderBoardData;
  board.columns ??= [];
  board.orders ??= [];
  return board;
}

@Injectable()
export class IngestService {
  constructor(private readonly screens: ScreensService) {}

  private assertColumn(board: OrderBoardData, columnId: string) {
    if (!board.columns.some((c) => c.id === columnId)) {
      throw new BadRequestException(
        `Invalid columnId: ${columnId}. Valid: ${board.columns
          .map((c) => c.id)
          .join(', ')}`,
      );
    }
  }

  private newId(): string {
    return `o_${randomBytes(6).toString('hex')}`;
  }

  /** order-board verisini kilitli olarak değiştirir ve yayınlar. */
  private mutateBoard<R>(screenId: string, fn: (board: OrderBoardData) => R): Promise<R> {
    return this.screens.mutateData(screenId, (data, screen) => {
      assertTemplate(screen, 'order-board');
      return fn(boardOf(data));
    });
  }

  /** Ekranın güncel verisi (şablona göre eksik alanlar tamamlanmış). */
  async getState(screenId: string): Promise<Record<string, unknown>> {
    const screen = await this.screens.getByIdInternal(screenId);
    const data = structuredClone(screen.data ?? {});
    if (screen.template === 'order-board') boardOf(data);
    if (screen.template === 'queue-number') queueOf(data);
    return data;
  }

  addOrder(screenId: string, dto: AddOrderDto): Promise<OrderItem> {
    return this.mutateBoard(screenId, (board) => {
      this.assertColumn(board, dto.columnId);
      const order: OrderItem = {
        id: dto.id ?? this.newId(),
        code: dto.code,
        label: dto.label ?? '',
        columnId: dto.columnId,
      };
      board.orders.push(order);
      return order;
    });
  }

  updateOrder(
    screenId: string,
    orderId: string,
    dto: UpdateOrderDto,
  ): Promise<OrderItem> {
    return this.mutateBoard(screenId, (board) => {
      const order = board.orders.find((o) => o.id === orderId);
      if (!order) throw new NotFoundException('Order not found');
      if (dto.columnId !== undefined) {
        this.assertColumn(board, dto.columnId);
        order.columnId = dto.columnId;
      }
      if (dto.code !== undefined) order.code = dto.code;
      if (dto.label !== undefined) order.label = dto.label;
      return order;
    });
  }

  removeOrder(screenId: string, orderId: string): Promise<void> {
    return this.mutateBoard(screenId, (board) => {
      const before = board.orders.length;
      board.orders = board.orders.filter((o) => o.id !== orderId);
      if (board.orders.length === before) {
        throw new NotFoundException('Order not found');
      }
    });
  }

  replaceOrders(
    screenId: string,
    dto: ReplaceOrdersDto,
  ): Promise<OrderBoardData> {
    return this.mutateBoard(screenId, (board) => {
      board.orders = dto.orders.map((o) => {
        this.assertColumn(board, o.columnId);
        return {
          id: o.id ?? this.newId(),
          code: o.code,
          label: o.label ?? '',
          columnId: o.columnId,
        };
      });
      return structuredClone(board);
    });
  }
}
