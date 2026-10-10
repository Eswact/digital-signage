package com.eswact.signage.ui.templates

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextOverflow
import com.eswact.signage.data.model.QueueData
import com.eswact.signage.ui.design.DesignTokens
import com.eswact.signage.ui.design.Palette
import com.eswact.signage.ui.design.ScreenCanvas
import com.eswact.signage.ui.design.StyleSet
import com.eswact.signage.ui.design.elementStyles
import com.eswact.signage.ui.design.resolvePalette
import com.eswact.signage.ui.design.textStyle
import com.eswact.signage.ui.design.u
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject

private val json = Json { ignoreUnknownKeys = true; isLenient = true }

/** Öğe varsayılanları (shared/design-tokens.json). */
private val ELEMENTS get() = DesignTokens.queueNumber

/**
 * `queue-number` şablonu: büyük aktif numara (+ isim) ve isteğe bağlı
 * "sıradakiler" listesi — yatayda sağda, dikeyde altta.
 * data: { heading, current, currentName, subtitle, showQueue, queueTitle,
 *         showNames, queueLimit, queue: [{ id, number, name }] }
 */
@Composable
fun QueueNumberTemplate(data: JsonObject) {
    val q = remember(data) {
        runCatching { json.decodeFromJsonElement(QueueData.serializer(), data) }.getOrNull()
    } ?: QueueData()
    val palette = remember(data) { resolvePalette(data) }
    val styles = remember(data) { StyleSet(ELEMENTS, data.elementStyles()) }

    ScreenCanvas(palette) {
        val portrait = maxHeight > maxWidth
        if (portrait) {
            Column(
                modifier = Modifier.fillMaxSize().padding(u(64)),
                verticalArrangement = Arrangement.spacedBy(u(48)),
            ) {
                CurrentNumber(q, palette, styles, Modifier.weight(3f).fillMaxWidth())
                if (q.showQueue) QueueList(q, palette, styles, Modifier.weight(2f).fillMaxWidth())
            }
        } else {
            Row(
                modifier = Modifier.fillMaxSize().padding(u(64)),
                horizontalArrangement = Arrangement.spacedBy(u(48)),
            ) {
                CurrentNumber(q, palette, styles, Modifier.weight(3f).fillMaxHeight())
                if (q.showQueue) QueueList(q, palette, styles, Modifier.weight(2f).fillMaxHeight())
            }
        }
    }
}

@Composable
private fun CurrentNumber(q: QueueData, palette: Palette, styles: StyleSet, modifier: Modifier) {
    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(u(12), Alignment.CenterVertically),
    ) {
        val full = Modifier.fillMaxWidth()
        if (!q.heading.isNullOrBlank()) {
            Text(q.heading, style = styles["heading"].textStyle(palette), modifier = full)
        }
        Text(
            text = q.current?.ifBlank { null } ?: "—",
            style = styles["number"].textStyle(palette),
            maxLines = 1,
            softWrap = false,
            modifier = full,
        )
        if (!q.currentName.isNullOrBlank()) {
            Text(q.currentName, style = styles["currentName"].textStyle(palette), modifier = full)
        }
        if (!q.subtitle.isNullOrBlank()) {
            Text(q.subtitle, style = styles["subtitle"].textStyle(palette), modifier = full)
        }
    }
}

@Composable
private fun QueueList(q: QueueData, palette: Palette, styles: StyleSet, modifier: Modifier) {
    val items = q.queue.take(q.queueLimit.coerceAtLeast(1))
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(u(32)))
            .background(palette.surface)
            .padding(u(40)),
        verticalArrangement = Arrangement.spacedBy(u(20)),
    ) {
        if (!q.queueTitle.isNullOrBlank()) {
            Text(
                q.queueTitle,
                style = styles["queueTitle"].textStyle(palette),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        if (items.isEmpty()) {
            Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                Text("—", style = plainStyle(palette, palette.muted, 48f))
            }
        } else {
            items.forEach { item ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(u(20)))
                        .background(palette.card)
                        .padding(horizontal = u(28), vertical = u(20)),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(u(24)),
                ) {
                    Text(
                        item.number,
                        style = styles["queueNumber"].textStyle(palette),
                        maxLines = 1,
                        softWrap = false,
                    )
                    if (q.showNames && !item.name.isNullOrBlank()) {
                        Text(
                            item.name,
                            style = styles["queueName"].textStyle(palette),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }
        }
    }
}
