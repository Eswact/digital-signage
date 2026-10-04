package com.camlica.signage.data.remote

import android.util.Log
import com.camlica.signage.BuildConfig
import com.camlica.signage.data.DeviceIdProvider
import com.camlica.signage.data.ServerConfig
import com.camlica.signage.data.model.RegisterDeviceRequest
import com.camlica.signage.data.model.RegisterDeviceResponse
import com.camlica.signage.ui.templates.TemplateRegistry
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SignageApi @Inject constructor(
    private val client: OkHttpClient,
    private val json: Json,
    private val config: ServerConfig,
    private val identity: DeviceIdProvider,
) {
    private val jsonMedia = "application/json".toMediaType()

    /**
     * Cihazı backend'e kaydeder (idempotent; her bağlantı denemesinden önce).
     * İlk kayıtta sunucunun verdiği gizli anahtar saklanır. Sunucu bu ID'yi
     * başka bir cihaza ait sayarsa (409) yeni kimlik üretilip tekrar denenir.
     * Başarısız olursa false döner.
     */
    suspend fun registerDevice(): Boolean = withContext(Dispatchers.IO) {
        repeat(2) {
            when (val code = postRegister()) {
                200, 201 -> return@withContext true
                409 -> {
                    Log.w(TAG, "Device ID başka cihaza ait → yeni kimlik")
                    identity.regenerate()
                }
                else -> return@withContext false
            }
        }
        false
    }

    /** HTTP durum kodu; ağ hatasında null. */
    private fun postRegister(): Int? {
        val body = json.encodeToString(
            RegisterDeviceRequest(
                deviceId = identity.deviceId,
                secret = identity.secret,
                appVersion = BuildConfig.VERSION_CODE,
                appVersionName = BuildConfig.VERSION_NAME,
                templates = TemplateRegistry.manifest,
            ),
        ).toRequestBody(jsonMedia)
        val request = runCatching {
            Request.Builder().url("${config.apiUrl}/devices/register").post(body).build()
        }.getOrNull() ?: return null
        return runCatching {
            client.newCall(request).execute().use { res ->
                if (res.isSuccessful) {
                    val parsed = runCatching {
                        json.decodeFromString<RegisterDeviceResponse>(res.body?.string().orEmpty())
                    }.getOrNull()
                    parsed?.secret?.let { identity.secret = it }
                    identity.panelUrl = parsed?.panelUrl
                }
                res.code
            }
        }.getOrNull()
    }

    companion object {
        private const val TAG = "SignageApi"
    }
}
