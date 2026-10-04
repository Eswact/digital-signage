package com.camlica.signage.ui

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter

/** Metni QR kod olarak çizer (keskin piksel; beyaz zemin). */
@Composable
fun QrCode(content: String, size: Dp, modifier: Modifier = Modifier) {
    val bitmap = remember(content) { encodeQr(content) } ?: return
    Image(
        bitmap = bitmap,
        contentDescription = "QR: $content",
        filterQuality = FilterQuality.None,
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White)
            .padding(10.dp)
            .size(size),
    )
}

private fun encodeQr(content: String): ImageBitmap? = runCatching {
    val matrix = QRCodeWriter().encode(
        content,
        BarcodeFormat.QR_CODE,
        0,
        0,
        mapOf(EncodeHintType.MARGIN to 0),
    )
    val w = matrix.width
    val h = matrix.height
    val pixels = IntArray(w * h) { i ->
        if (matrix[i % w, i / w]) 0xFF000000.toInt() else 0xFFFFFFFF.toInt()
    }
    Bitmap.createBitmap(pixels, w, h, Bitmap.Config.ARGB_8888).asImageBitmap()
}.getOrNull()
