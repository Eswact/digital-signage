package com.camlica.signage.data

import android.content.Context
import com.camlica.signage.BuildConfig
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Bağlanılacak sunucu adresi. Cihazda (SharedPreferences) saklanır ve
 * uygulama içinden değiştirilebilir; APK'daki BuildConfig.API_URL yalnızca
 * varsayılandır. Adres "http(s)://host:port" kökü olarak tutulur; REST için
 * `/api`, WebSocket için `/ws` eklenir.
 */
@Singleton
class ServerConfig @Inject constructor(
    @ApplicationContext context: Context,
) {
    private val prefs = context.getSharedPreferences("signage", Context.MODE_PRIVATE)

    private val defaultOrigin: String =
        normalize(BuildConfig.API_URL.removeSuffix("/api")) ?: "http://10.0.2.2:$DEFAULT_PORT"

    private val _origin = MutableStateFlow(prefs.getString(KEY, null) ?: defaultOrigin)

    /** Kullanıcıya gösterilen adres (ör. "192.168.1.57:3001"). */
    val address: StateFlow<String> get() = _display.asStateFlow()
    private val _display = MutableStateFlow(display(_origin.value))

    val defaultAddress: String get() = display(defaultOrigin)

    /** "http(s)://host:port" kökü. */
    val origin: String get() = _origin.value

    val apiUrl: String get() = "${_origin.value}/api"

    val wsUrl: String get() = _origin.value.replaceFirst("http", "ws") + "/ws"

    /** Girilen adresi doğrulayıp kaydeder; geçersizse false. */
    fun set(input: String): Boolean {
        val origin = normalize(input) ?: return false
        prefs.edit().putString(KEY, origin).apply()
        update(origin)
        return true
    }

    fun reset() {
        prefs.edit().remove(KEY).apply()
        update(defaultOrigin)
    }

    private fun update(origin: String) {
        _origin.value = origin
        _display.value = display(origin)
    }

    companion object {
        private const val KEY = "server_origin"
        const val DEFAULT_PORT = 3001

        /**
         * "192.168.1.57", "192.168.1.57:3001", "http://host:3001/api",
         * "ws://host:3001/ws" gibi girdileri "http://host:port" köküne çevirir.
         * Port yazılmazsa backend varsayılanı (3001) kullanılır.
         */
        fun normalize(input: String): String? {
            var s = input.trim().trimEnd('/')
            if (s.isEmpty()) return null
            s = when {
                s.startsWith("wss://") -> "https://" + s.removePrefix("wss://")
                s.startsWith("ws://") -> "http://" + s.removePrefix("ws://")
                "://" in s -> s
                else -> "http://$s"
            }
            val url = s.toHttpUrlOrNull() ?: return null
            val authority = s.substringAfter("://").substringBefore('/')
            val hasPort = authority.substringAfterLast(']').contains(':')
            val port = if (hasPort) url.port else DEFAULT_PORT
            return "${url.scheme}://${url.host}:$port"
        }

        private fun display(origin: String): String = origin.removePrefix("http://")
    }
}
