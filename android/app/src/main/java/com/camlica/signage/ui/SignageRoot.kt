package com.camlica.signage.ui

import android.app.Activity
import android.content.pm.ActivityInfo
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import android.view.KeyEvent
import androidx.compose.foundation.focusable
import androidx.compose.runtime.remember
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.platform.LocalContext
import androidx.hilt.navigation.compose.hiltViewModel
import com.camlica.signage.data.remote.ConnectionState
import com.camlica.signage.ui.templates.PairingScreen
import com.camlica.signage.ui.media.LocalMediaCache
import com.camlica.signage.ui.media.LocalOnline
import com.camlica.signage.ui.templates.TemplateRegistry
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.foundation.layout.size
import androidx.compose.ui.Alignment
import androidx.compose.ui.unit.dp

@Composable
fun SignageRoot(viewModel: MainViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsState()
    val screen = state.screen
    val context = LocalContext.current

    // Ekranın yön bilgisine göre cihazı döndür. Ekran yoksa yatay varsayılan.
    // "auto" (uyumlu): yön kilitlenmez, sistem/cihaz durumuna göre döner;
    // şablonlar BoxWithConstraints ile her iki yöne uyum sağlar.
    LaunchedEffect(screen?.orientation) {
        val activity = context as? Activity ?: return@LaunchedEffect
        activity.requestedOrientation = when (screen?.orientation) {
            "portrait" -> ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
            "auto" -> ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
            else -> ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
        }
    }

    var showSettings by rememberSaveable { mutableStateOf(false) }

    // Şablon gösterilirken ayara erişim: ekrana uzun bas (dokunmatik) ya da
    // kumandada Menü / Ayarlar / OK tuşu (Android TV).
    val rootFocus = remember { FocusRequester() }
    LaunchedEffect(screen != null) {
        if (screen != null) runCatching { rootFocus.requestFocus() }
    }
    Box(
        modifier = Modifier
            .fillMaxSize()
            .pointerInput(Unit) {
                detectTapGestures(onLongPress = { showSettings = true })
            }
            .onKeyEvent { event ->
                val open = event.type == KeyEventType.KeyUp && event.nativeKeyEvent.keyCode in SETTINGS_KEYS
                if (open) showSettings = true
                open
            }
            .focusRequester(rootFocus)
            .focusable(),
    ) {
        if (screen == null) {
            // Henüz ekran atanmadı → Device ID'yi göster (pairing için).
            PairingScreen(
                deviceId = state.deviceId,
                online = state.connection == ConnectionState.CONNECTED,
                serverAddress = state.serverAddress,
                pairingUrl = state.pairingUrl,
                onOpenSettings = { showSettings = true },
            )
        } else {
            CompositionLocalProvider(
                LocalMediaCache provides viewModel.mediaCache,
                LocalOnline provides (state.connection == ConnectionState.CONNECTED),
            ) {
                TemplateRegistry.Render(type = screen.template, data = screen.data)
            }
            // Web pages swallow touches: keep a hit area in the corner so a long press still opens settings.
            Box(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .size(72.dp)
                    .pointerInput(Unit) { detectTapGestures(onLongPress = { showSettings = true }) },
            )
        }
    }

    if (showSettings) {
        ServerSettingsDialog(
            current = state.serverAddress,
            defaultAddress = viewModel.defaultServerAddress,
            connected = state.connection == ConnectionState.CONNECTED,
            onSave = { input ->
                viewModel.setServerAddress(input).also { ok -> if (ok) showSettings = false }
            },
            onReset = {
                viewModel.resetServerAddress()
                showSettings = false
            },
            onDismiss = { showSettings = false },
        )
    }
}

private val SETTINGS_KEYS = setOf(
    KeyEvent.KEYCODE_MENU,
    KeyEvent.KEYCODE_SETTINGS,
    KeyEvent.KEYCODE_DPAD_CENTER,
    KeyEvent.KEYCODE_ENTER,
)
