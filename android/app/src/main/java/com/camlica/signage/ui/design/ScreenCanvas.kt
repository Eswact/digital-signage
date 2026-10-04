package com.camlica.signage.ui.design

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.BoxWithConstraintsScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.min

/**
 * 1 göreli birimin dp karşılığı. Tüm ölçüler ekranın kısa kenarı 1080 birim
 * kabul edilerek verilir (panel önizlemesindeki `--u` ile aynı).
 */
val LocalUnit = staticCompositionLocalOf { 1.dp }

/**
 * When banners/badges shrink the area a template gets, the unit must still come from the WHOLE
 * screen (like the panel's `--u`); OverlayHost sets this and ScreenCanvas then adopts it.
 */
val LocalUnitOverride = staticCompositionLocalOf<Dp?> { null }

/** n göreli birim → dp. */
@Composable
fun u(n: Number): Dp = LocalUnit.current * n.toFloat()

/** Şablon tuvali: tema arka planı (dikey geçiş) + göreli birim. */
@Composable
fun ScreenCanvas(
    palette: Palette,
    content: @Composable BoxWithConstraintsScope.() -> Unit,
) {
    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(palette.background, palette.background2))),
    ) {
        val unit = LocalUnitOverride.current ?: (min(maxWidth, maxHeight) / 1080f)
        CompositionLocalProvider(LocalUnit provides unit) {
            content()
        }
    }
}
