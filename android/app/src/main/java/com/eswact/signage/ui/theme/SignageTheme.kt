package com.eswact.signage.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

/** Colors of the device's own UI (pairing screen, settings) — the same ink/paper/accent as the panel. */
object SignageColors {
    val Ink = Color(0xFF0C0C0B)
    val Surface = Color(0xFF161615)
    val Raised = Color(0xFF1F1F1D)
    val Line = Color(0xFF3E3E39)
    val Text = Color(0xFFF2F2EE)
    val Muted = Color(0xFFA8A8A0)
    val Accent = Color(0xFF7D8CFF)
    val Success = Color(0xFF50C896)
}

private val scheme = darkColorScheme(
    primary = SignageColors.Accent,
    onPrimary = SignageColors.Ink,
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
