package com.camlica.signage.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

/** Backend ile aynı WebSocket mesaj tipleri (CLAUDE.md). */
object WsType {
    const val SCREEN_UPDATE = "SCREEN_UPDATE"
    const val SCREEN_PATCH = "SCREEN_PATCH"
    const val SCREEN_ASSIGN = "SCREEN_ASSIGN"
    const val SCREEN_CLEAR = "SCREEN_CLEAR"
    const val PING = "PING"
    const val PONG = "PONG"
    const val DEVICE_ACK = "DEVICE_ACK"
    const val REQUEST_SCREEN = "REQUEST_SCREEN"
}

@Serializable
data class ScreenPayload(
    val id: String,
    val template: String,
    val orientation: String = "landscape",
    val data: JsonObject,
    val updatedAt: String? = null,
)

/** Gelen mesajlar için gevşek zarf — payload type'a göre ayrıca çözülür. */
@Serializable
data class IncomingMessage(
    val type: String,
    val payload: JsonObject? = null,
    val ts: Long? = null,
)

/** SCREEN_PATCH payload'ı: data üzerinde uygulanacak JSON Patch. */
@Serializable
data class ScreenPatchPayload(
    val screenId: String,
    val patch: kotlinx.serialization.json.JsonArray,
    val base: String? = null,
    val updatedAt: String,
)

@Serializable
data class OutgoingMessage(
    val type: String,
    val ts: Long? = null,
)

@Serializable
data class RegisterDeviceRequest(
    @SerialName("deviceId") val deviceId: String,
    /** Önceki kayıtta alınan gizli anahtar (ilk kayıtta yok). */
    val secret: String? = null,
    val name: String? = null,
    val appVersion: Int,
    val appVersionName: String,
    /** Desteklenen şablonlar ve şema sürümleri (TemplateRegistry.manifest). */
    val templates: Map<String, Int>,
)

@Serializable
data class RegisterDeviceResponse(
    val deviceId: String,
    /** Yalnızca ilk kayıtta (anahtar yeni üretilince) gelir. */
    val secret: String? = null,
    val protocol: Int = 1,
    val panelUrl: String? = null,
)

// --- order-board şablonu veri modeli ---

@Serializable
data class OrderColumn(
    val id: String,
    val title: String,
    val accent: String? = null,
)

@Serializable
data class OrderItem(
    val id: String,
    val code: String,
    val label: String? = null,
    val columnId: String,
)

@Serializable
data class OrderBoardData(
    val title: String? = null,
    val showLabel: Boolean = true,
    val showClock: Boolean = true,
    /** Sütuna sığmayan siparişlerde sayfa değiştirme süresi (sn). */
    val pageSeconds: Int = 8,
    val columns: List<OrderColumn> = emptyList(),
    val orders: List<OrderItem> = emptyList(),
)

// --- queue-number şablonu veri modeli ---

@Serializable
data class QueueItem(
    val id: String = "",
    val number: String = "",
    val name: String? = null,
)

@Serializable
data class QueueData(
    val heading: String? = null,
    val current: String? = null,
    val currentName: String? = null,
    val subtitle: String? = null,
    val showQueue: Boolean = false,
    val queueTitle: String? = null,
    val showNames: Boolean = true,
    val queueLimit: Int = 5,
    val queue: List<QueueItem> = emptyList(),
)

// --- info-board (bilgi & duyuru) veri modeli ---

/** Serbest yerleşimli blok: x/y/w ekranın yüzdesi (sol-üst köşe + genişlik). */
@Serializable
data class InfoBlock(
    val id: String = "",
    val kind: String = "text",
    val text: String? = null,
    val items: List<String> = emptyList(),
    val bullet: String? = null,
    val x: Float = 0f,
    val y: Float = 0f,
    val w: Float = 100f,
    val style: ElementStyle? = null,
)

@Serializable
data class InfoBoardData(
    val blocks: List<InfoBlock>? = null,
)

// --- Ortak görünüm ---

/** Öğe stili (panelden). size göreli birim: ekranın kısa kenarı = 1080. */
@Serializable
data class ElementStyle(
    val font: String? = null,
    val size: Float? = null,
    val color: String? = null,
    val weight: Int? = null,
    val italic: Boolean? = null,
    val align: String? = null,
)

// --- Media: library files referenced from screen data ---

/** Descriptor of a library file (filled in by the server). Devices download by [mediaId] and verify [sha256]. */
@Serializable
data class AssetRef(
    val mediaId: String = "",
    val kind: String = "image",
    val sha256: String? = null,
    val bytes: Long = 0,
    val width: Int? = null,
    val height: Int? = null,
    val durationMs: Long? = null,
    val avgColor: String? = null,
)

/** Picture/video slide of the media-player template. Asset fields sit directly on the slide. */
@Serializable
data class Slide(
    val id: String = "",
    val mediaId: String = "",
    val kind: String = "image",
    val sha256: String? = null,
    val bytes: Long = 0,
    val width: Int? = null,
    val height: Int? = null,
    val durationMs: Long? = null,
    val avgColor: String? = null,
    val durationSec: Float? = null,
    val fit: String = "cover",
    val focalX: Float = 50f,
    val focalY: Float = 50f,
    val fill: String = "match",
    val fillColor: String? = null,
    val muted: Boolean = true,
) {
    fun asset() = AssetRef(mediaId, kind, sha256, bytes, width, height, durationMs, avgColor)
}

@Serializable
data class MediaPlayerData(
    val items: List<Slide> = emptyList(),
    val transition: String = "fade",
    val defaultDurationSec: Float = 10f,
    val shuffle: Boolean = false,
)

@Serializable
data class WebViewData(
    val url: String? = null,
    /** Reload interval in seconds; 0 = never. */
    val reloadSeconds: Int = 0,
)

// --- Banners and badges (every template) ---

@Serializable
data class Banner(
    val id: String = "",
    val position: String = "top",
    val heightPct: Float = 14f,
    val kind: String = "image",
    val media: AssetRef? = null,
    val text: String? = null,
    val fit: String = "cover",
    val focalX: Float = 50f,
    val focalY: Float = 50f,
    val fill: String = "match",
    val fillColor: String? = null,
    val background: String? = null,
)

@Serializable
data class Badge(
    val id: String = "",
    val corner: String = "tr",
    val sizePct: Float = 14f,
    val marginPct: Float = 2f,
    val shape: String = "circle",
    val kind: String = "image",
    val media: AssetRef? = null,
    val text: String? = null,
    val fit: String = "contain",
    val focalX: Float = 50f,
    val focalY: Float = 50f,
    val fill: String = "none",
    val fillColor: String? = null,
    val background: String? = null,
)

@Serializable
data class Overlays(
    val banners: List<Banner> = emptyList(),
    val badges: List<Badge> = emptyList(),
)
