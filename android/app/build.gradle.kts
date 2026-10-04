plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.serialization")
    id("com.google.dagger.hilt.android")
    id("com.google.devtools.ksp")
}

android {
    namespace = "com.camlica.signage"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.camlica.signage"
        minSdk = 24
        targetSdk = 34
        // Compared with the template minAppVersion (backend templates/template.types.ts).
        versionCode = 3
        versionName = "0.3.0"

        // VARSAYILAN sunucu adresi — cihazda uygulama içinden değiştirilebilir
        // (eşleştirme ekranında "Sunucu ayarı" ya da ekrana uzun basma). Girilen
        // adres cihazda saklanır (ServerConfig); bu değer yalnızca ilk kurulumda kullanılır.
        //  - Gerçek cihaz: PC'nin LAN IP'si (telefon aynı Wi-Fi'da olmalı).
        //  - Emülatör: 10.0.2.2 (host makinenin localhost'u)
        // WebSocket adresi bundan türetilir (http → ws, /api → /ws).
        buildConfigField("String", "API_URL", "\"http://192.168.1.61:3001/api\"")

        // Sentry (opsiyonel): DSN verilmezse SDK hiç başlatılmaz, veri gönderilmez.
        // `./gradlew assembleRelease -PSENTRY_DSN=...` ya da SENTRY_DSN ortam değişkeni.
        val sentryDsn = (project.findProperty("SENTRY_DSN") as String?) ?: System.getenv("SENTRY_DSN") ?: ""
        buildConfigField("String", "SENTRY_DSN", "\"$sentryDsn\"")
    }

    buildTypes {
        // Şifresiz HTTP/WS yalnızca geliştirmede (LAN'daki dev sunucusu);
        // release build https/wss ister.
        debug {
            manifestPlaceholders["usesCleartext"] = "true"
        }
        release {
            manifestPlaceholders["usesCleartext"] = "false"
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.14"
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.06.00")
    implementation(composeBom)

    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.3")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.3")
    implementation("androidx.activity:activity-compose:1.9.0")

    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")

    // Hilt
    implementation("com.google.dagger:hilt-android:2.51.1")
    ksp("com.google.dagger:hilt-compiler:2.51.1")
    implementation("androidx.hilt:hilt-navigation-compose:1.2.0")

    // WebSocket + JSON
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3")

    // Room (offline: son ekranı sakla)
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")

    // Media: images (Coil) and video (Media3 ExoPlayer) for the media-player template and overlays
    implementation("io.coil-kt:coil-compose:2.6.0")
    implementation("androidx.media3:media3-exoplayer:1.3.1")
    implementation("androidx.media3:media3-ui:1.3.1")

    // QR (pairing linki) — yalnızca üretim için zxing çekirdeği
    implementation("com.google.zxing:core:3.5.3")

    // Hata raporlama (opsiyonel, DSN ile açılır)
    implementation("io.sentry:sentry-android:7.14.0")

    debugImplementation("androidx.compose.ui:ui-tooling")
}
