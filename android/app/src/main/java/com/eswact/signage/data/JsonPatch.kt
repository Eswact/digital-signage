package com.eswact.signage.data

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * Minimal RFC 6902 JSON Patch uygulayıcısı (add / replace / remove / move).
 * fast-json-patch `compare` bu operasyonları üretir. Hata olursa çağıran
 * tarafın tam senkron istemesi beklenir (uygulama exception fırlatabilir).
 */
object JsonPatch {

    fun apply(base: JsonObject, ops: JsonArray): JsonObject {
        val root = toMutable(base)
        for (opEl in ops) {
            val op = opEl.jsonObject
            val kind = op["op"]?.jsonPrimitive?.content ?: continue
            val path = op["path"]?.jsonPrimitive?.content ?: continue
            val tokens = parsePath(path)
            when (kind) {
                "add" -> set(root, tokens, toMutable(op.getValue("value")), insert = true)
                "replace" -> set(root, tokens, toMutable(op.getValue("value")), insert = false)
                "remove" -> remove(root, tokens)
                "move" -> {
                    val from = parsePath(op["from"]!!.jsonPrimitive.content)
                    val moved = removeAndReturn(root, from)
                    set(root, tokens, moved, insert = true)
                }
                else -> {}
            }
        }
        @Suppress("UNCHECKED_CAST")
        return fromMutable(root) as JsonObject
    }

    // --- gezinme ---

    private fun parent(root: Any?, tokens: List<String>): Any? {
        var cur = root
        for (t in tokens.dropLast(1)) {
            cur = when (cur) {
                is MutableMap<*, *> -> (cur as MutableMap<String, Any?>)[t]
                is MutableList<*> -> (cur as MutableList<Any?>)[t.toInt()]
                else -> return null
            }
        }
        return cur
    }

    @Suppress("UNCHECKED_CAST")
    private fun set(root: Any?, tokens: List<String>, value: Any?, insert: Boolean) {
        val container = parent(root, tokens) ?: return
        val last = tokens.last()
        when (container) {
            is MutableMap<*, *> -> (container as MutableMap<String, Any?>)[last] = value
            is MutableList<*> -> {
                val list = container as MutableList<Any?>
                val idx = if (last == "-") list.size else last.toInt()
                if (insert) list.add(idx, value) else list[idx] = value
            }
        }
    }

    @Suppress("UNCHECKED_CAST")
    private fun remove(root: Any?, tokens: List<String>) {
        val container = parent(root, tokens) ?: return
        val last = tokens.last()
        when (container) {
            is MutableMap<*, *> -> (container as MutableMap<String, Any?>).remove(last)
            is MutableList<*> -> (container as MutableList<Any?>).removeAt(last.toInt())
        }
    }

    @Suppress("UNCHECKED_CAST")
    private fun removeAndReturn(root: Any?, tokens: List<String>): Any? {
        val container = parent(root, tokens) ?: return null
        val last = tokens.last()
        return when (container) {
            is MutableMap<*, *> -> (container as MutableMap<String, Any?>).remove(last)
            is MutableList<*> -> (container as MutableList<Any?>).removeAt(last.toInt())
            else -> null
        }
    }

    private fun parsePath(path: String): List<String> =
        path.split("/")
            .drop(1)
            .map { it.replace("~1", "/").replace("~0", "~") }

    // --- JsonElement <-> mutable dönüşüm ---

    private fun toMutable(el: JsonElement): Any? = when (el) {
        is JsonObject -> LinkedHashMap<String, Any?>().apply {
            el.forEach { (k, v) -> this[k] = toMutable(v) }
        }
        is JsonArray -> el.map { toMutable(it) }.toMutableList()
        else -> el // JsonPrimitive / JsonNull yaprak olarak kalır
    }

    @Suppress("UNCHECKED_CAST")
    private fun fromMutable(value: Any?): JsonElement = when (value) {
        null -> JsonNull
        is JsonElement -> value
        is Map<*, *> -> JsonObject(
            (value as Map<String, Any?>).mapValues { fromMutable(it.value) },
        )
        is List<*> -> JsonArray(value.map { fromMutable(it) })
        else -> JsonNull
    }
}
