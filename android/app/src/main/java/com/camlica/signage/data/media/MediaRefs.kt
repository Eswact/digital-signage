package com.camlica.signage.data.media

import com.camlica.signage.data.model.AssetRef
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject

private val json = Json { ignoreUnknownKeys = true; isLenient = true }

/**
 * Every library file a screen needs, in the order it should be fetched: banner/badge images first
 * (small, always visible), then slides in play order.
 */
fun collectAssets(data: JsonObject): List<AssetRef> {
    fun decode(el: kotlinx.serialization.json.JsonElement?): AssetRef? =
        (el as? JsonObject)?.let { runCatching { json.decodeFromJsonElement(AssetRef.serializer(), it) }.getOrNull() }
            ?.takeIf { it.mediaId.isNotEmpty() }

    val out = mutableListOf<AssetRef>()
    val overlays = data["overlays"] as? JsonObject
    for (key in listOf("banners", "badges")) {
        (overlays?.get(key) as? JsonArray)?.forEach { out += listOfNotNull(decode((it as? JsonObject)?.get("media"))) }
    }
    (data["items"] as? JsonArray)?.forEach { out += listOfNotNull(decode(it)) }
    return out
}
