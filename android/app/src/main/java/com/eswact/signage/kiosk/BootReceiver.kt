package com.eswact.signage.kiosk

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/** Cihaz açılınca (kiosk "otomatik başlat" açıksa) uygulamayı başlatır. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        if (!Kiosk.isAutoStart(context)) return
        runCatching { context.startActivity(Kiosk.launchIntent(context)) }
            .onFailure { Log.w("BootReceiver", "Açılışta başlatılamadı: ${it.message}") }
    }
}
