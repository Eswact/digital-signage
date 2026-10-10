package com.eswact.signage.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.eswact.signage.data.DeviceIdProvider
import com.eswact.signage.data.ScreenCache
import com.eswact.signage.data.ServerConfig
import com.eswact.signage.data.media.MediaCache
import com.eswact.signage.data.media.collectAssets
import com.eswact.signage.data.model.ScreenPayload
import com.eswact.signage.data.remote.ConnectionState
import com.eswact.signage.data.remote.SignageSocket
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

data class UiState(
    val deviceId: String,
    val connection: ConnectionState,
    val screen: ScreenPayload?,
    val serverAddress: String,
    /** QR ile eşleştirme linki (panel adresi biliniyorsa). */
    val pairingUrl: String?,
)

@HiltViewModel
class MainViewModel @Inject constructor(
    private val deviceIdProvider: DeviceIdProvider,
    private val socket: SignageSocket,
    private val cache: ScreenCache,
    private val serverConfig: ServerConfig,
    val mediaCache: MediaCache,
) : ViewModel() {


    // Offline/başlangıç için son bilinen ekran (Room'dan yüklenir).
    private val cachedScreen = MutableStateFlow<ScreenPayload?>(null)

    val uiState: StateFlow<UiState> =
        combine(
            socket.state,
            socket.screen,
            cachedScreen,
            serverConfig.address,
            deviceIdProvider.deviceIdFlow,
        ) { connection, live, cached, address, deviceId ->
            UiState(
                deviceId = deviceId,
                connection = connection,
                // Canlı ekran varsa onu, yoksa son kaydedilen ekranı göster.
                screen = live ?: cached,
                serverAddress = address,
                pairingUrl = pairingUrl(deviceId),
            )
        }.stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5_000),
            initialValue = UiState(
                deviceIdProvider.deviceId,
                ConnectionState.DISCONNECTED,
                null,
                serverConfig.address.value,
                null,
            ),
        )

    val defaultServerAddress: String get() = serverConfig.defaultAddress

    /**
     * Panel adresi sunucudan (PANEL_URL) gelir. Yoksa tahmin: geliştirmede
     * backend :3001, panel :3000; reverse proxy arkasında aynı origin.
     */
    private fun pairingUrl(deviceId: String): String {
        val panel = deviceIdProvider.panelUrl?.trimEnd('/')
            ?: serverConfig.origin.let { o ->
                if (o.endsWith(":3001")) o.removeSuffix(":3001") + ":3000" else o
            }
        return "$panel/devices?pair=$deviceId"
    }

    /** Yeni sunucu adresini kaydeder ve hemen yeniden bağlanır. Geçersizse false. */
    fun setServerAddress(input: String): Boolean {
        if (!serverConfig.set(input)) return false
        socket.restart()
        return true
    }

    fun resetServerAddress() {
        serverConfig.reset()
        socket.restart()
    }

    init {
        // Önce diskteki son ekranı yükle (offline anında gösterim).
        viewModelScope.launch { cachedScreen.value = cache.load() }

        // Gelen her ekranı diske kaydet.
        viewModelScope.launch {
            socket.screen.collect { s ->
                if (s != null) {
                    cachedScreen.value = s
                    cache.save(s)
                }
            }
        }

        // Ekran/eşleştirme kaldırıldı → cache'i de temizle ki pairing ekranı görünsün.
        viewModelScope.launch {
            socket.cleared.collect {
                cachedScreen.value = null
                cache.clear()
            }
        }

        // Keep the media of whatever screen is showing (live or cached) downloaded for offline play.
        viewModelScope.launch {
            combine(socket.screen, cachedScreen) { live, cached -> (live ?: cached)?.data }
                .distinctUntilChanged()
                .collect { data -> mediaCache.sync(if (data == null) emptyList() else collectAssets(data)) }
        }

        // Canlı bağlantıyı kur (soket her denemede cihazı kaydeder).
        socket.connect()
    }

    override fun onCleared() {
        socket.disconnect()
    }
}
