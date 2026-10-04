# Signage — Android

Kotlin + Jetpack Compose + Hilt + OkHttp WebSocket. Cihaz açılır, benzersiz
Device ID üretir, ekranda gösterir; panelden eşleştirilip ekran atanınca
WebSocket üzerinden gelen JSON'u `TemplateRegistry` ile render eder.

## Akış

1. `DeviceIdProvider` → benzersiz 8 haneli kod üretir/saklar (SharedPreferences)
2. `SignageApi.registerDevice` → cihazı backend'e kaydeder (açılışta bir kez)
3. `SignageSocket` → `ws://.../ws?deviceId=...` bağlantısı, PING/PONG, reconnect
4. `MainViewModel` → `StateFlow<UiState>` (deviceId + bağlantı + ekran; `live ?: cached`)
5. `SignageRoot` → ekran yoksa Device ID gösterir, varsa şablonu render eder; yönü ekranın `orientation`'ına göre ayarlar
6. `TemplateRegistry` → `info-board` · `order-board` · `queue-number` (eski `announcement` önbelleği `info-board` ile çizilir)
7. `ui/design/` → tema paleti, gömülü fontlar (`assets/fonts`, OFL lisansları `assets/font-licenses`; kalınlık başına ayrı Typeface), öğe stilleri ve göreli birim (`ScreenCanvas`, kısa kenar = 1080) — panel `lib/design.ts` ile aynı değerler

## Güvenilirlik

- Exponential backoff reconnect (1s → 30s), 45s sessizlikte watchdog yeniden bağlanır
- `SCREEN_PATCH` → `JsonPatch` (RFC 6902) ile uygulanır; base uyuşmazsa `REQUEST_SCREEN`
- Son ekran Room'a kaydedilir (`ScreenCache`); `SCREEN_CLEAR` gelince cache silinir
- Kimlik: Device ID + sunucunun ilk kayıtta verdiği gizli anahtar (`DeviceIdProvider`),
  WS'te `X-Device-Secret` başlığı ve `proto` sürümü; kayıtta APK sürümü ve
  `TemplateRegistry.manifest` bildirilir

## Kiosk ve Android TV

- Ekran hep açık, sistem çubukları gizli (`MainActivity`)
- Ayarlar (eşleştirme ekranındaki buton, uzun basma ya da kumandada Menü/OK):
  açılışta otomatik başlat (`kiosk/BootReceiver`), launcher olarak kullan
  (`HomeLauncher` takma adı). Android 10+ arka plandan başlatma için "diğer
  uygulamaların üzerinde göster" izni gerekir (ayarlarda buton var)
- Çökünce yeniden başlar (2 dakikada 3 çökmeden sonra durur — döngü olmasın)
- Android TV: `LEANBACK_LAUNCHER` + `drawable-xhdpi/tv_banner.png`
- Eşleştirme ekranında QR: panelde eşleştirme formunu kod dolu açar

## Derleme

- Cleartext (http/ws) yalnızca debug build'de; release https/wss ister
- Sentry: `./gradlew assembleRelease -PSENTRY_DSN=…` (verilmezse kapalı)
- Tema/öğe değerleri `ui/design/DesignTokens.kt` üretilir — elle değiştirme,
  `shared/design-tokens.json` + `node scripts/gen-design-tokens.mjs`

## Çalıştırma

Android Studio (2024.1+) ile `android/` klasörünü aç. Gradle için **JDK 17–21**
gerekir. Komut satırından: `./gradlew installDebug` (wrapper repoda yoksa
Android Studio ilk sync'te oluşturur).

Sunucu adresi uygulama içinden girilir: eşleştirme ekranında **Sunucu ayarı**
butonu, ekran gösterilirken ekrana uzun basma. Adres cihazda saklanır
(`ServerConfig`); kaydedilince hemen yeniden bağlanır. `app/build.gradle.kts` →
`API_URL` yalnızca ilk kurulum varsayılanıdır (emülatörde `10.0.2.2`). Soket her
bağlantı denemesinden önce cihazı kaydeder (`/devices/register`, idempotent).

## Yol haritası

Bkz. [../TODO.md](../TODO.md). OTA güncelleme gibi kalan ürünleşme eksikleri için
[../docs/2026-10-04-urunlesme-ve-rakip-analizi.md](../docs/2026-10-04-urunlesme-ve-rakip-analizi.md).
