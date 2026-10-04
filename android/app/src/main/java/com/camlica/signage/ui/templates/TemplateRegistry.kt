package com.camlica.signage.ui.templates

import androidx.compose.runtime.Composable
import com.camlica.signage.ui.media.OverlayHost
import kotlinx.serialization.json.JsonObject

/**
 * Şablon kayıt defteri. Her şablon bağımsız bir birimdir; yeni şablon eklemek
 * yalnızca buraya bir giriş eklemeyi gerektirir, mevcut kodu etkilemez.
 */
object TemplateRegistry {
    private val templates: Map<String, @Composable (JsonObject) -> Unit> = mapOf(
        "order-board" to { data -> OrderBoardTemplate(data) },
        "queue-number" to { data -> QueueNumberTemplate(data) },
        "info-board" to { data -> InfoBoardTemplate(data) },
        "media-player" to { data -> MediaPlayerTemplate(data) },
        "webview" to { data -> WebViewTemplate(data) },
        // Eski şablon: sunucuda info-board'a birleştirildi; yalnızca önbellekteki
        // eski veri (offline açılış) için.
        "announcement" to { data -> InfoBoardTemplate(data, legacyAnnouncement = true) },
    )

    /**
     * Desteklenen şablonlar ve veri şeması sürümleri — kayıtta sunucuya
     * bildirilir (backend TEMPLATES[...].version ile karşılaştırılır).
     * Bir şablonun veri şeması uyumsuz değişince burada ve backend'de artırılır.
     */
    val manifest: Map<String, Int> = mapOf(
        "order-board" to 1,
        "queue-number" to 1,
        "info-board" to 1,
        "media-player" to 1,
        "webview" to 1,
    )

    fun isSupported(type: String): Boolean = templates.containsKey(type)

    @Composable
    fun Render(type: String, data: JsonObject) {
        val template = templates[type]
        // Banners and badges are valid on every template, supported or not.
        OverlayHost(data) {
            if (template != null) template(data) else UnsupportedTemplate(type)
        }
    }
}
