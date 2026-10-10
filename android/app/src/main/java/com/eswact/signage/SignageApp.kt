package com.eswact.signage

import android.app.Application
import com.eswact.signage.kiosk.Kiosk
import dagger.hilt.android.HiltAndroidApp
import io.sentry.android.core.SentryAndroid
import kotlin.system.exitProcess

@HiltAndroidApp
class SignageApp : Application() {
    override fun onCreate() {
        super.onCreate()
        initSentry()
        installCrashRestart()
    }

    /** Hata raporlama yalnızca derlemede DSN verildiyse açılır (bkz. build.gradle.kts). */
    private fun initSentry() {
        if (BuildConfig.SENTRY_DSN.isBlank()) return
        SentryAndroid.init(this) { options ->
            options.dsn = BuildConfig.SENTRY_DSN
            options.release = "signage-android@${BuildConfig.VERSION_NAME}+${BuildConfig.VERSION_CODE}"
            options.environment = if (BuildConfig.DEBUG) "debug" else "release"
        }
    }

    /**
     * Kiosk: başında kimse olmayan ekran çökünce kendiliğinden geri gelsin.
     * Sentry'nin (varsa) işleyicisini sarar; önce rapor, sonra yeniden başlatma.
     */
    private fun installCrashRestart() {
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, error ->
            runCatching { Kiosk.scheduleRestartAfterCrash(this) }
            if (previous != null) previous.uncaughtException(thread, error) else exitProcess(2)
        }
    }
}
