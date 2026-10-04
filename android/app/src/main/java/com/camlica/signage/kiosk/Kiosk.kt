package com.camlica.signage.kiosk

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.camlica.signage.MainActivity

/**
 * Kiosk ayarları: açılışta otomatik başlama, launcher olarak kullanma ve
 * çökünce yeniden başlama. Ayarlar cihazda saklanır (SharedPreferences).
 *
 * Android 10+ arka plandan activity başlatmayı kısıtlar: açılışta/çökmede
 * otomatik başlatma için "Diğer uygulamaların üzerinde göster" izni ya da
 * uygulamanın varsayılan launcher olması gerekir.
 */
object Kiosk {
    private const val PREFS = "signage"
    private const val KEY_AUTO_START = "kiosk_auto_start"
    private const val KEY_CRASHES = "kiosk_crash_times"
    private const val HOME_ALIAS = "com.camlica.signage.HomeLauncher"

    /** Bu süre içinde bu kadar çökme olursa yeniden başlatma durur (döngü olmasın). */
    private const val CRASH_WINDOW_MS = 120_000L
    private const val MAX_CRASHES = 3

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun isAutoStart(context: Context): Boolean =
        prefs(context).getBoolean(KEY_AUTO_START, false)

    fun setAutoStart(context: Context, enabled: Boolean) {
        prefs(context).edit().putBoolean(KEY_AUTO_START, enabled).apply()
    }

    /** Arka plandan başlatma izni var mı (Android 10 öncesinde gerekmez)? */
    fun canStartFromBackground(context: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || Settings.canDrawOverlays(context)

    fun overlayPermissionIntent(context: Context): Intent =
        Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:${context.packageName}"),
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

    fun isHomeLauncher(context: Context): Boolean =
        context.packageManager.getComponentEnabledSetting(
            ComponentName(context, HOME_ALIAS),
        ) == PackageManager.COMPONENT_ENABLED_STATE_ENABLED

    /** Launcher takma adını açar/kapatır. Açınca kullanıcı varsayılan launcher'ı seçmeli. */
    fun setHomeLauncher(context: Context, enabled: Boolean) {
        context.packageManager.setComponentEnabledSetting(
            ComponentName(context, HOME_ALIAS),
            if (enabled) {
                PackageManager.COMPONENT_ENABLED_STATE_ENABLED
            } else {
                PackageManager.COMPONENT_ENABLED_STATE_DISABLED
            },
            PackageManager.DONT_KILL_APP,
        )
    }

    fun homeSettingsIntent(): Intent =
        Intent(Settings.ACTION_HOME_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

    fun launchIntent(context: Context): Intent =
        Intent(context, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)

    /** Çökme sonrası: kısa süre içinde çok çökme yoksa uygulamayı yeniden başlat. */
    fun scheduleRestartAfterCrash(context: Context) {
        val now = System.currentTimeMillis()
        val recent = prefs(context).getString(KEY_CRASHES, "").orEmpty()
            .split(',')
            .mapNotNull { it.toLongOrNull() }
            .filter { now - it < CRASH_WINDOW_MS } + now
        // commit: süreç birazdan ölecek, apply() yazmayabilir.
        prefs(context).edit().putString(KEY_CRASHES, recent.joinToString(",")).commit()
        if (recent.size > MAX_CRASHES) return

        val pending = PendingIntent.getActivity(
            context,
            0,
            launchIntent(context),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_CANCEL_CURRENT,
        )
        val alarm = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        alarm.set(AlarmManager.RTC, now + 1_500, pending)
    }
}
