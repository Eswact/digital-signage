package com.camlica.signage.di

import android.content.Context
import androidx.room.Room
import com.camlica.signage.data.local.ScreenDao
import com.camlica.signage.data.local.SignageDatabase
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): SignageDatabase =
        Room.databaseBuilder(context, SignageDatabase::class.java, "signage.db")
            .fallbackToDestructiveMigration()
            .build()

    @Provides
    fun provideScreenDao(db: SignageDatabase): ScreenDao = db.screenDao()

    @Provides
    @Singleton
    fun provideJson(): Json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    @Provides
    @Singleton
    fun provideOkHttp(): OkHttpClient = OkHttpClient.Builder()
        .pingInterval(0, TimeUnit.SECONDS) // ping'i uygulama seviyesinde yönetiyoruz
        .retryOnConnectionFailure(true)
        .build()
}
