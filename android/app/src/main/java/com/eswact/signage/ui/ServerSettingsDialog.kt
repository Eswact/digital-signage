package com.eswact.signage.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.ui.Alignment
import androidx.compose.ui.res.stringResource
import com.eswact.signage.R
import com.eswact.signage.ui.theme.SignageColors
import androidx.compose.ui.platform.LocalContext
import com.eswact.signage.kiosk.Kiosk
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp

/**
 * Sunucu adresi + kiosk ayarları. Adres cihazda saklanır (ServerConfig);
 * kaydedilince uygulama hemen yeni adrese yeniden bağlanır.
 *
 * Özel Dialog: AlertDialog yatay telefonda içeriği kırpıp kaydırmıyordu.
 * Geniş ekranda iki sütun (sunucu | kiosk), dar ekranda tek kaydırılabilir sütun.
 */
@Composable
fun ServerSettingsDialog(
    current: String,
    defaultAddress: String,
    connected: Boolean,
    onSave: (String) -> Boolean,
    onReset: () -> Unit,
    onDismiss: () -> Unit,
) {
    var text by remember { mutableStateOf(current) }
    var error by remember { mutableStateOf<String?>(null) }
    val invalidMessage = stringResource(R.string.settings_invalid)

    fun save() {
        if (!onSave(text)) error = invalidMessage
    }

    val server: @Composable () -> Unit = {
        Text(stringResource(R.string.settings_server).uppercase(), style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(
            stringResource(R.string.settings_server_help),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 4.dp),
        )
        OutlinedTextField(
            value = text,
            onValueChange = {
                text = it
                error = null
            },
            singleLine = true,
            label = { Text(stringResource(R.string.settings_address)) },
            placeholder = { Text("192.168.1.57:3001") },
            isError = error != null,
            supportingText = { Text(error ?: stringResource(R.string.settings_port_hint)) },
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Uri,
                imeAction = ImeAction.Done,
            ),
            keyboardActions = KeyboardActions(onDone = { save() }),
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 12.dp),
        )
        Text(
            text = stringResource(if (connected) R.string.settings_connected else R.string.settings_disconnected, current),
            style = MaterialTheme.typography.bodyMedium,
            color = if (connected) SignageColors.Success else MaterialTheme.colorScheme.onSurfaceVariant,
        )
        if (current != defaultAddress) {
            TextButton(onClick = onReset) { Text(stringResource(R.string.settings_reset, defaultAddress)) }
        }
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Surface(
            shape = RoundedCornerShape(28.dp),
            color = MaterialTheme.colorScheme.surfaceContainerHigh,
            modifier = Modifier
                .fillMaxWidth(0.92f)
                .fillMaxHeight(0.9f),
        ) {
            Column(modifier = Modifier.padding(24.dp)) {
                Text(stringResource(R.string.settings_title), style = MaterialTheme.typography.headlineSmall)
                BoxWithConstraints(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth()
                        .padding(vertical = 12.dp),
                ) {
                    if (maxWidth >= 600.dp) {
                        Row(horizontalArrangement = Arrangement.spacedBy(24.dp)) {
                            Column(
                                modifier = Modifier
                                    .weight(1f)
                                    .verticalScroll(rememberScrollState()),
                            ) { server() }
                            Column(
                                modifier = Modifier
                                    .weight(1f)
                                    .verticalScroll(rememberScrollState()),
                            ) { KioskSection() }
                        }
                    } else {
                        Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                            server()
                            HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp))
                            KioskSection()
                        }
                    }
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                ) {
                    TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) }
                    Button(onClick = { save() }, modifier = Modifier.padding(start = 8.dp)) {
                        Text(stringResource(R.string.save_connect))
                    }
                }
            }
        }
    }
}

/** Kiosk: açılışta otomatik başlama ve launcher olarak kullanma (cihazda saklanır). */
@Composable
private fun KioskSection() {
    val context = LocalContext.current
    var autoStart by remember { mutableStateOf(Kiosk.isAutoStart(context)) }
    var home by remember { mutableStateOf(Kiosk.isHomeLauncher(context)) }
    // İzin ayar ekranından dönünce tekrar kontrol edilir (diyalog yeniden açılınca).
    val canBackground = remember { Kiosk.canStartFromBackground(context) }

    Text(stringResource(R.string.kiosk).uppercase(), style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    SettingSwitch(
        title = stringResource(R.string.kiosk_autostart),
        checked = autoStart,
        onChange = {
            autoStart = it
            Kiosk.setAutoStart(context, it)
        },
    )
    if (autoStart && !canBackground) {
        Text(
            stringResource(R.string.kiosk_overlay_hint),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        TextButton(onClick = { context.startActivity(Kiosk.overlayPermissionIntent(context)) }) {
            Text(stringResource(R.string.kiosk_grant))
        }
    }
    SettingSwitch(
        title = stringResource(R.string.kiosk_home),
        checked = home,
        onChange = {
            home = it
            Kiosk.setHomeLauncher(context, it)
            if (it) runCatching { context.startActivity(Kiosk.homeSettingsIntent()) }
        },
    )
    if (home) {
        Text(
            stringResource(R.string.kiosk_home_hint),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun SettingSwitch(title: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(title, color = MaterialTheme.colorScheme.onSurface, modifier = Modifier.weight(1f))
        Switch(checked = checked, onCheckedChange = onChange)
    }
}
