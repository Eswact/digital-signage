package com.eswact.signage.ui.templates

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.eswact.signage.R
import com.eswact.signage.ui.QrCode
import com.eswact.signage.ui.theme.SignageColors

/**
 * Shown while the device is not paired / has no screen: the brand, the Device ID in large type, what to do
 * about it, and a QR code that opens the panel's pairing form with the code filled in. The
 * settings button is reachable with a TV remote's D-pad too.
 */
@Composable
fun PairingScreen(
    deviceId: String,
    online: Boolean,
    serverAddress: String,
    pairingUrl: String?,
    onOpenSettings: () -> Unit,
) {
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { runCatching { focus.requestFocus() } }

    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .background(SignageColors.Ink)
            .padding(horizontal = 40.dp, vertical = 28.dp),
        contentAlignment = Alignment.Center,
    ) {
        val wide = maxWidth > maxHeight
        val compact = maxHeight < 420.dp
        val codeSize = when {
            compact -> 44.sp
            wide -> 72.sp
            else -> 56.sp
        }

        val info: @Composable () -> Unit = {
            Column(
                modifier = Modifier.widthIn(max = 560.dp),
                horizontalAlignment = Alignment.Start,
            ) {
                Row(
                    modifier = Modifier.padding(bottom = if (compact) 10.dp else 28.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Image(
                        painter = painterResource(R.drawable.brand_mark),
                        contentDescription = null,
                        modifier = Modifier.size(if (compact) 24.dp else 32.dp),
                    )
                    Text(
                        stringResource(R.string.app_name),
                        color = SignageColors.Text,
                        fontSize = if (compact) 16.sp else 19.sp,
                        fontWeight = FontWeight.SemiBold,
                        letterSpacing = (-0.4).sp,
                        modifier = Modifier.padding(start = 10.dp),
                    )
                }
                Text(
                    stringResource(R.string.pairing_label),
                    color = SignageColors.Muted,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 2.sp,
                )
                Text(
                    text = deviceId,
                    color = SignageColors.Text,
                    fontSize = codeSize,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    letterSpacing = 4.sp,
                    modifier = Modifier.padding(top = 6.dp, bottom = if (compact) 12.dp else 18.dp),
                )
                Box(Modifier.fillMaxWidthLine())
                Text(
                    stringResource(R.string.pairing_title),
                    color = SignageColors.Text,
                    fontSize = if (compact) 18.sp else 22.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(top = if (compact) 12.dp else 18.dp, bottom = 8.dp),
                )
                Step(1, stringResource(R.string.pairing_step1), compact)
                Step(2, stringResource(R.string.pairing_step2), compact)

                Row(
                    modifier = Modifier.padding(top = 18.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        Modifier
                            .size(9.dp)
                            .clip(CircleShape)
                            .background(if (online) SignageColors.Success else SignageColors.Line),
                    )
                    Text(
                        text = stringResource(if (online) R.string.status_connected else R.string.status_connecting),
                        color = if (online) SignageColors.Success else SignageColors.Muted,
                        fontSize = 14.sp,
                        modifier = Modifier.padding(start = 8.dp),
                    )
                    Text(
                        text = "  ·  " + stringResource(R.string.server_line, serverAddress),
                        color = SignageColors.Muted,
                        fontSize = 13.sp,
                        fontFamily = FontFamily.Monospace,
                    )
                }
                OutlinedButton(
                    onClick = onOpenSettings,
                    shape = RoundedCornerShape(4.dp),
                    modifier = Modifier
                        .padding(top = 14.dp)
                        .focusRequester(focus),
                ) {
                    Text(stringResource(R.string.open_settings), color = SignageColors.Text)
                }
            }
        }

        val qr: @Composable () -> Unit = {
            if (pairingUrl != null) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(
                        Modifier
                            .clip(RoundedCornerShape(4.dp))
                            .background(Color.White)
                            .padding(10.dp),
                    ) { QrCode(pairingUrl, size = if (compact) 130.dp else 190.dp) }
                    Text(
                        stringResource(R.string.scan_to_pair),
                        color = SignageColors.Muted,
                        fontSize = 13.sp,
                        modifier = Modifier.padding(top = 10.dp),
                    )
                }
            }
        }

        if (wide) {
            // Scrolls only when it does not fit (phones in landscape); the D-pad focus brings the settings button into view.
            Row(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(64.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) { info(); qr() }
        } else {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(28.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) { info(); qr() }
        }
    }
}

/** Hairline rule (1 dp) in the panel's line color. */
private fun Modifier.fillMaxWidthLine(): Modifier =
    this.then(Modifier.fillMaxWidth().height(1.dp).background(SignageColors.Line))

@Composable
private fun Step(number: Int, text: String, compact: Boolean) {
    Row(modifier = Modifier.padding(top = 6.dp), verticalAlignment = Alignment.Top) {
        Box(
            modifier = Modifier
                .size(22.dp)
                .border(1.dp, SignageColors.Line, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Text("$number", color = SignageColors.Muted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        }
        Spacer(Modifier.size(12.dp))
        Text(text, color = SignageColors.Muted, fontSize = if (compact) 14.sp else 16.sp)
    }
}

@Composable
fun UnsupportedTemplate(type: String) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(SignageColors.Ink),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = stringResource(R.string.unsupported_template, type),
            color = SignageColors.Text,
            fontSize = 24.sp,
        )
        Text(
            text = stringResource(R.string.update_app),
            color = SignageColors.Muted,
            fontSize = 18.sp,
            modifier = Modifier.padding(top = 8.dp),
        )
    }
}
