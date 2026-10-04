package com.camlica.signage.ui.media

import android.net.Uri
import android.os.Build
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.BiasAlignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import coil.compose.AsyncImage
import com.camlica.signage.data.media.MediaCache
import com.camlica.signage.data.model.AssetRef
import com.camlica.signage.ui.design.cssColor
import java.io.File

/** The on-device media cache (provided by SignageRoot). Null in previews. */
val LocalMediaCache = staticCompositionLocalOf<MediaCache?> { null }

/** Is the server reachable right now? Slides that are not downloaded yet only play when it is. */
val LocalOnline = compositionLocalOf { true }

/**
 * Where to read an asset from: the downloaded file when it is on disk, otherwise the server
 * (streaming) — which Coil/ExoPlayer simply fail to load while offline.
 */
@Composable
fun rememberMediaSource(asset: AssetRef): Any? {
    val cache = LocalMediaCache.current ?: return null
    val ready by cache.ready.collectAsState()
    val downloaded = asset.sha256?.let { it in ready } == true
    return remember(asset.mediaId, asset.sha256, downloaded) { cache.file(asset) ?: cache.url(asset.mediaId) }
}

/** Can this asset be shown now: on disk, or the network is up for streaming. */
@Composable
fun isPlayable(asset: AssetRef): Boolean {
    val cache = LocalMediaCache.current ?: return true
    val ready by cache.ready.collectAsState()
    return (asset.sha256?.let { it in ready } == true) || LocalOnline.current
}

private fun bias(focal: Float) = (focal.coerceIn(0f, 100f) / 50f) - 1f

/**
 * Image box with the same semantics as the panel's MediaBox:
 *  - cover: fills the box; focalX/focalY (0–100 %) pick the part that stays visible;
 *  - contain: whole picture; the leftover space shows a blurred copy of it ("match",
 *    Android 12+, else its average color), a plain color, or nothing.
 */
@Composable
fun ImageBox(
    asset: AssetRef,
    fit: String,
    focalX: Float,
    focalY: Float,
    fill: String,
    fillColor: String?,
    modifier: Modifier = Modifier,
) {
    val source = rememberMediaSource(asset) ?: return
    val contain = fit == "contain"
    val base = when {
        contain && fill == "color" -> cssColor(fillColor) ?: Color.Black
        contain && fill == "match" -> cssColor(asset.avgColor) ?: Color.Black
        else -> Color.Transparent
    }
    Box(modifier = modifier.clipToBounds().background(base)) {
        if (contain && fill == "match" && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AsyncImage(
                model = source,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize().scale(1.25f).blur(24.dp),
            )
        }
        AsyncImage(
            model = source,
            contentDescription = null,
            contentScale = if (contain) ContentScale.Fit else ContentScale.Crop,
            alignment = BiasAlignment(bias(focalX), bias(focalY)),
            modifier = Modifier.fillMaxSize(),
        )
    }
}

/**
 * Video box (Media3 ExoPlayer). Plays from the cache when downloaded. [onEnded] fires when the
 * clip finishes (or cannot be played, so a broken file never freezes a slideshow).
 * Cover crops the center; the blurred "match" fill is not offered for video (too heavy on
 * low-end boxes), the color fill is used instead.
 */
@Composable
fun VideoBox(
    asset: AssetRef,
    fit: String,
    fillColor: String?,
    muted: Boolean,
    loop: Boolean,
    onEnded: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val source = rememberMediaSource(asset) ?: return
    val player = remember { ExoPlayer.Builder(context).build() }
    DisposableEffect(player) { onDispose { player.release() } }

    LaunchedEffect(source, muted, loop) {
        val uri = if (source is File) Uri.fromFile(source) else Uri.parse(source.toString())
        player.setMediaItem(MediaItem.fromUri(uri))
        player.volume = if (muted) 0f else 1f
        player.repeatMode = if (loop) Player.REPEAT_MODE_ONE else Player.REPEAT_MODE_OFF
        player.prepare()
        player.playWhenReady = true
    }
    DisposableEffect(player, onEnded) {
        val listener = object : Player.Listener {
            override fun onPlaybackStateChanged(state: Int) {
                if (state == Player.STATE_ENDED) onEnded()
            }

            override fun onPlayerError(error: androidx.media3.common.PlaybackException) = onEnded()
        }
        player.addListener(listener)
        onDispose { player.removeListener(listener) }
    }

    val background = if (fit == "contain") (cssColor(fillColor) ?: Color.Black) else Color.Black
    AndroidView(
        modifier = modifier.background(background),
        factory = { ctx ->
            PlayerView(ctx).apply {
                useController = false
                this.player = player
                setShutterBackgroundColor(android.graphics.Color.TRANSPARENT)
            }
        },
        update = { view ->
            view.resizeMode = if (fit == "contain") AspectRatioFrameLayout.RESIZE_MODE_FIT else AspectRatioFrameLayout.RESIZE_MODE_ZOOM
        },
    )
}
