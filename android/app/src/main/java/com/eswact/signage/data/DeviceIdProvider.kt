package com.eswact.signage.data

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.random.Random

/**
 * Cihazın kalıcı kimliği: ekranda gösterilen 8 haneli Device ID + sunucunun
 * ilk kayıtta verdiği gizli anahtar (WS el sıkışmasında kullanılır).
 * İlk açılışta üretilir; sonraki açılışlarda aynı kod döner (pairing bozulmaz).
 */
@Singleton
class DeviceIdProvider @Inject constructor(
    @ApplicationContext context: Context,
) {
    private val prefs = context.getSharedPreferences("signage", Context.MODE_PRIVATE)

    private val _deviceId = MutableStateFlow(
        prefs.getString(KEY_ID, null) ?: generate().also {
            prefs.edit().putString(KEY_ID, it).apply()
        },
    )
    val deviceIdFlow: StateFlow<String> = _deviceId.asStateFlow()
    val deviceId: String get() = _deviceId.value

    /** Sunucunun verdiği gizli anahtar (henüz kayıt olunmadıysa null). */
    var secret: String?
        get() = prefs.getString(KEY_SECRET, null)
        set(value) = prefs.edit().putString(KEY_SECRET, value).apply()

    /** Panel adresi (QR ile eşleştirme linki için; sunucudan gelir). */
    var panelUrl: String?
        get() = prefs.getString(KEY_PANEL_URL, null)
        set(value) = prefs.edit().putString(KEY_PANEL_URL, value).apply()

    /**
     * Sunucu bu Device ID'yi başka bir cihaza ait sayarsa (409) yeni kimlik
     * üretilir. Eski kodla eşleştirme panelden yeniden yapılmalıdır.
     */
    fun regenerate() {
        val id = generate()
        prefs.edit().putString(KEY_ID, id).remove(KEY_SECRET).apply()
        _deviceId.value = id
    }

    private fun generate(): String {
        // İnsan tarafından okunabilir 8 karakterlik kod (karışan harfler hariç).
        val alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        return (1..8).map { alphabet[Random.nextInt(alphabet.length)] }.joinToString("")
    }

    companion object {
        private const val KEY_ID = "device_id"
        private const val KEY_SECRET = "device_secret"
        private const val KEY_PANEL_URL = "panel_url"
    }
}
