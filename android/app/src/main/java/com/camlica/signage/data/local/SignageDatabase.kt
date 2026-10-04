package com.camlica.signage.data.local

import androidx.room.Database
import androidx.room.RoomDatabase

@Database(entities = [CachedScreen::class], version = 1, exportSchema = false)
abstract class SignageDatabase : RoomDatabase() {
    abstract fun screenDao(): ScreenDao
}
