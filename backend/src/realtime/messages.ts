import { OrientationType, TemplateType } from '../screens/screen.entity';

/**
 * Cihaz ↔ sunucu WebSocket protokol sürümü. Cihaz `?proto=` ile bildirir;
 * uyumsuz değişiklikte artırılır ve eski cihazlar 4010 ile reddedilir.
 */
export const PROTOCOL_VERSION = 1;

/** WebSocket mesaj tipleri (CLAUDE.md ile aynı). */
export enum WsMessageType {
  SCREEN_UPDATE = 'SCREEN_UPDATE',
  SCREEN_PATCH = 'SCREEN_PATCH',
  SCREEN_ASSIGN = 'SCREEN_ASSIGN',
  SCREEN_CLEAR = 'SCREEN_CLEAR', // ekran/eşleştirme kaldırıldı → cihaz pairing ekranına döner
  PING = 'PING',
  PONG = 'PONG',
  DEVICE_ACK = 'DEVICE_ACK',
  REQUEST_SCREEN = 'REQUEST_SCREEN', // cihaz tam senkron ister (patch uygulanamadı)
}

export interface ScreenPayload {
  id: string;
  template: TemplateType;
  orientation: OrientationType;
  data: Record<string, unknown>;
  updatedAt: string;
}

export interface WsMessage<T = unknown> {
  type: WsMessageType;
  payload?: T;
  ts?: number;
}

/** Event bus kanalı: her cihaz için ayrı kanal (Gateway ilgili sokete iletir). */
export function deviceChannel(deviceId: string): string {
  return `device:${deviceId}`;
}

export function screenUpdateMessage(screen: ScreenPayload): WsMessage<ScreenPayload> {
  return { type: WsMessageType.SCREEN_UPDATE, payload: screen, ts: Date.now() };
}

export function screenAssignMessage(screen: ScreenPayload): WsMessage<ScreenPayload> {
  return { type: WsMessageType.SCREEN_ASSIGN, payload: screen, ts: Date.now() };
}

/** Cihazdaki ekranı/eşleştirmeyi kaldırır; cihaz pairing ekranına döner. */
export function screenClearMessage(): WsMessage {
  return { type: WsMessageType.SCREEN_CLEAR, ts: Date.now() };
}

export interface ScreenPatchPayload {
  screenId: string;
  patch: unknown[]; // RFC 6902 JSON Patch operasyonları (data üzerinde)
  base: string | null; // uygulanacağı önceki updatedAt
  updatedAt: string; // yeni updatedAt
}

export function screenPatchMessage(
  payload: ScreenPatchPayload,
): WsMessage<ScreenPatchPayload> {
  return { type: WsMessageType.SCREEN_PATCH, payload, ts: Date.now() };
}
