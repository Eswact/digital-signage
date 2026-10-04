package com.camlica.signage.data

import com.camlica.signage.data.local.CachedScreen
import com.camlica.signage.data.local.ScreenDao
import com.camlica.signage.data.model.ScreenPayload
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import javax.inject.Inject
import javax.inject.Singleton

/** Son ekranı Room'a kaydeder / geri yükler (offline gösterim için). */
@Singleton
class ScreenCache @Inject constructor(
    private val dao: ScreenDao,
    private val json: Json,
) {
    suspend fun save(screen: ScreenPayload) {
        dao.upsert(
            CachedScreen(
                id = 0,
                screenId = screen.id,
                template = screen.template,
                orientation = screen.orientation,
                dataJson = screen.data.toString(),
                updatedAt = screen.updatedAt,
            ),
        )
    }

    /** Önbelleği siler (ekran/eşleştirme kaldırılınca). */
    suspend fun clear() {
        dao.clear()
    }

    suspend fun load(): ScreenPayload? {
        val cached = dao.get() ?: return null
        val data = runCatching {
            json.parseToJsonElement(cached.dataJson).jsonObject
        }.getOrDefault(JsonObject(emptyMap()))
        return ScreenPayload(
            id = cached.screenId,
            template = cached.template,
            orientation = cached.orientation,
            data = data,
            updatedAt = cached.updatedAt,
        )
    }
}
