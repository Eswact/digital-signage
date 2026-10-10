package com.eswact.signage.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

/**
 * Colors of the device's own UI (pairing screen, settings): the default color theme's dark mode,
 * the same values as the panel (generated BrandColors, single source shared/brand.json).
 */
object SignageColors {
    val Ink = BrandColors.Paper
    val Surface = BrandColors.Surface
    val Raised = BrandColors.Sunken
    val Line = BrandColors.LineStrong
    val Text = BrandColors.Ink
    val Muted = BrandColors.Ink2
    val Accent = BrandColors.AccentFill
    val Success = Color(0xFF50C896)
}

private val scheme = darkColorScheme(
    primary = SignageColors.Accent,
    onPrimary = BrandColors.AccentInk,
    background = SignageColors.Ink,
    onBackground = SignageColors.Text,
    surface = SignageColors.Surface,
    onSurface = SignageColors.Text,
    onSurfaceVariant = SignageColors.Muted,
    surfaceContainerHigh = SignageColors.Surface,
    surfaceContainerHighest = SignageColors.Raised,
    outline = SignageColors.Line,
    outlineVariant = SignageColors.Line,
    error = Color(0xFFFF786C),
)

private val typography = Typography(
    headlineSmall = TextStyle(fontSize = 26.sp, fontWeight = FontWeight.SemiBold, letterSpacing = (-0.5).sp),
    titleSmall = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 1.2.sp),
    bodyMedium = TextStyle(fontSize = 15.sp, lineHeight = 22.sp),
    bodySmall = TextStyle(fontSize = 13.sp, lineHeight = 19.sp),
)

@Composable
fun SignageTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = scheme, typography = typography, content = content)
}
