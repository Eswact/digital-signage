import { Logger, OnModuleDestroy } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
} from '@nestjs/websockets';
import { IncomingMessage } from 'http';
import { URL } from 'url';
import { WebSocket } from 'ws';
import { DevicesService } from '../devices/devices.service';
import { EventBusService } from '../events/event-bus.service';
import {
  PROTOCOL_VERSION,
  screenClearMessage,
  screenUpdateMessage,
  WsMessage,
  WsMessageType,
} from './messages';

const HEARTBEAT_INTERVAL = 15_000; // 15s: sunucu PING gönderir
const HEARTBEAT_TIMEOUT = 45_000; // 45s: yanıt yoksa bağlantı kesilir

interface DeviceSocket extends WebSocket {
  deviceId?: string;
  lastActivity?: number;
}

@WebSocketGateway({ path: '/ws' })
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly clients = new Map<string, DeviceSocket>();
  private heartbeatTimer?: NodeJS.Timeout;

  constructor(
    private readonly devices: DevicesService,
    private readonly bus: EventBusService,
  ) {}

  afterInit() {
    // Tüm cihaz kanallarını dinle → ilgili sokete ilet.
    this.bus.onMessage((channel, raw) => {
      if (!channel.startsWith('device:')) return;
      const deviceId = channel.slice('device:'.length);
      const socket = this.clients.get(deviceId);
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(raw);
      }
    });

    this.heartbeatTimer = setInterval(() => this.runHeartbeat(), HEARTBEAT_INTERVAL);
    this.logger.log('WebSocket Gateway ready (/ws)');
  }

  /** Kapanışta zamanlayıcıyı bırak (süreç/test temiz kapansın). */
  onModuleDestroy() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
  }

  async handleConnection(socket: DeviceSocket, req: IncomingMessage) {
    const { deviceId, secret, proto } = this.parseHandshake(req);
    if (!deviceId) {
      socket.close(4000, 'deviceId is required');
      return;
    }
    if (proto !== PROTOCOL_VERSION) {
      socket.close(4010, 'Protocol not supported — update the app');
      return;
    }

    const device = await this.devices.findByDeviceId(deviceId);
    if (!device) {
      socket.close(4004, 'Device is not registered');
      return;
    }
    // Device ID tek başına yetmez: kayıtta verilen gizli anahtar gerekir.
    if (!(await this.devices.authenticate(deviceId, secret))) {
      socket.close(4003, 'Device could not be authenticated');
      return;
    }

    socket.deviceId = deviceId;
    socket.lastActivity = Date.now();
    // Aynı cihazın eski (yarı açık) bağlantısı varsa yenisi geçerli olur;
    // eskisi kapatılır. Eskinin geç gelen disconnect'i yenisini silmez (aşağıda).
    const previous = this.clients.get(deviceId);
    this.clients.set(deviceId, socket);
    if (previous && previous !== socket) {
      previous.close(4001, 'Replaced by a new connection');
    }
    await this.devices.setStatus(deviceId, 'online');
    this.logger.log(`Device connected: ${deviceId}`);

    socket.on('message', (data) => this.handleMessage(socket, data.toString()));

    // Bağlanır bağlanmaz mevcut ekranı gönder (son ekranı hemen göstersin).
    // Ekran atanmamışsa SCREEN_CLEAR → cihaz eski cache yerine pairing gösterir.
    const screen = await this.devices.getCurrentScreenPayload(deviceId);
    this.send(socket, screen ? screenUpdateMessage(screen) : screenClearMessage());
  }

  async handleDisconnect(socket: DeviceSocket) {
    const deviceId = socket.deviceId;
    if (!deviceId) return;
    // Wi-Fi kopup geri gelince yeni bağlantı eskisinin kapanmasından önce
    // gelebilir: yalnızca haritadaki soket bu ise sil / offline yap.
    if (this.clients.get(deviceId) !== socket) return;
    this.clients.delete(deviceId);
    await this.devices.setStatus(deviceId, 'offline');
    this.logger.log(`Device disconnected: ${deviceId}`);
  }

  private async handleMessage(socket: DeviceSocket, raw: string) {
    socket.lastActivity = Date.now();
    let msg: WsMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    switch (msg.type) {
      case WsMessageType.PING:
        this.send(socket, { type: WsMessageType.PONG, ts: Date.now() });
        break;
      case WsMessageType.PONG:
      case WsMessageType.DEVICE_ACK:
        if (socket.deviceId) await this.devices.touch(socket.deviceId);
        break;
      case WsMessageType.REQUEST_SCREEN:
        if (socket.deviceId) {
          const screen = await this.devices.getCurrentScreenPayload(
            socket.deviceId,
          );
          this.send(
            socket,
            screen ? screenUpdateMessage(screen) : screenClearMessage(),
          );
        }
        break;
      default:
        break;
    }
  }

  /** Periyodik: aktif olmayan bağlantıları kes, gerisine PING gönder. */
  private runHeartbeat() {
    const now = Date.now();
    for (const socket of this.clients.values()) {
      const idle = now - (socket.lastActivity ?? 0);
      if (idle > HEARTBEAT_TIMEOUT) {
        socket.terminate();
        continue;
      }
      this.send(socket, { type: WsMessageType.PING, ts: now });
    }
  }

  private send(socket: WebSocket, message: WsMessage) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  /**
   * `?deviceId=…&proto=…`; gizli anahtar `X-Device-Secret` başlığında
   * (log'lara URL ile sızmasın diye sorguda değil).
   */
  private parseHandshake(req: IncomingMessage): {
    deviceId: string | null;
    secret: string | null;
    proto: number | null;
  } {
    const header = req.headers['x-device-secret'];
    const secret = (Array.isArray(header) ? header[0] : header) ?? null;
    try {
      const url = new URL(req.url ?? '', 'http://localhost');
      const proto = Number(url.searchParams.get('proto'));
      return {
        deviceId: url.searchParams.get('deviceId'),
        secret,
        proto: Number.isInteger(proto) ? proto : null,
      };
    } catch {
      return { deviceId: null, secret, proto: null };
    }
  }
}
