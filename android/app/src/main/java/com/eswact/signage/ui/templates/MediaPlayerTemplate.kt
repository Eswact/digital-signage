package com.eswact.signage.ui.templates

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.ContentTransform
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import com.eswact.signage.R
import com.eswact.signage.data.model.MediaPlayerData
import com.eswact.signage.data.model.Slide
import com.eswact.signage.ui.design.ScreenCanvas
import com.eswact.signage.ui.design.StyleSpec
import com.eswact.signage.ui.design.resolvePalette
import com.eswact.signage.ui.design.textStyle
import com.eswact.signage.ui.media.ImageBox
import com.eswact.signage.ui.media.VideoBox
import com.eswact.signage.ui.media.isPlayable
import kotlinx.coroutines.delay
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject

private val json = Json { ignoreUnknownKeys = true; isLenient = true }

/**
 * `media-player` template: one picture or video full screen, or a slideshow of several.
 * Image slides stay for their `durationSec` (default `defaultDurationSec`); videos play to the end.
 * Slides whose file is not downloaded yet stream while online and are skipped while offline.
 * data: { items: [Slide], transition: fade|slide|none, defaultDurationSec, shuffle }
 */
@Composable
fun MediaPlayerTemplate(data: JsonObject) {
    val config = remember(data) {
        runCatching { json.decodeFromJsonElement(MediaPlayerData.serializer(), data) }.getOrNull() ?: MediaPlayerData()
    }
    val palette = remember(data) { resolvePalette(data) }

    ScreenCanvas(palette) {
        // Play order: reshuffled after every full round when shuffle is on.
        var round by remember { mutableIntStateOf(0) }
        val order = remember(config.items, config.shuffle, round) {
            if (config.shuffle) config.items.shuffled() else config.items
        }
        val playable = order.filter { isPlayable(it.asset()) }

        if (playable.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text(
                    text = stringResource(if (config.items.isEmpty()) R.string.media_empty else R.string.media_waiting),
                    style = StyleSpec("roboto", 32f, 400, "muted").textStyle(palette),
                )
            }
            return@ScreenCanvas
        }

        var index by remember { mutableIntStateOf(0) }
        val safeIndex = index % playable.size
        val current = playable[safeIndex]
        val single = playable.size == 1

        fun next() {
            if (single) return
            if (safeIndex + 1 >= playable.size) round++
            index = (safeIndex + 1) % playable.size
        }

        // Image slides advance on a timer (videos advance when they end).
        LaunchedEffect(current.id, current.mediaId, round, single) {
            if (current.kind == "image" && !single) {
                delay(((current.durationSec ?: config.defaultDurationSec).coerceAtLeast(1f) * 1000).toLong())
                next()
            }
        }

        val transition = config.transition
        AnimatedContent(
            targetState = current,
            transitionSpec = { transitionFor(transition) },
            label = "slide",
            modifier = Modifier.fillMaxSize().background(Color.Black),
            contentKey = { it.id + it.mediaId },
        ) { slide ->
            SlideView(slide, loop = single, onEnded = ::next)
        }
    }
}

private fun transitionFor(kind: String): ContentTransform = when (kind) {
    "none" -> fadeIn(tween(0)) togetherWith fadeOut(tween(0))
    "slide" -> (slideInHorizontally(tween(500)) { it } + fadeIn(tween(500))) togetherWith
        (slideOutHorizontally(tween(500)) { -it / 3 } + fadeOut(tween(500)))
    else -> fadeIn(tween(600)) togetherWith fadeOut(tween(600))
}

@Composable
private fun SlideView(slide: Slide, loop: Boolean, onEnded: () -> Unit) {
    val fill = Modifier.fillMaxSize()
    if (slide.kind == "video") {
        VideoBox(slide.asset(), slide.fit, slide.fillColor, slide.muted, loop = loop, onEnded = onEnded, modifier = fill)
    } else {
        ImageBox(slide.asset(), slide.fit, slide.focalX, slide.focalY, slide.fill, slide.fillColor, modifier = fill)
    }
}
