package com.eswact.signage.ui.design

import androidx.compose.ui.graphics.Color
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull

/*
 * Ekran tasarım sistemi. Tema/öğe değerleri shared/design-tokens.json'dan
 * üretilir (DesignTokens.kt); düzen ölçüleri (padding vb.) panel önizlemesiyle
 * aynı tutulmalıdır.
 */

data class Palette(
    val background: Color,
    val background2: Color,
    val surface: Color,
    val card: Color,
    val text: Color,
    val muted: Color,
    val accent: Color,
) {
    fun token(name: String): Color? = when (name) {
        "background" -> background
        "background2" -> background2
        "surface" -> surface
        "card" -> card
        "text" -> text
        "muted" -> muted
        "accent" -> accent
        else -> null
    }
}

data class ThemePreset(val id: String, val mode: String, val palette: Palette)

internal fun preset(
    id: String,
    mode: String,
    background: String,
    background2: String,
    surface: String,
    card: String,
    text: String,
    muted: String,
    accent: String,
) = ThemePreset(
    id = id,
    mode = mode,
    palette = Palette(
        background = cssColor(background)!!,
        background2 = cssColor(background2)!!,
        surface = cssColor(surface)!!,
        card = cssColor(card)!!,
        text = cssColor(text)!!,
        muted = cssColor(muted)!!,
        accent = cssColor(accent)!!,
    ),
)

/** Hazır temalar — değerler shared/design-tokens.json'dan üretilir (DesignTokens.kt). */
val PRESETS: List<ThemePreset> get() = DesignTokens.presets

/** CSS hex → Color: "#rrggbb" ya da "#rrggbbaa" (CSS sırası, alfa sonda). */
fun cssColor(hex: String?): Color? {
    if (hex == null || !hex.startsWith("#")) return null
    val clean = hex.substring(1)
    val v = clean.toLongOrNull(16) ?: return null
    return when (clean.length) {
        6 -> Color(0xFF000000 or v)
        8 -> Color(((v and 0xFF) shl 24) or (v ushr 8))
        else -> null
    }
}

/** Renk değeri hex ya da palet anahtarı ('text', 'muted', 'accent'…) olabilir. */
fun resolveColor(value: String, palette: Palette): Color =
    cssColor(value) ?: palette.token(value) ?: palette.text

private fun JsonObject.string(key: String): String? =
    (this[key] as? JsonPrimitive)?.contentOrNull

/**
 * data.appearance → palet. appearance yoksa eski order-board `theme`
 * ('dark' | 'light') değerine düşer.
 */
fun resolvePalette(data: JsonObject): Palette {
    val appearance = data["appearance"] as? JsonObject
    val mode = appearance?.string("mode") ?: data.string("theme") ?: "dark"
    val presetId = appearance?.string("preset")
    val base = PRESETS.firstOrNull { it.id == presetId }
        ?: PRESETS.first { it.mode == if (mode == "light") "light" else "dark" }
    val colors = appearance?.get("colors") as? JsonObject ?: return base.palette
    val p = base.palette
    fun c(key: String, fallback: Color) = cssColor(colors.string(key)) ?: fallback
    return Palette(
        background = c("background", p.background),
        background2 = c("background2", p.background2),
        surface = c("surface", p.surface),
        card = c("card", p.card),
        text = c("text", p.text),
        muted = c("muted", p.muted),
        accent = c("accent", p.accent),
    )
}
