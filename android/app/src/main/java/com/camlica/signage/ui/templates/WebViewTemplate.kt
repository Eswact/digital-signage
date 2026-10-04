package com.camlica.signage.ui.templates

import android.annotation.SuppressLint
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.viewinterop.AndroidView
import com.camlica.signage.R
import com.camlica.signage.data.model.WebViewData
import com.camlica.signage.ui.design.ScreenCanvas
import com.camlica.signage.ui.design.StyleSpec
import com.camlica.signage.ui.design.resolvePalette
import com.camlica.signage.ui.design.textStyle
import kotlinx.coroutines.delay
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject

private val json = Json { ignoreUnknownKeys = true; isLenient = true }

private const val RETRY_MS = 30_000L

/**
 * `webview` template: shows an external page full screen. Needs a connection; when the page
 * cannot be loaded the device retries every 30 s and keeps what it had shown meanwhile.
 * data: { url, reloadSeconds }
 */
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun WebViewTemplate(data: JsonObject) {
    val config = remember(data) {
        runCatching { json.decodeFromJsonElement(WebViewData.serializer(), data) }.getOrNull() ?: WebViewData()
    }
    val palette = remember(data) { resolvePalette(data) }
    val url = config.url?.trim().orEmpty()

    ScreenCanvas(palette) {
        if (url.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text(stringResource(R.string.web_no_address), style = StyleSpec("roboto", 32f, 400, "muted").textStyle(palette))
            }
            return@ScreenCanvas
        }

        var failed by remember(url) { mutableStateOf(false) }
        val webView = remember(url) { mutableStateOf<WebView?>(null) }

        // Periodic reload, and a retry loop while the last load failed.
        LaunchedEffect(url, config.reloadSeconds, failed) {
            val every = if (failed) RETRY_MS else config.reloadSeconds * 1000L
            if (every <= 0) return@LaunchedEffect
            while (true) {
                delay(every)
                webView.value?.reload()
            }
        }
        DisposableEffect(url) { onDispose { webView.value?.destroy() } }

        Box(Modifier.fillMaxSize().background(androidx.compose.ui.graphics.Color.White)) {
            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = { ctx ->
                    WebView(ctx).apply {
                        settings.javaScriptEnabled = true
                        settings.domStorageEnabled = true
                        settings.mediaPlaybackRequiresUserGesture = false
                        settings.cacheMode = WebSettings.LOAD_DEFAULT
                        isVerticalScrollBarEnabled = false
                        isHorizontalScrollBarEnabled = false
                        webViewClient = object : WebViewClient() {
                            override fun onPageFinished(view: WebView, url: String) {
                                failed = false
                            }

                            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                                if (request.isForMainFrame) failed = true
                            }
                        }
                        webView.value = this
                        loadUrl(url)
                    }
                },
            )
            if (failed) {
                Box(Modifier.fillMaxSize().background(androidx.compose.ui.graphics.Color(0xCC000000)), contentAlignment = Alignment.Center) {
                    Text(
                        stringResource(R.string.web_unreachable, android.net.Uri.parse(url).host.orEmpty()),
                        style = StyleSpec("roboto", 32f, 500, "text").textStyle(palette),
                    )
                }
            }
        }
    }
}
