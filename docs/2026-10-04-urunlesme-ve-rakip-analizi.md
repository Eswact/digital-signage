# Ürünleşme ve Rakip Analizi

**Tarih:** 2026-10-04
**Kapsam:** Kod tabanının tamamı (`4771c57` + çalışma ağacı), [TODO.md](../TODO.md) yol haritası ve 2026 pazar araştırması
**Amaç:** Projenin ürün olarak satılmasının önündeki engelleri listelemek, benzer ürünlerle karşılaştırmak, öne çıkabileceği ve geride kalabileceği alanları belirlemek.

> Fiyatlar ve rakip özellikleri 2026 yılı web kaynaklarından alındı (bkz. [Kaynaklar](#10-kaynaklar)). Bunlar sık değişir; satış/fiyat kararı vermeden önce yeniden doğrulanmalı.
>
> **Kod bulguları `4771c57` commit'ine göre yazıldı.** İnceleme sırasında çalışma ağacında TODO Faz 1 üzerine devam eden, henüz commit'lenmemiş değişiklikler vardı: `announcement` şablonunun `info-board`'a birleştirilmesi, `orientation: 'auto'`, `PATCH`'te `merge`, ekran bazında kilit (`ScreensService.withLock`/`mutateData`) ve özel fontlar. Bu çalışma tamamlandığında 17. madde (ingest eşzamanlılığı) ve 20. madde (şablon listesi) kısmen ya da tamamen geçersiz olabilir.
>
> **TODO.md bu analizden sonra yeniden düzenlendi.** Aşağıdaki faz numaraları TODO'nun eski sürümüne göredir. Eski → yeni eşleme: önerilen "Faz 0" → **Faz 2** (kritik düzeltmeler ve güvenlik) + **Faz 3** (saha kurulumu) · eski Faz 2 (medya) → **Faz 5** · eski Faz 3 (panel) → **Faz 6** · eski Faz 4 (ölçekleme) → **Faz 7** · eski Faz 5 dağıtıldı (QR, `min_app_version`, manifesto → Faz 3; zamanlama, webview → Faz 5; webhook, harici API → Faz 8) · yeni: **Faz 4** (organizasyon/ekip), **Faz 8** (ticari altyapı ve entegrasyonlar).

---

## 0. Özet

**Bugünkü durum.** Proje, *gerçek zamanlı operasyonel ekranlar* için sağlam ve çalışan bir prototip. Panelden ya da POS'tan gelen değişiklik WebSocket ve JSON Patch üzerinden 1 saniyenin altında cihaza ulaşıyor. Cihaz bağlantı kesildiğinde son ekranı göstermeye devam ediyor. Hesaplar birbirinden izole. Ancak bugünkü haliyle **genel amaçlı bir "dijital signage" ürünü değil**: medya, oynatma listesi, zamanlama ve kiosk özellikleri yok. Bunun yanında güvenlik ve dağıtım tarafında satışı doğrudan engelleyen açıklar var.

**Ürün olmanın önündeki en büyük 6 engel:**
1. **WebSocket kimlik doğrulaması yok.** Device ID'yi bilen herkes cihazın kanalına bağlanabiliyor, ekran verisini okuyabiliyor ve gerçek cihazın bağlantısını devre dışı bırakabiliyor.
2. **Gateway'de bağlantı yarışı hatası var.** Wi-Fi kopup geri geldiğinde cihaz "bağlı" göründüğü halde güncelleme almayabiliyor (ayrıntı §2.1-2).
3. **Üretimde veritabanı kurulmuyor.** `NODE_ENV=production` olunca `synchronize` kapanıyor ama migration yok. Yedekleme ve dağıtım (deploy) için de bir yöntem yok.
4. **Sunucu adresi APK'ya gömülü.** `API_URL`/`WS_URL` derleme anında LAN IP'si olarak yazılıyor ve bağlantı şifresiz (HTTP/WS). Her müşteri için APK'nın yeniden derlenmesi gerekiyor.
5. **Kiosk temelleri eksik.** Açılışta otomatik başlama, ekranı açık tutma, tam ekran, Android TV launcher desteği ve uzaktan (OTA) güncelleme yok.
6. **"Hesap = tek kullanıcı".** Bir işletmenin birden çok çalışanla aynı hesabı yönetebileceği bir organizasyon/ekip modeli, faturalama ve plan limitleri yok.

**Öne çıkabileceği 3 alan:**
- **Gerçek zamanlı veri.** Değişiklik 1 saniyenin altında ekrana ulaşıyor. Rakiplerin veri uygulamaları (ör. Google Sheets) yaklaşık 5 dakikada bir yenileniyor.
- **POS'a doğrudan bağlanabilen sipariş ve sıra ekranları.** Ingest API ile ekran bazında anahtar veriliyor, sütunlar dinamik.
- **Hafif, ucuz donanımda çalışan ve kendi sunucusunda kurulabilen mimari.** Sadece JSON taşınıyor, cihazda native Compose çalışıyor, sunucu SQLite ile tek süreç. Bu, KVKK açısından da avantaj sağlıyor.

**Önerilen konumlandırma.** Önce Türkiye'deki kafe/QSR (hızlı servis restoranı) ve sıra yönetimi pazarına girilmeli: *"POS'unuza bağlanan, saniyesinde güncellenen sipariş hazır ve sıra ekranı."* Genel signage için temel özellikler (medya, zamanlama) TODO Faz 2 ve Faz 5 ile sonradan eklenmeli. Bunlardan önce bir **"Faz 0 — Ürünleşme temeli"** (güvenlik, dağıtım, kiosk) eklenmesi öneriliyor (§8).

---

## 1. Mevcut durum (kod incelemesi)

| Alan | Durum | Olgunluk |
|---|---|---|
| Cihaz eşleştirme (8 haneli Device ID → `POST /devices/pair`) | Çalışıyor; başka hesaptaki cihaz kapılamıyor | İyi |
| Hesap izolasyonu (`superadmin` / `user`, `listForViewer`) | Cihaz/ekran/grup servislerinde tutarlı | İyi |
| Gerçek zaman (event bus → Gateway → ham WS) | `SCREEN_UPDATE/PATCH/ASSIGN/CLEAR`, `REQUEST_SCREEN` geri dönüşü | İyi, ama §2.1'deki hatalar var |
| Delta senkron (fast-json-patch ↔ Kotlin `JsonPatch`) | `base updatedAt` kontrolü ile | İyi |
| Offline (Room `ScreenCache`, `live ?: cached`) | Son ekran gösteriliyor | İyi |
| Şablonlar | 4 adet: announcement, order-board, queue-number, info-board | Prototip, özelleştirme sınırlı |
| Ingest API (POS push) | Sipariş ekleme/güncelleme/silme/değiştirme ve durum sorgulama | İyi; eşzamanlılık sorunu var (§2.2) |
| Gruplar | Gruba tek seferde ekran atama | Temel |
| Panel | Next.js; cihaz/ekran/grup/kullanıcı sayfaları; önizleme | İşlevsel; tasarım zayıf (TODO Faz 3) |
| Test / CI / lint | **Yok.** Backend `lint` script'i var ama eslint bağımlılığı ve yapılandırması yok | Yok |
| Dağıtım (deploy) | Sadece `npm run start:dev`; Dockerfile, servis tanımı ve reverse proxy örneği yok | Yok |

Backend ve panelde `tsc --noEmit` hatasız geçiyor (Node 22).

---

## 2. Ürün olmanın önündeki engeller

Şiddet: 🔴 Satışı/güvenliği engeller · 🟠 İlk müşteriden önce çözülmeli · 🟡 Büyürken gerekli

### 2.1 Güvenlik ve güvenilirlik (kod düzeyinde)

| # | Şiddet | Bulgu | Konum |
|---|---|---|---|
| 1 | 🔴 | **WS bağlantısı kimlik doğrulamasız.** `ws?deviceId=XXX` ile bağlanan herkes, o cihaza atanmış ekranın tam verisini alır. Ayrıca `clients.set` gerçek cihazın soketini ezdiği için gerçek cihaz güncelleme almaz hale gelir. Device ID pairing ekranında açıkça yazıyor. **Çözüm:** Kayıt sırasında cihaza özel bir gizli anahtar (device secret) üretilip yalnızca cihaza verilmeli, WS el sıkışmasında bu anahtar doğrulanmalı. | `backend/src/realtime/realtime.gateway.ts:71` |
| 2 | 🔴 | **Yeniden bağlanma yarışı.** `handleDisconnect` hangi soketin kapandığına bakmadan `clients.delete(deviceId)` çağırıyor. Cihaz yeni soketle bağlandıktan sonra eski soketin `close` olayı gelirse (Wi-Fi kopmalarında olası) yeni soket de haritadan silinir ve cihaz `offline` işaretlenir. Android kendi PING'ine PONG aldığı için yeniden bağlanmaz ve **sessizce güncelleme almadan kalır**. **Çözüm:** Silmeden önce `clients.get(id) === socket` kontrolü yapılmalı, yeni bağlantı gelince eski soket kapatılmalı. *(Kod okunarak tespit edildi, canlı olarak yeniden üretilmedi.)* | `realtime.gateway.ts:86-87` |
| 3 | 🔴 | **Üretimde şema kurulmuyor.** `synchronize` yalnızca production dışında açık ve migration dosyası yok. `NODE_ENV=production` ile ilk açılışta tablolar oluşmuyor; sonraki şema değişiklikleri de uygulanmıyor. | `backend/src/app.module.ts:25` |
| 4 | 🔴 | **Şifresiz trafik ve gömülü adres.** `usesCleartextTraffic="true"`, `http://` ve `ws://` kullanılıyor; adres derleme anında LAN IP'si olarak sabitleniyor. Bunun yerine çalışma anında sunucu ayarı (QR veya provisioning kodu) ve `https://` / `wss://` gerekiyor. | `android/app/build.gradle.kts:24-25`, `AndroidManifest.xml:13` |
| 5 | 🟠 | **Varsayılan gizli anahtarlar.** `JWT_SECRET` tanımlı değilse `'dev-secret'` kullanılıyor; `.env.example` içinde `admin123` var. Production'da bu değerler yoksa uygulama açılmayı reddetmeli. | `backend/src/auth/auth.module.ts:18`, `jwt.strategy.ts:23` |
| 6 | 🟠 | **Cihaz kendini yeniden kaydetmiyor.** `registerDevice` yalnızca uygulama açılışında bir kez çağrılıyor. İlk açılışta sunucuya ulaşılamazsa ya da cihaz panelden silinirse WS `4004` ile reddediliyor ve cihaz uygulama yeniden başlatılana kadar sonsuz yeniden bağlanma döngüsünde kalıyor. Cihaz silinince SCREEN_CLEAR da gönderilmiyor. | `MainViewModel.kt:77`, `devices.service.ts:138` |
| 7 | 🟠 | **Ekran silinince cihazlara haber verilmiyor.** `onDelete: SET NULL` ile atama sessizce boşalıyor; cihaz yeniden bağlanana kadar silinmiş ekranı göstermeye devam ediyor. | `backend/src/screens/screens.service.ts:85` |
| 8 | 🟠 | **API anahtarları düz metin.** Anahtarlar veritabanında açık saklanıyor ve panelde tam haliyle listeleniyor. Hash'lenerek saklanmalı, yalnızca oluşturulduğu anda bir kez gösterilmeli. | `backend/src/ingest/api-keys.service.ts:62` |
| 9 | 🟠 | **Git'te gizli bilgi ve yerel dosyalar.** `scripts/fake-pos-ingest.mjs` içinde sabit bir `sk_...` anahtarı var ve script argüman/env'i okumuyor (README'deki `<API_KEY>` kullanımı çalışmıyor). `.claude/settings.local.json` `.gitignore`'da olduğu halde takip ediliyor. | `scripts/fake-pos-ingest.mjs:14` |
| 10 | 🟡 | **Panel oturumu.** JWT `localStorage`'da, süre 7 gün; yenileme ve iptal yok. 2FA yok, e-posta ile parola sıfırlama yok. Login sayfası kayıt kapalı olduğu halde "Kayıt ol" seçeneği gösteriyor. | `panel/app/login/page.tsx:99` |
| 11 | 🟡 | **Rate limit ve güvenlik başlıkları yok.** `/auth/login` ve `/ingest/*` kaba kuvvet ve taşkın saldırılarına açık. `@nestjs/throttler` ve helmet eklenmeli. | `backend/src/main.ts` |

### 2.2 Ürün ve mimari eksikleri

| # | Şiddet | Eksik | Not |
|---|---|---|---|
| 12 | 🔴 | **Kiosk modu yok.** `BOOT_COMPLETED` ile otomatik başlama, `KEEP_SCREEN_ON`, tam ekran (immersive), çökünce yeniden başlama ve `LEANBACK_LAUNCHER` + banner (Android TV) eksik. | Signage cihazının en temel beklentisi. Android TV/Fire TV kutuları pazarın ana donanımı. |
| 13 | 🔴 | **Organizasyon/ekip modeli yok.** Her `user` ayrı bir izole hesap. Bir işletmenin 3 çalışanı aynı ekranları birlikte yönetemiyor. TODO'daki açık soru ("multi-tenant gerekecek mi?") için cevap: **evet**. Organization → Members (owner/editor/viewer) yapısı gerekli. | Faturalama, limitler ve white-label bu yapının üzerine kurulur. |
| 14 | 🔴 | **Dağıtım ve operasyon yok.** Dockerfile, servis tanımı (systemd/pm2), Nginx/Caddy + TLS örneği, SQLite yedekleme, log toplama ve uptime izleme eksik. | Docker'ın geliştirme için kaldırılması doğru bir karardı; ama üretim için bir paket gerekiyor. |
| 15 | 🟠 | **Uzaktan güncelleme (OTA) ve sürüm yönetimi yok.** WS mesajlarında protokol/uygulama sürümü bulunmuyor. Yeni bir şablon eklenince eski APK'lar "UnsupportedTemplate" gösterir. | TODO Faz 5'teki `min_app_version` maddesi, sahaya ilk cihaz kurulmadan önce yapılmalı. |
| 16 | 🟠 | **Filo yönetimi zayıf.** Uzaktan ekran görüntüsü, yeniden başlatma, "cihaz offline oldu" bildirimi (e-posta/Telegram), cihaz bilgisi (model, Android/APK sürümü, depolama) ve proof-of-play (gösterim kaydı) yok. | Rakiplerin hepsinde temel özellik olarak sunuluyor. |
| 17 | 🟠 | **Ingest'te veri kaybı riski.** Okuma, değiştirme ve kaydetme kilitsiz yapılıyor. Aynı ekrana gelen eşzamanlı iki POS isteğinden biri diğerinin değişikliğini ezebilir. Ekran bazında sıralı kuyruk (mutex) ya da transaction gerekli. **Devam eden çalışmada `withLock` ile ele alınıyor.** | `backend/src/ingest/ingest.service.ts:56-` |
| 18 | 🟠 | **Hiç otomatik test yok.** Ne birim testi, ne e2e (pairing → assign → patch), ne Android testi, ne de CI var. | Gerçek zaman protokolündeki gerilemeler (regression) ancak elle testte fark ediliyor. |
| 19 | 🟡 | **Panel canlı değil.** Cihaz listesi 5 sn'de, order-board editörü 2,5 sn'de bir sorgulanıyor (polling). | Panel için bir SSE/WS kanalı açılırsa hem yük azalır hem panelde de "canlı" hissi oluşur. |
| 20 | 🟡 | **Şablon tanımı 5 yerde tekrar ediyor.** `TemplateType`, DTO listesi, `template.types.ts`, `panel/lib/api.ts`, Android `TemplateRegistry`. Ayrıca önizleme (React) ve gerçek render (Compose) iki ayrı kod. | CLAUDE.md'deki "tek satır kayıt" yalnızca Android tarafı için doğru. TODO'daki "önizlemede tıklayıp düzenleme" özelliği bu ikiliği büyütecek (§7). |
| 21 | 🟡 | **Order-board taşınca içerik görünmüyor.** Sipariş sayısı ekrana sığmayınca `verticalScroll` kullanılıyor; ama başında kimse olmayan bir ekranda kaydırma yapılamıyor. Otomatik sayfalama ya da küçültme gerekli. | `OrderBoardTemplate.kt:200` |
| 22 | 🟡 | **i18n yok.** Tüm arayüz ve sunucu mesajları Türkçe ve kodun içine yazılı. | Yurt dışı satış düşünülüyorsa erkenden altyapı kurulmalı. |
| 23 | 🟡 | **Ticari altyapı yok.** Abonelik ve ödeme (iyzico/PayTR/Stripe), e-fatura, plan limitleri, deneme süresi, KVKK aydınlatma metni, kullanım koşulları, SLA, tanıtım sitesi, dokümantasyon ve destek kanalı eksik. | Ürünün kod dışındaki kısmı tamamen boş. |

### 2.3 Küçük temizlikler (hızlı kazanımlar)

- Kökteki `.env.example` hâlâ Postgres/Redis değişkenleri içeriyor; `docker-compose.yml` silindiği için bu dosya artık geçersiz.
- `panel/components/editors/AnnouncementEditor.tsx` hiçbir yerde kullanılmıyor (yerini `SchemaFormEditor` aldı).
- Eskimiş yorumlar: `realtime/messages.ts` ("Redis pub/sub kanalı"), `screens/screen.entity.ts` ("Faz 1'de yalnızca announcement").
- `main.ts` WS adresini `/ws` yolu olmadan logluyor.
- `ApiKeysService.assertScreenOwned` sadece `userId` kontrol ediyor. Superadmin başka hesabın ekranında anahtar yönetemiyor; diğer servislerdeki `viewer` modeliyle tutarsız.

---

## 3. Rakip haritası

### 3.1 Segmentler

| Segment | Ürünler | Fiyat (2026) | Not |
|---|---|---|---|
| **Genel amaçlı bulut signage** | Yodeck | 1 ekran ücretsiz; $8 / $12 / $16 ekran/ay | 500+ hazır layout, 70+ uygulama, zamanlama; Premium'da gösterim raporu, Enterprise'da SSO ve özel roller |
| | OptiSigns | 3 ekran ücretsiz (logolu); $10 / $15 / $30 ekran/ay | Çok bölgeli layout, 100+ uygulama, dokunmatik etkileşim |
| | ScreenCloud | Ücretsiz katman yok; $20 / $30 ekran/ay | Kurumsal iletişime odaklı |
| | Rise Vision, NoviSign, DigitalSignage.com, ChannelOS | $3 – $14 ekran/ay | Hemen hepsinin Android oynatıcısı var |
| **Açık kaynak / kendi sunucunda** | Xibo | Kendi sunucunda ücretsiz; bulut ~$4,90 ekran/ay | DataSets + API, Data Connector ile gerçek zamanlı veri, zamanlama, proof-of-play |
| | Anthias (Screenly OSE) | Ücretsiz | Raspberry Pi; resim/video/web; ekran başı ücret yok |
| | piSignage | ~$1,67 ekran/ay | Raspberry Pi |
| **Dikey: sipariş hazır ekranı** | Fresh KDS Order Tracker | KDS Premium ($20/ekran/ay) ya da Unlimited ($89/lokasyon/ay) gerekiyor | Fire TV Stick üzerinde çalışıyor; "Hazırlanıyor / Hazır" iki sabit sütun, logo ve renk ayarı; **yalnızca kendi KDS'iyle** çalışıyor |
| | Square KDS, Toast KDS | $20 – $35/ay | POS ekosistemine bağlı |
| **Dikey: sıra yönetimi** | Qminder | $429 – $1.149/ay (kullanıcı bazlı) | Kiosk ile kayıt + TV ekranı + SMS; API/webhook yalnızca Premium'da |
| | Yerel sıramatik donanımları | ~8.500 – 78.000 TL (tek seferlik donanım) | Kapalı sistemler; yazılım esnekliği düşük |
| **Türkiye yerel** | Menulux (POS + dijital menuboard) | 125 – 250 TL ekran/ay | Şablon, logo/renk, saat bazlı planlama, slayt, çoklu şube, dikey/yatay; **POS ile birlikte satılıyor** |
| | KoçSistem Pixage | Kurumsal teklif | Sürükle-bırak tasarım, 100+ widget, akıllı playlist, ekran sağlık izleme, açılış/kapanış saatleri; 20.000+ ekran |
| | Adisyo, SambaPOS | — | Rakipten çok **entegrasyon ortağı**. Yemeksepeti/Getir/Trendyol siparişleri bu POS'lara düşüyor. |

### 3.2 2026'da temel beklenti sayılan özellikler (table stakes)

Rakip kontrol listelerine göre artık her alıcının varsaydığı özellikler: bulut yönetim, **zamanlama**, çoklu medya formatı, **offline oynatma**, **cihaz izleme ve offline uyarısı**, uzaktan yeniden başlatma ve acil mesaj, **proof-of-play** ve **uzaktan ekran görüntüsü**. Kurumsal tarafta SSO/SAML, denetim kaydı (audit log) ve çalışma alanı hiyerarşisi bekleniyor. Bu projede bunlardan yalnızca offline oynatma ve temel cihaz durumu var.

---

## 4. Özellik matrisi

✅ var · ⚠️ kısmi · ❌ yok · 📋 TODO'da planlı

| Özellik | Bu proje (bugün) | Bu proje (TODO sonrası) | Genel SaaS (Yodeck/OptiSigns) | Xibo / Anthias | Fresh Order Tracker / Qminder |
|---|---|---|---|---|---|
| Gerçek zamanlı veri itme (<1 sn) | ✅ | ✅ | ❌ (veri uygulamaları ~5 dk) | ⚠️ (Xibo Data Connector) | ✅ (kendi sistemi içinde) |
| POS'tan bağımsız ingest API | ✅ | ✅ | ⚠️ (genel veri kaynakları) | ⚠️ (Xibo API) | ❌ / ⚠️ (Qminder Premium) |
| Dinamik sütunlu sipariş panosu | ✅ | ✅ | ❌ | ❌ | ⚠️ (2 sabit sütun) |
| Sıra numarası ekranı | ⚠️ (yalnızca manuel) | ✅ 📋 (API + sıradakiler listesi) | ⚠️ | ❌ | ✅ |
| Resim / video / slayt | ❌ | 📋 Faz 2 | ✅ | ✅ | ❌ |
| Zamanlama / dayparting | ❌ | 📋 Faz 5 | ✅ | ✅ | — |
| Çok bölgeli layout, sürükle-bırak | ❌ | ⚠️ 📋 (tıkla-düzenle, banner/rozet) | ✅ | ✅ (Xibo) | ❌ |
| Hazır şablon / uygulama kütüphanesi | ⚠️ (4 şablon) | ⚠️ 📋 (hava durumu, döviz, webview) | ✅ (70 – 500+) | ⚠️ | ❌ |
| Offline son içerik | ✅ | ✅ (medya önbelleği gerekecek) | ✅ | ✅ | ⚠️ |
| Cihaz online/offline durumu | ✅ | ✅ | ✅ | ✅ | ✅ |
| Offline uyarısı, ekran görüntüsü, uzaktan reboot | ❌ | ❌ | ✅ | ⚠️ | ⚠️ |
| Proof-of-play | ❌ | ❌ | ✅ (Premium) | ✅ (Xibo) | — |
| Kiosk, otomatik başlama, OTA | ❌ | ❌ | ✅ | ✅ | ✅ |
| Oynatıcı platformları | Android (telefon/tablet) | Android | Android, Android TV, Windows, RPi, Fire TV… | RPi, Android, Windows… | Fire TV / iPad |
| Ekip, roller, SSO | ⚠️ (2 rol, ekip yok) | ⚠️ | ✅ (Enterprise) | ✅ | ✅ |
| Kendi sunucunda kurulum (on-prem) | ✅ (tek süreç + SQLite) | ✅ | ❌ | ✅ | ❌ |
| Türkçe arayüz ve yerel destek | ✅ | ✅ | ⚠️ | ⚠️ | ❌ |
| Bant genişliği / donanım ihtiyacı | Çok düşük | Medya ile artar | Orta – yüksek | Orta | Düşük |

---

## 5. Öne çıkabileceği alanlar

1. **Gerçek zamanlı veri ve delta senkronizasyon.** WS + JSON Patch ile değişiklik 1 saniyenin altında ekrana ulaşıyor. Yodeck ve OptiSigns'ın Google Sheets entegrasyonu yaklaşık 5 dakikada bir güncelleniyor; OptiSigns'ta zorunlu senkron aralığı en az 1 saat. Sipariş hazır ve sıra ekranında 5 dakika gecikme kabul edilemez. Bu fark tam da bu kullanım senaryolarında önemli.
2. **Hangi POS kullanılırsa kullanılsın bağlanabiliyor.** Fresh KDS'in sipariş takip ekranı yalnızca kendi KDS'iyle, Menulux'un menuboard'u yalnızca kendi POS'uyla birlikte satılıyor. Bu projenin ingest API'si (ekran bazında anahtar, ayrı ayrı sipariş uçları, idempotent `PUT`) herhangi bir POS'a bağlanabiliyor. Türkiye'de Adisyo ve SambaPOS gibi yaygın POS'lar ve Yemeksepeti/Getir/Trendyol için **hazır bağlayıcılar** eklenirse güçlü bir rekabet avantajı olur.
3. **Esnek akış.** Order-board sütunları (Hazırlanıyor → Hazır → Teslim, İptal, Paket) JSON'dan geliyor ve kod değiştirmeden işletmeye göre uyarlanabiliyor. Rakiplerde genelde 2 sabit sütun var.
4. **Ucuz donanım ve düşük bant genişliği.** Sadece JSON taşınıyor ve native Compose render ediyor (WebView/Chromium yok). `minSdk 24` sayesinde düşük maliyetli Android TV kutuları ve eski tabletler kullanılabiliyor. Zayıf Wi-Fi'da ya da mobil veriyle de çalışabiliyor.
5. **Kendi sunucunda kurulum ve KVKK.** Tek süreç + tek SQLite dosyası sayesinde kurum içinde (hastane, kamu, banka şubesi sıra ekranları) kurulum çok kolay. Veri Türkiye'de kalıyor. Bulut SaaS rakiplerin çoğu bunu sunmuyor; Xibo sunuyor ama kurulumu ağır.
6. **Fiyat konumu.** Rakipler ekran başına $8 – $30 (ScreenCloud $20+) alıyor; Fresh'in sipariş ekranı en az $20/ekran ve KDS aboneliği gerektiriyor. Yerel referans Menulux 125 – 250 TL/ekran/ay. Operasyonel ekranlar için **lokasyon bazlı paket** (ör. "1 şube: sipariş + sıra ekranı") Türkiye'de farklılaştırıcı olabilir.

## 6. Geride kalabileceği alanlar

1. **Temel signage özellikleri.** Medya, oynatma listesi ve zamanlama olmadan alıcı bunu "dijital signage" olarak görmez; karşılaştırma tablolarına bile giremez. TODO Faz 2 ve Faz 5 bu açığı kapatıyor, ama bugün en büyük eksik bu.
2. **İçerik zenginliği ve yayın hızı.** Rakiplerde 70 – 500+ hazır layout ve uygulama var, burada 4 şablon. Şablonlar APK içinde olduğu için her yeni şablon **APK yayını** gerektiriyor; web tabanlı oynatıcı kullanan rakipler yeni içeriği anında yayınlayabiliyor. → Çözüm önerisi §7'de.
3. **Platform desteği.** Yalnızca Android var ve Android TV launcher kaydı bile yok. Tizen/webOS (ticari ekranlar), Windows ve Raspberry Pi desteklenmiyor.
4. **Filo yönetimi.** Ekran görüntüsü, uyarı, OTA ve gösterim raporu yok. 10+ ekranlı müşteride bunlar olmadan destek maliyeti çok yükselir.
5. **Kurumsal gereksinimler.** SSO, denetim kaydı, çalışma alanları ve onay akışı yok. Pixage ve ScreenCloud bu segmentte çok önde.
6. **Marka güveni ve tasarım.** Panel tasarımı zayıf (kullanıcı da bunu TODO Faz 3'te belirtmiş). Tanıtım sitesi, referans ve dokümantasyon yok.

---

## 7. TODO.md üzerinden değerlendirme

| Faz | Hangi açığı kapatıyor | Yorum / öneri |
|---|---|---|
| **Faz 1 — Ekranlar ve özelleştirme** | §6-2 (içerik zenginliği), sıra ekranı API'si | Değeri yüksek; özellikle queue-number ingest, farklılaştırıcı alanla doğrudan örtüşüyor. **Strateji önerisi:** announcement + info-board birleştirmesini ve "ekranın istediği yerine metin koy, tıkla-düzenle" isteğini şablona tek tek ayar ekleyerek değil, **genel bir JSON layout motoru** olarak tasarlayın. Bu motor metin, liste, görsel, saat, QR ve banner/rozet gibi blokları JSON'daki konum ve stile göre çizer. Böylece yeni "şablonların" çoğu APK güncellemesi olmadan sunucudan tanımlanır (§6-2'deki dezavantaj kapanır) ve Faz 2'deki banner/rozet aynı motorun bloğu olur. Panel önizlemesi ile Compose arasındaki farkı yönetmek için ortak bir şema (JSON Schema/zod → Kotlin) ve ekran görüntüsü karşılaştırma testleri önerilir. "Uyumlu" yön seçeneği için `orientation: 'auto'` → `SCREEN_ORIENTATION_UNSPECIFIED` yeterli. |
| **Faz 2 — Medya, slayt, banner** | §6-1 (temel özellikler) | Temel beklenti. Dikkat: CLAUDE.md'deki **"büyük medya taşınmaz, sadece JSON"** prensibi değişiyor. Önerilen yeni prensip: *kontrol düzlemi JSON, medya ayrı ve önbellekli.* Gerekenler: depolama (yerel disk → S3/R2), cihazda önceden indirme + checksum + disk kotası (Media3/ExoPlayer, Coil), kullanıcı bazlı kota (TODO'daki süper yönetici ayarlar sayfası), video süre sınırı için sunucuda `ffprobe`. Offline garantisi medya önbelleğiyle birlikte düşünülmeli. |
| **Faz 3 — Panel yeniden tasarım** | §6-6 | Gerekli. Ancak §2.1'deki güvenlik işlerinden **sonra** yapılmalı. Tasarım yapılırken organizasyon/ekip modeli (§2.2-13) ve plan limitleri ekranları da hesaba katılmalı; sonradan eklemek yeniden tasarım gerektirir. Login'deki "kayıt ol" seçeneği, davet ile katılma ve deneme hesabı akışına göre yeniden düşünülmeli. |
| **Faz 4 — Ölçekleme ve izleme** | §2.2-14, §2.2-16 | Redis adapter **erken**: tek süreç + SQLite yüzlerce cihazı rahatça taşır. Önce Sentry (Android + backend), metrikler, offline uyarıları ve 500 bağlantı yük testi yapılmalı. Nginx WS proxy maddesi dağıtım paketine (Faz 0) taşınmalı. |
| **Faz 5 — İleri özellikler** | §6-1, §2.2-15 | **Önceliği yükseltilmesi gerekenler:** zamanlama (temel beklenti), QR ile eşleştirme (ucuz ve büyük UX kazancı; çalışma anında sunucu ayarıyla birleştirilebilir), `min_app_version` ve şablon manifestosu (sahada ilk cihazdan önce), `webview` şablonu (dashboard ve dış menü gibi ihtiyaçları ucuza karşılar). |

**TODO'da hiç olmayan ama ürün için gerekenler:** WS kimlik doğrulaması ve bağlantı yarışı düzeltmesi, migration'lar, dağıtım paketi ve yedekleme, kiosk modu ve Android TV, çalışma anında sunucu ayarı + TLS, OTA, organizasyon ve ekip, faturalama ve plan limitleri, KVKK ve yasal metinler, test + CI, ekran görüntüsü ve offline uyarısı, acil durum duyurusu (tüm ekranlara üstten mesaj), i18n.

---

## 8. Önerilen yol haritası

Efor: **S** ≤ 2 gün · **M** ≤ 1 hafta · **L** > 1 hafta

### Faz 0 — Ürünleşme temeli (TODO'ya eklenmesi önerilir; Faz 1'den önce)

| Sıra | İş | Gerekçe | Efor |
|---|---|---|---|
| 1 | Gateway bağlantı yarışı düzeltmesi + cihaz silinince/ekran silinince SCREEN_CLEAR + Android'in 4004'te yeniden kayıt olması | §2.1-2, 6, 7: sessiz arızalar | S |
| 2 | Cihaz gizli anahtarı (register → secret, WS el sıkışmasında doğrulama) | §2.1-1 | M |
| 3 | TypeORM migration'ları + production'da `synchronize` kapalı akışın test edilmesi | §2.1-3 | S |
| 4 | Production'da `JWT_SECRET`/admin parolası zorunluluğu, rate limit, helmet, API anahtarı hash'leme | §2.1-5, 8, 11 | S |
| 5 | Çalışma anında sunucu ayarı (QR/kod ile) + `https`/`wss` + cleartext'in kapatılması | §2.1-4 | M |
| 6 | Kiosk: otomatik başlama, ekranı açık tutma, tam ekran, Android TV launcher kaydı, çökünce yeniden başlama | §2.2-12 | M |
| 7 | Dağıtım paketi: Dockerfile veya tek komut kurulum, Caddy/Nginx + TLS + WS örneği, SQLite yedekleme (ör. Litestream) | §2.2-14 | M |
| 8 | Minimum test seti: pairing → assign → patch → REQUEST_SCREEN e2e + ingest testleri + GitHub Actions | §2.2-18 | M |
| 9 | Protokol sürümü + `min_app_version` + OTA mekanizması (kendi sunucundan APK indirme ya da MDM) | §2.2-15 | M |

### Sonrası (TODO ile birleşik öneri sırası)

1. **Faz 1** (sıra ekranı API'si ilk; layout motoru yaklaşımıyla)
2. **Organizasyon/ekip modeli + plan limitleri** (Faz 3 tasarımından önce veri modeli olarak)
3. **Faz 5'ten öne alınanlar:** zamanlama, QR eşleştirme, webview şablonu
4. **Faz 2** (medya: önbellek ve kota tasarımıyla)
5. **Faz 3** (panel yeniden tasarım: organizasyon/ekip ve faturalama ekranlarıyla birlikte)
6. **Filo yönetimi:** ekran görüntüsü, offline uyarısı, Sentry, metrikler (Faz 4'ün izleme kısmı)
7. **Ticari altyapı:** ödeme, e-fatura, KVKK, tanıtım sitesi, dokümantasyon
8. **POS bağlayıcıları:** Adisyo / SambaPOS / yemek platformları

---

## 9. Konumlandırma ve fiyatlandırma hipotezi

- **Giriş pazarı:** Türkiye'de kafe/QSR'lerde *sipariş hazır* ekranı ve klinik, şube ve servis noktalarında *sıra numarası* ekranı. İkisi de gecikmeye duyarlı, veriye dayalı ve POS veya iş sistemiyle entegrasyon gerektiren işler. Bu, bugün güçlü olunan alanın tam karşılığı.
- **Mesaj:** "POS'unuza bağlanır, saniyesinde günceller, internet giderse son ekranı göstermeye devam eder; ucuz bir Android TV kutusu yeter."
- **Genişleme:** Faz 2 ile medya ve slayt eklendiğinde aynı ekran boş zamanlarda reklam ve menü gösterebilir. Bu, upsell imkânı yaratır ve "lite signage" segmentine giriş sağlar.
- **Fiyat hipotezi (doğrulanmalı):** Yerel referans 125 – 250 TL/ekran/ay (Menulux), global rakipler $8 – $20/ekran/ay. Lokasyon bazlı paket (ör. bir şubede 2 – 3 operasyonel ekran) ve 1 ekran ücretsiz/deneme modeli değerlendirilebilir. Kendi sunucusunda kurulum, kurumsal ve kamu müşterisine yıllık lisans olarak ayrıca satılabilir.
- **Ortaklık:** Adisyo ve SambaPOS gibi POS üreticileri rakip değil, **satış kanalı** olabilir. Müşteri ekranı modülü olarak entegrasyon/white-label teklif edilebilir.

---

## 10. Kaynaklar

- Yodeck fiyatlandırma — <https://www.yodeck.com/pricing/>, <https://www.g2.com/products/yodeck/pricing>
- Digital Signage Pricing Index 2026 (11 platform) — <https://digitalsignage.com/digital_signage/docs/guides/digital-signage-pricing-index-2026/>
- OptiSigns fiyatlandırma — <https://www.visora.mx/blog/optisigns-pricing>, <https://www.capterra.com/p/173450/OptiSigns/>
- ScreenCloud fiyatlandırma — <https://digitalsignage.com/digital_signage/docs/guides/screencloud-pricing-2026/>
- Xibo DataSets ve Data Connector — <https://account.xibosignage.com/manual/en/media_datasets>, <https://account.xibosignage.com/docs/developer/player-control/data-connector>
- Anthias (Screenly OSE) — <https://anthias.screenly.io/>
- Fresh KDS Order Tracker ve fiyat — <https://www.fresh.technology/features/order-tracker>, <https://www.fresh.technology/kds/pricing>
- KDS karşılaştırması (Square/Toast) — <https://fitsmallbusiness.com/best-kitchen-display-systems/>
- Qminder fiyatlandırma — <https://www.getapp.com/operations-management-software/a/qminder/>, <https://scanqueue.com/compare/qminder>
- Menulux dijital menuboard — <https://www.menulux.com/restoran-otomasyonu/digital-signage/dijital-menuboard>
- KoçSistem Pixage — <https://kocsistem.com.tr/en/products-services/digital-signage/pixage/>
- Adisyo — <https://adisyo.com/restoran-otomasyon-sistemi>; SambaPOS — <https://sambapos.com/tr/sambapos-paket-servis-adisyon-programi/>
- Sıramatik donanım fiyatları — <https://www.akakce.com/kiosk/siramatik.html>
- 2026 özellik kontrol listeleri — <https://www.yodeck.com/use-cases/digital-signage-features/>, <https://digitalsignage.com/digital_signage/docs/software/cms-features/>
- Veri yenileme aralıkları — <https://www.yodeck.com/docs/user-manual/google-sheets/>, <https://support.optisigns.com/hc/en-us/articles/360056977214-How-to-Use-Google-Sheets-with-OptiSigns>
