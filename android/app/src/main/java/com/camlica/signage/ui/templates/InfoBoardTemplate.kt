package com.camlica.signage.ui.templates

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.TextStyle
import com.camlica.signage.data.model.ElementStyle
import com.camlica.signage.data.model.InfoBlock
import com.camlica.signage.data.model.InfoBoardData
import com.camlica.signage.ui.design.DesignTokens
import com.camlica.signage.ui.design.Palette
import com.camlica.signage.ui.design.ScreenCanvas
import com.camlica.signage.ui.design.resolvePalette
import com.camlica.signage.ui.design.textStyle
import com.camlica.signage.ui.design.u
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonPrimitive

private val json = Json { ignoreUnknownKeys = true; isLenient = true }

/** Blok varsayılan stili (shared/design-tokens.json). */
private val BLOCK_DEFAULT get() = DesignTokens.blockDefaults

/**
 * `info-board` (bilgi & duyuru) şablonu: serbest yerleşimli metin ve liste
 * blokları. x/y/w ekranın yüzdesi (sol-üst köşe + genişlik).
 * data: { blocks: [{ id, kind: text|list, text, items, bullet, x, y, w, style }] }
 */
@Composable
fun InfoBoardTemplate(data: JsonObject, legacyAnnouncement: Boolean = false) {
    val blocks = remember(data) { blocksOf(data, legacyAnnouncement) }
    val palette = remember(data) { resolvePalette(data) }

    ScreenCanvas(palette) {
        blocks.forEach { block ->
            Box(
                modifier = Modifier
                    .offset(x = maxWidth * (block.x / 100f), y = maxHeight * (block.y / 100f))
                    .width(maxWidth * (block.w / 100f)),
            ) {
                val style = BLOCK_DEFAULT.with(block.style)
                val textStyle = style.textStyle(palette)
                if (block.kind == "list") {
                    ListBlock(block, style.size, textStyle, palette)
                } else {
                    Text(block.text.orEmpty(), style = textStyle, modifier = Modifier.fillMaxWidth())
                }
            }
        }
    }
}

@Composable
private fun ListBlock(block: InfoBlock, size: Float, textStyle: TextStyle, palette: Palette) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(u(size * 0.35f)),
    ) {
        block.items.forEachIndexed { i, item ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(u(size * 0.4f)),
            ) {
                val marker = bulletMarker(block.bullet, i)
                if (marker.isNotEmpty()) {
                    Text(
                        marker,
                        style = textStyle.copy(color = palette.accent),
                        modifier = Modifier.widthIn(min = u(size * 0.8f)),
                    )
                }
                Text(item, style = textStyle, modifier = Modifier.weight(1f))
            }
        }
    }
}

private fun bulletMarker(bullet: String?, index: Int): String = when (bullet ?: "dot") {
    "dash" -> "–"
    "number" -> "${index + 1}."
    "check" -> "✓"
    "none" -> ""
    else -> "•"
}

private fun blocksOf(data: JsonObject, legacyAnnouncement: Boolean): List<InfoBlock> {
    val decoded = runCatching { json.decodeFromJsonElement(InfoBoardData.serializer(), data) }
        .getOrNull()
    return decoded?.blocks ?: legacyBlocks(data, legacyAnnouncement)
}

/**
 * Sunucu migration'ından önce önbelleğe alınmış eski veri için (offline açılış):
 * backend ScreenMigrationsService ile aynı yerleşim.
 */
private fun legacyBlocks(data: JsonObject, announcement: Boolean): List<InfoBlock> {
    fun str(key: String) = (data[key] as? JsonPrimitive)?.contentOrNull.orEmpty()
    val blocks = mutableListOf<InfoBlock>()
    if (announcement) {
        if (str("title").isNotBlank()) {
            blocks += InfoBlock(
                id = "b_title", text = str("title"), x = 6f, y = 30f, w = 88f,
                style = ElementStyle(size = 88f, weight = 700, align = "center"),
            )
        }
        if (str("body").isNotBlank()) {
            blocks += InfoBlock(
                id = "b_body", text = str("body"), x = 10f, y = 52f, w = 80f,
                style = ElementStyle(size = 44f, color = "muted", align = "center"),
            )
        }
        return blocks
    }
    val items = runCatching { data["items"]!!.jsonArray.map { it.jsonPrimitive.content } }
        .getOrDefault(emptyList())
    if (str("title").isNotBlank()) {
        blocks += InfoBlock(
            id = "b_title", text = str("title"), x = 6f, y = 8f, w = 88f,
            style = ElementStyle(size = 72f, weight = 700),
        )
    }
    if (items.isNotEmpty()) {
        blocks += InfoBlock(
            id = "b_list", kind = "list", items = items, bullet = "dot", x = 6f, y = 26f, w = 88f,
            style = ElementStyle(size = 44f),
        )
    }
    if (str("footer").isNotBlank()) {
        blocks += InfoBlock(
            id = "b_footer", text = str("footer"), x = 6f, y = 88f, w = 88f,
            style = ElementStyle(size = 32f, color = "muted"),
        )
    }
    return blocks
}
