package com.camlica.signage.ui.media

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.min
import com.camlica.signage.data.model.Badge
import com.camlica.signage.data.model.Banner
import com.camlica.signage.data.model.Overlays
import com.camlica.signage.ui.design.LocalUnit
import com.camlica.signage.ui.design.LocalUnitOverride
import com.camlica.signage.ui.design.Palette
import com.camlica.signage.ui.design.StyleSpec
import com.camlica.signage.ui.design.cssColor
import com.camlica.signage.ui.design.elementStyles
import com.camlica.signage.ui.design.resolvePalette
import com.camlica.signage.ui.design.spec
import com.camlica.signage.ui.design.textStyle
import com.camlica.signage.ui.design.u
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject

private val json = Json { ignoreUnknownKeys = true; isLenient = true }

/** Default text styles of banners and badges (panel OverlayFrame uses the same values). */
private val BANNER_TEXT = spec("roboto", 56f, 700, "text", "center")
private val BADGE_TEXT = spec("roboto", 40f, 800, "text", "center")

/**
 * Wraps any template with the screen's banners and badges (panel: OverlayFrame): banners
 * reserve space at the top/bottom, the template gets the rest, badges float over a corner.
 * The relative unit comes from the WHOLE screen so the template keeps its proportions.
 */
@Composable
fun OverlayHost(data: JsonObject, content: @Composable () -> Unit) {
    val overlays = remember(data) {
        (data["overlays"] as? JsonObject)?.let { runCatching { json.decodeFromJsonElement(Overlays.serializer(), it) }.getOrNull() }
    }
    if (overlays == null || (overlays.banners.isEmpty() && overlays.badges.isEmpty())) {
        content()
        return
    }
    val palette = remember(data) { resolvePalette(data) }
    val styles = remember(data) { data.elementStyles() }

    BoxWithConstraints(Modifier.fillMaxSize()) {
        val screenHeight = maxHeight
        val shortSide = min(maxWidth, maxHeight)
        val unit = shortSide / 1080f
        CompositionLocalProvider(LocalUnit provides unit, LocalUnitOverride provides unit) {
            Column(Modifier.fillMaxSize()) {
                overlays.banners.firstOrNull { it.position == "top" }?.let { BannerView(it, screenHeight, palette, styles["banner:${it.id}"]) }
                Box(Modifier.weight(1f).fillMaxWidth()) { content() }
                overlays.banners.firstOrNull { it.position == "bottom" }?.let { BannerView(it, screenHeight, palette, styles["banner:${it.id}"]) }
            }
            overlays.badges.forEach { BadgeView(it, shortSide, palette, styles["badge:${it.id}"]) }
        }
    }
}

@Composable
private fun BannerView(
    banner: Banner,
    screenHeight: androidx.compose.ui.unit.Dp,
    palette: Palette,
    style: com.camlica.signage.data.model.ElementStyle?,
) {
    val box = Modifier.fillMaxWidth().height(screenHeight * (banner.heightPct / 100f))
    if (banner.kind == "image" && banner.media != null) {
        ImageBox(banner.media, banner.fit, banner.focalX, banner.focalY, banner.fill, banner.fillColor, modifier = box)
    } else {
        Box(
            modifier = box.background(cssColor(banner.background) ?: palette.accent).padding(horizontal = u(32)),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                banner.text.orEmpty(),
                style = BANNER_TEXT.with(style).textStyle(palette),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
private fun BadgeView(
    badge: Badge,
    shortSide: androidx.compose.ui.unit.Dp,
    palette: Palette,
    style: com.camlica.signage.data.model.ElementStyle?,
) {
    val size = shortSide * (badge.sizePct / 100f)
    val margin = shortSide * (badge.marginPct / 100f)
    val shape: Shape = when (badge.shape) {
        "circle" -> CircleShape
        "rounded" -> RoundedCornerShape(size * 0.18f)
        else -> RectangleShape
    }
    val alignment = when (badge.corner) {
        "tl" -> Alignment.TopStart
        "bl" -> Alignment.BottomStart
        "br" -> Alignment.BottomEnd
        else -> Alignment.TopEnd
    }
    Box(Modifier.fillMaxSize().padding(margin), contentAlignment = alignment) {
        val modifier = Modifier.size(size).clip(shape)
        if (badge.kind == "image" && badge.media != null) {
            ImageBox(badge.media, badge.fit, badge.focalX, badge.focalY, badge.fill, badge.fillColor, modifier = modifier)
        } else {
            Box(
                modifier = modifier.background(cssColor(badge.background) ?: palette.accent).padding(size * 0.08f),
                contentAlignment = Alignment.Center,
            ) {
                Text(badge.text.orEmpty(), style = BADGE_TEXT.with(style).textStyle(palette))
            }
        }
    }
}
