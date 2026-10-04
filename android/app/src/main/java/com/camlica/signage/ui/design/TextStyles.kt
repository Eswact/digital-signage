package com.camlica.signage.ui.design

import android.content.Context
import android.graphics.Typeface
import android.os.Build
import androidx.compose.ui.platform.LocalContext
import java.util.concurrent.ConcurrentHashMap

import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.em
import com.camlica.signage.data.model.ElementStyle
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject

/**
 * Gömülü fontlar (assets/fonts) — panel public/fonts ile aynı dosyalar.
 *
 * Değişken (variable) fontlardan her kalınlık için ayrı Typeface üretilir
 * (Typeface.Builder + 'wght' ekseni). res/font + Compose Font(resId, weight)
 * kullanılmaz: aynı kaynaktan farklı kalınlıklar önbellekte karışıyor
 * (cihazda 700 ince, 800 neredeyse en ince çıkıyordu).
 * API 24–25'te eksen ayarı yok: varsayılan örnek + Compose'un sentetik kalını.
 */
object SignageFonts {
    private val FILES = mapOf(
        "roboto" to "fonts/roboto.ttf",
        "inter" to "fonts/inter.ttf",
        "montserrat" to "fonts/montserrat.ttf",
        "oswald" to "fonts/oswald.ttf",
        "bebas" to "fonts/bebas_neue.ttf",
        "playfair" to "fonts/playfair_display.ttf",
        "mono" to "fonts/roboto_mono.ttf",
    )

    /** Tek kalınlıklı (değişken olmayan) dosyalar: kalını sentezlenir (tarayıcı gibi). */
    private val STATIC = setOf("bebas")

    private val cache = ConcurrentHashMap<String, FontFamily>()

    fun family(context: Context, key: String, weight: Int): FontFamily {
        val name = if (key in FILES) key else "roboto"
        val w = weight.coerceIn(100, 900)
        return cache.getOrPut("$name:$w") {
            val path = FILES.getValue(name)
            val typeface = runCatching {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && name !in STATIC) {
                    Typeface.Builder(context.assets, path)
                        .setWeight(w)
                        .setFontVariationSettings("'wght' $w")
                        .build()
                } else {
                    Typeface.createFromAsset(context.assets, path)
                }
            }.getOrDefault(Typeface.DEFAULT)
            FontFamily(typeface)
        }
    }
}

/** Şablonun bir öğesinin varsayılan stili. */
data class StyleSpec(
    val font: String,
    val size: Float,
    val weight: Int,
    val color: String,
    val italic: Boolean = false,
    val align: String = "start",
) {
    /** Kullanıcı stilini (yalnızca değiştirdiği alanlar) uygular. */
    fun with(o: ElementStyle?): StyleSpec = if (o == null) this else StyleSpec(
        font = o.font ?: font,
        size = o.size ?: size,
        weight = o.weight ?: weight,
        color = o.color ?: color,
        italic = o.italic ?: italic,
        align = o.align ?: align,
    )
}

fun spec(font: String, size: Float, weight: Int, color: String, align: String = "start") =
    StyleSpec(font, size, weight, color, align = align)

/** Panelin textCss() karşılığı. Boyut göreli birimden (LocalUnit) dp→sp. */
@Composable
fun StyleSpec.textStyle(palette: Palette): TextStyle {
    val sizeSp = with(LocalDensity.current) { (LocalUnit.current * size).toSp() }
    return TextStyle(
        fontFamily = SignageFonts.family(LocalContext.current, font, weight),
        fontSize = sizeSp,
        fontWeight = FontWeight(weight.coerceIn(1, 1000)),
        fontStyle = if (italic) FontStyle.Italic else FontStyle.Normal,
        color = resolveColor(color, palette),
        textAlign = when (align) {
            "center" -> TextAlign.Center
            "end" -> TextAlign.Right
            else -> TextAlign.Left
        },
        lineHeight = 1.2.em,
    )
}

private val styleJson = Json { ignoreUnknownKeys = true; isLenient = true }

/** data.styles → öğe anahtarı başına kullanıcı stili. Bozuk girdiler yok sayılır. */
fun JsonObject.elementStyles(): Map<String, ElementStyle> {
    val obj = this["styles"] as? JsonObject ?: return emptyMap()
    return obj.mapNotNull { (key, value) ->
        runCatching { styleJson.decodeFromJsonElement(ElementStyle.serializer(), value) }
            .getOrNull()
            ?.let { key to it }
    }.toMap()
}

/** Bir şablonun öğe varsayılanları + kullanıcı stilleri. */
class StyleSet(
    private val defaults: Map<String, StyleSpec>,
    private val overrides: Map<String, ElementStyle>,
) {
    operator fun get(key: String): StyleSpec = defaults.getValue(key).with(overrides[key])
}
