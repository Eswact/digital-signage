package com.camlica.signage.data.media

import android.content.Context
import android.util.Log
import com.camlica.signage.data.ServerConfig
import com.camlica.signage.data.model.AssetRef
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.security.MessageDigest
import javax.inject.Inject
import javax.inject.Singleton

/**
 * On-device media cache: images and videos of the current screen are downloaded ahead of time,
 * verified against the SHA-256 the server announced, and played from disk — so media keeps
 * playing when the network drops. Files are named by their hash, so an unchanged file is never
 * downloaded twice and a replaced one never serves stale bytes.
 *
 * Disk use is capped: when the cache grows past the quota, the least recently used files that
 * the current screen does not need are deleted first.
 */
@Singleton
class MediaCache @Inject constructor(
    @ApplicationContext context: Context,
    private val client: OkHttpClient,
    private val config: ServerConfig,
) {
    private val dir = File(context.filesDir, "media").apply { mkdirs() }
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var job: Job? = null

    private val _ready = MutableStateFlow<Set<String>>(emptySet())

    /** Hashes of the files that are fully downloaded; Compose observes this to switch from streaming to disk. */
    val ready: StateFlow<Set<String>> = _ready.asStateFlow()

    init {
        // Leftovers of an interrupted download are not trustworthy.
        dir.listFiles { f -> f.name.endsWith(PART) }?.forEach { it.delete() }
        _ready.value = dir.listFiles()?.map { it.name }?.toSet().orEmpty()
    }

    /** The downloaded file for [asset], or null if it is not (yet) on disk. */
    fun file(asset: AssetRef): File? {
        val hash = asset.sha256 ?: return null
        val f = File(dir, hash)
        if (!f.isFile) return null
        f.setLastModified(System.currentTimeMillis()) // LRU: it is being used
        return f
    }

    /** Remote address (streaming fallback while the file is not downloaded yet). */
    fun url(mediaId: String): String = "${config.apiUrl}/media/file/$mediaId"

    /**
     * Makes sure the given assets are on disk, in order (the first slide matters most). Replaces any
     * earlier sync. Failures are retried with a growing delay while something is still missing.
     */
    fun sync(assets: List<AssetRef>) {
        job?.cancel()
        val wanted = assets.filter { it.sha256 != null }.distinctBy { it.sha256 }
        job = scope.launch {
            var delayMs = RETRY_MIN
            while (isActive) {
                val missing = wanted.filter { !File(dir, it.sha256!!).isFile }
                if (missing.isEmpty()) break
                var failed = false
                for (asset in missing) {
                    if (!isActive) return@launch
                    if (!download(asset)) failed = true
                }
                if (!failed) break
                delay(delayMs)
                delayMs = (delayMs * 2).coerceAtMost(RETRY_MAX)
            }
            evict(keep = wanted.mapNotNull { it.sha256 }.toSet())
        }
    }

    private fun download(asset: AssetRef): Boolean {
        val hash = asset.sha256 ?: return false
        if (asset.bytes > 0 && asset.bytes > dir.usableSpace - SPACE_RESERVE) {
            Log.w(TAG, "Not enough space for ${asset.mediaId} (${asset.bytes} bytes)")
            return false
        }
        val part = File(dir, "$hash$PART")
        return runCatching {
            val request = Request.Builder().url(url(asset.mediaId)).build()
            client.newCall(request).execute().use { res ->
                if (!res.isSuccessful) error("HTTP ${res.code}")
                val digest = MessageDigest.getInstance("SHA-256")
                res.body!!.byteStream().use { input ->
                    part.outputStream().use { out ->
                        val buf = ByteArray(64 * 1024)
                        while (true) {
                            val n = input.read(buf)
                            if (n < 0) break
                            digest.update(buf, 0, n)
                            out.write(buf, 0, n)
                        }
                    }
                }
                val actual = digest.digest().joinToString("") { "%02x".format(it) }
                if (actual != hash) error("checksum mismatch")
            }
            check(part.renameTo(File(dir, hash)))
            _ready.value = _ready.value + hash
            true
        }.getOrElse {
            Log.w(TAG, "Download of ${asset.mediaId} failed: ${it.message}")
            part.delete()
            false
        }
    }

    /** Trims the cache to its quota, oldest unused first; files the current screen needs stay. */
    private fun evict(keep: Set<String>) {
        val files = dir.listFiles { f -> !f.name.endsWith(PART) } ?: return
        var total = files.sumOf { it.length() }
        val quota = quota()
        if (total <= quota) return
        for (f in files.filter { it.name !in keep }.sortedBy { it.lastModified() }) {
            if (total <= quota) break
            total -= f.length()
            f.delete()
            _ready.value = _ready.value - f.name
        }
    }

    /** At most 2 GB, and never more than 40 % of what the device has free for us. */
    private fun quota(): Long {
        val used = dir.listFiles()?.sumOf { it.length() } ?: 0L
        return minOf(MAX_QUOTA, ((dir.usableSpace + used) * 0.4).toLong())
    }

    companion object {
        private const val TAG = "MediaCache"
        private const val PART = ".part"
        private const val MAX_QUOTA = 2L * 1024 * 1024 * 1024
        private const val SPACE_RESERVE = 100L * 1024 * 1024
        private const val RETRY_MIN = 10_000L
        private const val RETRY_MAX = 5 * 60_000L
    }
}
