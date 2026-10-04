package com.camlica.signage.ui.templates

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import com.camlica.signage.data.model.OrderBoardData
import com.camlica.signage.ui.design.LocalUnit
import com.camlica.signage.ui.design.DesignTokens
import com.camlica.signage.ui.design.Palette
import com.camlica.signage.ui.design.ScreenCanvas
import com.camlica.signage.ui.design.StyleSet
import com.camlica.signage.ui.design.cssColor
import com.camlica.signage.ui.design.elementStyles
import com.camlica.signage.ui.design.resolvePalette
import com.camlica.signage.ui.design.spec
import com.camlica.signage.ui.design.textStyle
import com.camlica.signage.ui.design.u
import kotlinx.coroutines.delay
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private val json = Json { ignoreUnknownKeys = true; isLenient = true }

/** Öğe varsayılanları (shared/design-tokens.json). */
private val ELEMENTS get() = DesignTokens.orderBoard

/**
 * `order-board` şablonu. Sütun/sipariş JSON'dan dinamik; tema, renkler ve
 * öğe stilleri panelden. Ölçüler göreli birim (panel önizlemesiyle aynı).
 */
@Composable
fun OrderBoardTemplate(data: JsonObject) {
    val board = remember(data) {
        runCatching { json.decodeFromJsonElement(OrderBoardData.serializer(), data) }
            .getOrNull()
    } ?: OrderBoardData()
    val palette = remember(data) { resolvePalette(data) }
    val styles = remember(data) { StyleSet(ELEMENTS, data.elementStyles()) }

    // Tüm sütunlar aynı anda sayfa çevirir.
    val pageTick by produceState(initialValue = 0, board.pageSeconds) {
        while (true) {
            delay(board.pageSeconds.coerceAtLeast(3) * 1000L)
            value++
        }
    }

    val timeFmt = remember { SimpleDateFormat("HH:mm", Locale.getDefault()) }
    val clock by produceState(initialValue = timeFmt.format(Date())) {
        while (true) {
            value = timeFmt.format(Date())
            delay(10_000)
        }
    }

    ScreenCanvas(palette) {
        Column(modifier = Modifier.fillMaxSize().padding(u(32))) {
            val title = board.title.orEmpty()
            if (title.isNotBlank() || board.showClock) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = u(24), start = u(6), end = u(6)),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(u(16)),
                ) {
                    Text(
                        text = title,
                        style = styles["title"].textStyle(palette),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f),
                    )
                    if (board.showClock) {
                        Text(text = clock, style = styles["clock"].textStyle(palette), maxLines = 1)
                    }
                }
            }

            Row(
                modifier = Modifier.fillMaxSize(),
                horizontalArrangement = Arrangement.spacedBy(u(20)),
            ) {
                board.columns.forEach { col ->
                    val items = board.orders.filter { it.columnId == col.id }
                    val accent = cssColor(col.accent) ?: palette.accent
                    BoxWithConstraints(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxHeight()
                            .clip(RoundedCornerShape(u(24)))
                            .background(palette.surface),
                    ) {
                        // Sığmayan siparişler sayfalanır (başında kimse olmayan
                        // ekranda kaydırma işe yaramaz). Panel önizlemesi aynı hesap.
                        val columnU = maxHeight / LocalUnit.current
                        val capacity = pageCapacity(
                            columnU = columnU,
                            headerU = headerHeightU(styles["columnHeader"].size),
                            cardU = cardHeightU(
                                styles["orderCode"].size,
                                if (board.showLabel) styles["orderLabel"].size else null,
                            ),
                        )
                        val pages = items.chunked(capacity).ifEmpty { listOf(emptyList()) }
                        val page = pageTick % pages.size

                        Column(modifier = Modifier.fillMaxSize()) {
                            // Sütun başlığı + sayaç rozeti (+ sayfa)
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(accent)
                                    .padding(horizontal = u(20), vertical = u(14)),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(u(12)),
                            ) {
                                Text(
                                    text = col.title,
                                    style = styles["columnHeader"].textStyle(palette),
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                    modifier = Modifier.weight(1f),
                                )
                                if (pages.size > 1) {
                                    Text(
                                        text = "${page + 1}/${pages.size}",
                                        style = plainStyle(palette, Color.White.copy(alpha = 0.8f), 22f),
                                    )
                                }
                                CountBadge(items.size, palette)
                            }

                            if (items.isEmpty()) {
                                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                    Text("—", style = plainStyle(palette, palette.muted, 40f))
                                }
                            } else {
                                Column(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(u(12)),
                                    verticalArrangement = Arrangement.spacedBy(u(12)),
                                ) {
                                    pages[page].forEach { order ->
                                        OrderCard(
                                            code = order.code,
                                            label = if (board.showLabel) order.label else null,
                                            accent = accent,
                                            palette = palette,
                                            styles = styles,
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/*
 * Sayfalama ölçüleri (göreli birim) — panel OrderBoardPreview ile aynı formül.
 * Metin satır yüksekliği = boyut × 1.2 (TextStyle lineHeight 1.2em).
 */
private fun headerHeightU(headerSize: Float) = 14f * 2 + maxOf(headerSize * 1.2f, 24f * 1.2f + 4f)

private fun cardHeightU(codeSize: Float, labelSize: Float?) =
    14f * 2 + codeSize * 1.2f + (labelSize?.let { 4f + it * 1.2f } ?: 0f)

private fun pageCapacity(columnU: Float, headerU: Float, cardU: Float): Int {
    val avail = columnU - headerU - 12f * 2
    return maxOf(1, ((avail + 12f) / (cardU + 12f)).toInt())
}

@Composable
private fun CountBadge(count: Int, palette: Palette) {
    Box(
        modifier = Modifier
            .clip(CircleShape)
            .background(Color(0x33000000))
            .padding(horizontal = u(12), vertical = u(2)),
    ) {
        Text(
            text = count.toString(),
            style = plainStyle(palette, Color.White, 24f).copy(fontWeight = FontWeight.Bold),
        )
    }
}

@Composable
private fun OrderCard(
    code: String,
    label: String?,
    accent: Color,
    palette: Palette,
    styles: StyleSet,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(IntrinsicSize.Min)
            .clip(RoundedCornerShape(u(18)))
            .background(palette.card),
    ) {
        // Sol accent şerit
        Box(
            modifier = Modifier
                .width(u(6))
                .fillMaxHeight()
                .background(accent),
        )
        Column(modifier = Modifier.padding(horizontal = u(20), vertical = u(14))) {
            Text(
                text = code,
                style = styles["orderCode"].textStyle(palette),
                maxLines = 1,
                softWrap = false,
            )
            if (!label.isNullOrBlank()) {
                Text(
                    text = label,
                    style = styles["orderLabel"].textStyle(palette),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = u(4)),
                )
            }
        }
    }
}

/** Stil sistemine bağlı olmayan küçük metinler (sayaç, boş durum). */
@Composable
internal fun plainStyle(palette: Palette, color: Color, size: Float): TextStyle =
    spec("roboto", size, 400, "text").textStyle(palette).copy(color = color)
