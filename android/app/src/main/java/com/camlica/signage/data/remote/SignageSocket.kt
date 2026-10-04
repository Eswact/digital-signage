package com.camlica.signage.data.remote

import android.util.Log
import com.camlica.signage.data.DeviceIdProvider
import com.camlica.signage.data.JsonPatch
import com.camlica.signage.data.ServerConfig
import com.camlica.signage.data.model.IncomingMessage
import com.camlica.signage.data.model.OutgoingMessage
import com.camlica.signage.data.model.ScreenPatchPayload
import com.camlica.signage.data.model.ScreenPayload
import com.camlica.signage.data.model.WsType
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import javax.inject.Inject
import javax.inject.Singleton

enum class ConnectionState { CONNECTING, CONNECTED, DISCONNECTED }

/**
 * Cihazın backend ile canlı bağlantısı. Ham WebSocket (OkHttp).
 * Faz 3: exponential backoff reconnect + heartbeat watchdog.
 */
@Singleton
class SignageSocket @Inject constructor(
    private val client: OkHttpClient,
    private val json: Json,
    private val api: SignageApi,
    private val config: ServerConfig,
    private val identity: DeviceIdProvider,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val _state = MutableStateFlow(ConnectionState.DISCONNECTED)
    val state: StateFlow<ConnectionState> = _state.asStateFlow()

    private val _screen = MutableStateFlow<ScreenPayload?>(null)
    val screen: StateFlow<ScreenPayload?> = _screen.asStateFlow()

    // Ekran/eşleştirme kaldırıldı sinyali — cache'i de temizlemek için.
    private val _cleared = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val cleared: SharedFlow<Unit> = _cleared.asSharedFlow()

    private var webSocket: WebSocket? = null
    private var started = false
    private var reconnectJob: Job? = null
    private var openJob: Job? = null
    private var heartbeatJob: Job? = null
    private var attempt = 0

    @Volatile private var lastMessageAt = 0L
    @Volatile private var manualClose = false

    // Her yeni soket bir nesil alır; eski soketlerin geç gelen olayları yok sayılır
    // (adres değişince eski bağlantının hatası yeni bağlantıyı bozmasın).
    @Volatile private var generation = 0

    fun connect() {
        started = true
        manualClose = false
        openSocket()
        startHeartbeat()
    }

    /** Sunucu adresi değişince: eski bağlantıyı bırak, yeni adrese hemen bağlan. */
    fun restart() {
        if (!started) return
        reconnectJob?.cancel()
        manualClose = false
        attempt = 0
        val old = webSocket
        webSocket = null
        openSocket()
        old?.cancel()
    }

    private fun openSocket() {
        if (!started) return
        val gen = ++generation
        _state.value = ConnectionState.CONNECTING
        openJob?.cancel()
        openJob = scope.launch {
            // Sunucu kayıtsız cihazın WS'ini 4004 ile kapatır. Kayıt idempotent;
            // her denemede yapılır ki açılışta sunucuya ulaşılamadıysa da toparlansın.
            api.registerDevice()
            if (gen != generation) return@launch
            val id = identity.deviceId
            val request = runCatching {
                Request.Builder()
                    .url("${config.wsUrl}?deviceId=$id&proto=$PROTOCOL_VERSION")
                    // Anahtar başlıkta: URL'ler log'lara düşer.
                    .header("X-Device-Secret", identity.secret.orEmpty())
                    .build()
            }.getOrElse {
                Log.w(TAG, "Geçersiz sunucu adresi: ${config.wsUrl}")
                _state.value = ConnectionState.DISCONNECTED
                scheduleReconnect()
                return@launch
            }
            webSocket = client.newWebSocket(request, Listener(gen))
        }
    }

    private inner class Listener(private val gen: Int) : WebSocketListener() {
        private val stale get() = gen != generation

        override fun onOpen(ws: WebSocket, response: Response) {
            if (stale) return ws.cancel()
            attempt = 0
            lastMessageAt = System.currentTimeMillis()
            _state.value = ConnectionState.CONNECTED
            Log.i(TAG, "Bağlandı")
        }

        override fun onMessage(ws: WebSocket, text: String) {
            if (stale) return
            lastMessageAt = System.currentTimeMillis()
            handleMessage(ws, text)
        }

        override fun onFailure(ws: WebSocket, t: Throwable, response: Response?) {
            if (stale) return
            Log.w(TAG, "Bağlantı hatası: ${t.message}")
            _state.value = ConnectionState.DISCONNECTED
            scheduleReconnect()
        }

        // Sunucu kapatınca (ör. 4003/4004/4010) el sıkışmayı tamamla → onClosed.
        override fun onClosing(ws: WebSocket, code: Int, reason: String) {
            if (!stale) Log.w(TAG, "Sunucu bağlantıyı kapattı: $code $reason")
            ws.close(1000, null)
        }

        override fun onClosed(ws: WebSocket, code: Int, reason: String) {
            if (stale) return
            _state.value = ConnectionState.DISCONNECTED
            if (!manualClose) scheduleReconnect()
        }
    }

    private fun handleMessage(ws: WebSocket, text: String) {
        val msg = runCatching { json.decodeFromString<IncomingMessage>(text) }.getOrNull()
            ?: return
        when (msg.type) {
            WsType.PING -> ws.send(json.encodeToString(OutgoingMessage(WsType.PONG)))
            WsType.SCREEN_UPDATE, WsType.SCREEN_ASSIGN -> {
                val screen = msg.payload?.let {
                    runCatching {
                        json.decodeFromJsonElement(ScreenPayload.serializer(), it)
                    }.getOrNull()
                }
                Log.d(TAG, "${msg.type}: ${screen?.template ?: "çözülemedi"}")
                if (screen != null) {
                    _screen.value = screen
                    ws.send(json.encodeToString(OutgoingMessage(WsType.DEVICE_ACK)))
                }
            }
            WsType.SCREEN_PATCH -> {
                val patch = msg.payload?.let {
                    runCatching {
                        json.decodeFromJsonElement(ScreenPatchPayload.serializer(), it)
                    }.onFailure { e -> Log.w(TAG, "SCREEN_PATCH çözülemedi: ${e.message}") }
                        .getOrNull()
                } ?: return
                applyPatch(ws, patch)
            }
            WsType.SCREEN_CLEAR -> {
                // Ekran/eşleştirme kaldırıldı → pairing ekranına dön, cache'i temizle.
                _screen.value = null
                _cleared.tryEmit(Unit)
                ws.send(json.encodeToString(OutgoingMessage(WsType.DEVICE_ACK)))
            }
        }
    }

    /** SCREEN_PATCH uygular; uygulanamıyorsa (senkron dışı/hata) tam ekran ister. */
    private fun applyPatch(ws: WebSocket, patch: ScreenPatchPayload) {
        val current = _screen.value
        if (current == null ||
            current.id != patch.screenId ||
            current.updatedAt != patch.base
        ) {
            Log.d(TAG, "Patch tabanı uyuşmuyor (${current?.updatedAt} ≠ ${patch.base}) → tam ekran iste")
            ws.send(json.encodeToString(OutgoingMessage(WsType.REQUEST_SCREEN)))
            return
        }
        val newData = runCatching { JsonPatch.apply(current.data, patch.patch) }
            .onFailure { Log.w(TAG, "Patch uygulanamadı: ${it.message}") }
            .getOrNull()
        if (newData == null) {
            ws.send(json.encodeToString(OutgoingMessage(WsType.REQUEST_SCREEN)))
            return
        }
        _screen.value = current.copy(data = newData, updatedAt = patch.updatedAt)
        Log.d(TAG, "Patch uygulandı (${patch.patch.size} işlem)")
        ws.send(json.encodeToString(OutgoingMessage(WsType.DEVICE_ACK)))
    }

    /** Exponential backoff: 1s, 2s, 4s … max 30s. */
    private fun scheduleReconnect() {
        if (manualClose) return
        reconnectJob?.cancel()
        val exp = attempt.coerceAtMost(5)
        val delayMs = (1000L shl exp).coerceAtMost(30_000L)
        attempt++
        Log.i(TAG, "Yeniden bağlanılıyor (${delayMs}ms)")
        reconnectJob = scope.launch {
            delay(delayMs)
            openSocket()
        }
    }

    /** 45s boyunca mesaj gelmezse bağlantıyı ölü say ve yeniden bağlan. */
    private fun startHeartbeat() {
        heartbeatJob?.cancel()
        heartbeatJob = scope.launch {
            while (isActive) {
                delay(HEARTBEAT_CHECK)
                if (_state.value != ConnectionState.CONNECTED) continue
                val idle = System.currentTimeMillis() - lastMessageAt
                when {
                    idle > HEARTBEAT_TIMEOUT -> {
                        Log.w(TAG, "Heartbeat timeout → yeniden bağlan")
                        webSocket?.cancel()
                        _state.value = ConnectionState.DISCONNECTED
                        scheduleReconnect()
                    }
                    idle > PING_AFTER ->
                        webSocket?.send(json.encodeToString(OutgoingMessage(WsType.PING)))
                }
            }
        }
    }

    fun disconnect() {
        manualClose = true
        generation++
        reconnectJob?.cancel()
        openJob?.cancel()
        heartbeatJob?.cancel()
        webSocket?.close(1000, "bye")
        webSocket = null
        _state.value = ConnectionState.DISCONNECTED
    }

    companion object {
        private const val TAG = "SignageSocket"

        /** Backend realtime/messages.ts PROTOCOL_VERSION ile aynı. */
        const val PROTOCOL_VERSION = 1
        private const val HEARTBEAT_CHECK = 5_000L
        private const val PING_AFTER = 15_000L
        private const val HEARTBEAT_TIMEOUT = 45_000L
    }
}
